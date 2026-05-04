/**
 * 描述任务端到端编排（V1.0 改造）
 *
 * V1.0 变更（Plan_02 §2.3）：
 *   - 图像生成串行化：主路通义万相 → 兜底 MiniMax（去掉双路并行）
 *   - 内容审核接入：阿里云内容安全 + LLM Vision 双层审核
 *   - LLM 切 Claude（Pass1/Pass2/keyword_extract）
 *
 * 顺序：
 *   1. 输入安全过滤
 *   2. 写 memories
 *   3. 并行：Pass1 + 关键词提取
 *   4. 拼接 stylePrompt
 *   5. 图像生成（串行）+ 风格审核 + 内容审核（带重试，最多 3 次）
 *   6. 写 cards
 *   7. 写 memory_bank
 *   8. Pass2 → 写 conversations
 */

import 'server-only';

import { getCompanionPreset } from '@/lib/companionPresets';
import { runPass1, pass1FallbackSetAside } from '@/lib/llm/pass1';
import { runPass2, pass2Fallback } from '@/lib/llm/pass2';
import { runKeywordExtract, keywordExtractFallback } from '@/lib/llm/keywordExtract';
import {
  generateImageDashScope,
  type ImageGenInput,
  type ImageGenResult,
} from '@/lib/imagegen/client';
import { generateImageMiniMax } from '@/lib/imagegen/minimaxClient';
import { auditImageStyle } from '@/lib/imagegen/styleAudit';
import { auditImageContent, type ContentAuditResult } from '@/lib/imagegen/contentAudit';
import { buildImagePrompt } from '@/lib/imagegen/stylePrompt';
import {
  appendEvidenceToMemoryBank,
  getCompanionById,
  getMemoryBank,
  insertCompanionLine,
  insertMemory,
  upsertMemoryBankEntry,
} from '@/lib/db/repos';
import { countCardAttempts, createCard } from '@/lib/db/cardsRepo';
import {
  filterChildInput,
  filterCompanionOutput,
  getInputRejectionLine,
} from '@/lib/safety/filters';
import type { Card, CardSeverity, DayNumber, ImageSource, KeywordExtractOutput } from '@/types';
import type { Pass1Output } from '@/lib/llm/validators';

export interface ProcessDescribeInput {
  companionId: string;
  taskId: string;
  taskTitle: string;
  taskQuestion: string;
  descriptionText: string;
  inputMethod: 'voice' | 'text';
  voiceAudioUrl?: string;
  asrTranscription?: string;
  editedText?: string;
}

export interface ProcessDescribeResult {
  memoryId: string;
  card: Card;
  pass1: Pass1Output;
  pass2Reply: string;
  pass2Source: 'llm' | 'fallback';
  memoryBankId?: string;
  /** V1.0 新增 */
  contentAudit: ContentAuditResult | null;
}

export async function processDescribe(
  input: ProcessDescribeInput,
): Promise<ProcessDescribeResult> {
  const companion = await getCompanionById(input.companionId);
  if (!companion) throw new Error('companion not found');

  const preset = getCompanionPreset(companion.preset_id);
  if (!preset) throw new Error(`unknown preset_id ${companion.preset_id}`);

  const day = companion.current_day as DayNumber;

  // —— 输入安全过滤（PRD §17.2 第 1 层）——
  const safetyCheck = filterChildInput(input.descriptionText);
  if (!safetyCheck.ok) {
    return await safetyRejectionPath({
      companionId: companion.id,
      day,
      preset,
      input,
      reason: safetyCheck.reason ?? 'other',
    });
  }

  // 1. 写 memories
  const memory = await insertMemory({
    companionId: companion.id,
    day,
    type: 'describe',
    taskId: input.taskId,
    taskQuestion: input.taskQuestion,
    userText: input.descriptionText,
    inputMethod: input.inputMethod,
    voiceAudioUrl: input.voiceAudioUrl,
    asrTranscription: input.asrTranscription,
    editedText: input.editedText,
  });

  // 2. 并行：Pass1 + 关键词提取
  const memoryBank = await getMemoryBank(companion.id);
  const [pass1Result, keywordResult] = await Promise.all([
    runPass1(
      {
        companion: preset,
        day,
        inputType: 'describe',
        inputContent: input.descriptionText,
        memoryBank,
      },
      companion.id,
    ),
    runKeywordExtract(
      { descriptionText: input.descriptionText, taskTopic: input.taskTitle },
      companion.id,
    ),
  ]);

  const pass1Data: Pass1Output = pass1Result.success
    ? pass1Result.data
    : pass1FallbackSetAside({
        companion: preset,
        day,
        inputType: 'describe',
        inputContent: input.descriptionText,
        memoryBank,
      });

  const keywords: KeywordExtractOutput =
    keywordResult ?? keywordExtractFallback(input.taskTitle);

  // 3. 图像生成（串行）+ 风格审核 + 内容审核（V1.0 改造）
  const prompt = buildImagePrompt(keywords.prompt_content);
  const card = await generateCardWithRetry({
    prompt,
    companionId: companion.id,
    memoryId: memory.id,
    keywords,
  });

  // 4. 写 memory_bank（与 V0.5 同逻辑）
  const memoryBankId = await applyPass1ToBank({
    companionId: companion.id,
    day,
    memoryId: memory.id,
    pass1Data,
    memoryBank,
  });

  // 5. Pass 2 → 伙伴对卡片做出口语回应
  const pass2Result = await runPass2(
    {
      companion: preset,
      day,
      inputType: 'describe',
      inputContent: input.descriptionText,
      pass1: pass1Data,
      memoryBank,
    },
    companion.id,
  );
  let pass2Reply = pass2Result.success ? pass2Result.data : pass2Fallback('describe');
  let pass2Source: 'llm' | 'fallback' = pass2Result.success ? 'llm' : 'fallback';

  // 输出安全过滤
  const outCheck = filterCompanionOutput(pass2Reply);
  if (!outCheck.ok) {
    pass2Reply = pass2Fallback('describe');
    pass2Source = 'fallback';
  }

  // 6. 写 conversations
  await insertCompanionLine({
    companionId: companion.id,
    day,
    content: pass2Reply,
    source: pass2Source === 'llm' ? 'pass2' : 'fallback',
    relatedMemoryId: memory.id,
    relatedMemoryBankId: memoryBankId,
  });

  return {
    memoryId: memory.id,
    card,
    pass1: pass1Data,
    pass2Reply,
    pass2Source,
    memoryBankId,
    contentAudit: {
      passed: card.content_audit_passed ?? true,
      labels: card.content_audit_labels ?? [],
    },
  };
}

/**
 * V1.0 新函数：生成卡片（串行图片生成 + 内容审核 + 风格审核）
 *
 * 替代 V0.6.1 的 generateBothAndPersist（双路并行，无审核）。
 */
async function generateCard(
  prompt: string,
  companionId: string,
  attempt: number,
): Promise<{
  imageUrl: string | null;
  source: ImageSource | null;
  isFallback: boolean;
  contentAudit: ContentAuditResult;
} | null> {
  // 主路：通义万相
  let result = await generateImageDashScope({ prompt }, companionId);
  let source: ImageSource = 'dashscope';

  // 兜底：MiniMax
  if (!result) {
    result = await generateImageMiniMax({ prompt }, companionId);
    source = 'minimax';
  }

  // 全失败
  if (!result) {
    return {
      imageUrl: null,
      source: null,
      isFallback: true,
      contentAudit: { passed: false, labels: ['imagegen_failed'] },
    };
  }

  // 内容审核（V1.0 新增）
  const audit = await auditImageContent(result.imageUrl, companionId);
  if (!audit.passed && attempt < 3) {
    return null; // 触发外层重试
  }
  if (!audit.passed) {
    return {
      imageUrl: null,
      source,
      isFallback: true,
      contentAudit: audit,
    };
  }

  return {
    imageUrl: result.imageUrl,
    source,
    isFallback: false,
    contentAudit: audit,
  };
}

/**
 * V1.0 带重试的生成循环：生成 → 风格审核 → 内容审核
 * 最多重试 3 次（含初次），均失败则文字降级。
 */
async function generateCardWithRetry(args: {
  prompt: string;
  companionId: string;
  memoryId: string;
  keywords: KeywordExtractOutput;
}): Promise<Card> {
  const { prompt, companionId, memoryId, keywords } = args;
  const MAX_ATTEMPTS = 3;

  let lastCardResult: Awaited<ReturnType<typeof generateCard>> = null;
  let stylePassed: boolean | null = null;
  let styleSeverity: CardSeverity | null = null;
  let styleIssues: string[] = [];
  let contentAudit: ContentAuditResult = { passed: true, labels: [] };
  let finalImageUrl: string | null = null;
  let finalSource: ImageSource | null = null;
  let finalIsFallback = false;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    // 生成图像 + 内容审核
    lastCardResult = await generateCard(prompt, companionId, attempt);
    if (!lastCardResult) continue; // content audit failed, retry
    if (lastCardResult.isFallback) {
      finalImageUrl = null;
      finalSource = lastCardResult.source ?? 'dashscope';
      finalIsFallback = true;
      contentAudit = lastCardResult.contentAudit;
      styleIssues = ['image_generation_failed'];
      break;
    }

    // 风格审核
    if (lastCardResult.imageUrl) {
      const styleAudit = await auditImageStyle(lastCardResult.imageUrl, companionId);
      stylePassed = styleAudit.style_match;
      styleSeverity = styleAudit.severity as CardSeverity;
      styleIssues = styleAudit.issues ?? [];

      if (styleAudit.severity === 'major') {
        continue; // 风格不通过，重生成
      }
    }

    // 通过
    finalImageUrl = lastCardResult.imageUrl;
    finalSource = lastCardResult.source;
    finalIsFallback = false;
    contentAudit = lastCardResult.contentAudit;
    break;
  }

  // 所有尝试均失败 → 文字降级
  if (!finalImageUrl && !finalIsFallback) {
    finalIsFallback = true;
    finalSource = lastCardResult?.source ?? 'dashscope';
  }

  const attemptNum = styleIssues.includes('image_generation_failed')
    ? MAX_ATTEMPTS
    : lastCardResult === null
      ? MAX_ATTEMPTS
      : 1;

  return await createCard({
    memoryId,
    companionId,
    imageUrl: finalImageUrl,
    imageSource: finalSource,
    imagePrompt: prompt,
    rawKeywordExtract: keywords,
    styleCheckPassed: stylePassed,
    styleCheckSeverity: styleSeverity ?? (finalIsFallback ? 'major' : 'ok'),
    styleCheckIssues: styleIssues,
    contentAuditPassed: contentAudit.passed,
    contentAuditLabels: contentAudit.labels,
    generationAttempt: Math.min(attemptNum, 4) as 1 | 2 | 3 | 4,
    isFallbackTextCard: finalIsFallback,
  });
}

/**
 * 应用 Pass1 结果到 memory_bank。复用 processInput 的逻辑。
 */
async function applyPass1ToBank(args: {
  companionId: string;
  day: DayNumber;
  memoryId: string;
  pass1Data: Pass1Output;
  memoryBank: Awaited<ReturnType<typeof getMemoryBank>>;
}): Promise<string | undefined> {
  const { pass1Data, memoryId, day } = args;

  if (pass1Data.action === 'append_to_existing' && pass1Data.target_concept_id) {
    await appendEvidenceToMemoryBank(pass1Data.target_concept_id, {
      quote: pass1Data.evidence_text,
      day,
      source: memoryId,
      at: new Date().toISOString(),
    });
    return pass1Data.target_concept_id;
  }

  const bankType =
    pass1Data.action === 'create_new'
      ? 'remembered'
      : pass1Data.action === 'mark_uncertain'
        ? 'uncertain'
        : 'set_aside';

  const entry = await upsertMemoryBankEntry({
    companionId: args.companionId,
    type: bankType,
    conceptName: pass1Data.concept_name,
    conceptCategory: pass1Data.concept_category,
    aiSummary: pass1Data.evidence_text,
    aiReasoning: pass1Data.ai_reasoning,
    evidence: [{
      quote: pass1Data.evidence_text,
      day,
      source: memoryId,
      at: new Date().toISOString(),
    }],
    confidence: pass1Data.confidence,
  });
  return entry.id;
}

/**
 * 安全过滤命中后的兜底路径：写 set_aside + 安全提示文案，不生成卡片。
 */
async function safetyRejectionPath(args: {
  companionId: string;
  day: DayNumber;
  preset: ReturnType<typeof getCompanionPreset>;
  input: ProcessDescribeInput;
  reason: string;
}): Promise<ProcessDescribeResult> {
  const memory = await insertMemory({
    companionId: args.companionId,
    day: args.day,
    type: 'describe',
    taskId: args.input.taskId,
    taskQuestion: args.input.taskQuestion,
    userText: '(被安全过滤)',
    inputMethod: args.input.inputMethod,
    voiceAudioUrl: args.input.voiceAudioUrl,
    asrTranscription: args.input.asrTranscription,
  });

  const rejectionLine = getInputRejectionLine(args.reason);

  const fallbackEntry = await upsertMemoryBankEntry({
    companionId: args.companionId,
    type: 'set_aside',
    conceptName: '我先放一放的话',
    conceptCategory: 'other',
    aiSummary: '一些不太适合记下的话，先放着。',
    aiReasoning: '这次的内容我先放一放。',
    evidence: [{
      quote: '(过滤)',
      day: args.day,
      source: memory.id,
      at: memory.created_at,
    }],
    confidence: 1.0,
  });

  await insertCompanionLine({
    companionId: args.companionId,
    day: args.day,
    content: rejectionLine,
    source: 'safety_filter',
    relatedMemoryId: memory.id,
    relatedMemoryBankId: fallbackEntry.id,
  });

  // 写一张文字降级卡片，便于前端展示
  const card = await createCard({
    memoryId: memory.id,
    companionId: args.companionId,
    imageUrl: null,
    imagePrompt: '(safety_blocked)',
    isFallbackTextCard: true,
    generationAttempt: 1,
    styleCheckPassed: false,
    styleCheckSeverity: 'major',
    styleCheckIssues: ['safety_input_blocked', args.reason],
  });

  return {
    memoryId: memory.id,
    card,
    pass1: {
      action: 'set_aside',
      concept_name: '我先放一放的话',
      concept_category: 'other',
      target_concept_id: null,
      evidence_text: '(过滤)',
      ai_reasoning: '我把这次内容先放一放。',
      confidence: 1.0,
    },
    pass2Reply: rejectionLine,
    pass2Source: 'fallback',
    memoryBankId: fallbackEntry.id,
    contentAudit: { passed: false, labels: ['safety_input_blocked'] },
  };
}

/**
 * Revise 流程：基于 card_id 找到 memory，重新跑关键词提取 + 图像生成 + 审核。
 * 不重写 memory_bank（复用原 Pass1 结果）。
 *
 * V1.0 改造：使用串行生成 + 风格审核 + 内容审核。
 *
 * @returns 新卡片 + 新 attempt
 */
export async function processReviseCard(args: {
  cardId: string;
  oldCard: Card;
  revisionType: 'color' | 'missing' | 'complete_redo';
  revisionText: string;
  originalDescription: string;
  taskTitle: string;
}): Promise<{
  card: Card;
  attempt: number;
  isExhausted: boolean;
  contentAudit: ContentAuditResult | null;
}> {
  // 统计已有卡片数，新 card 的 generation_attempt = 已有数 + 1
  const existingCount = await countCardAttempts(args.oldCard.memory_id);
  const newAttempt = existingCount + 1;

  // 第 4 次 revise 之后 → 熔断，不再重做
  if (newAttempt > 4) {
    const fallbackCard = await createCard({
      memoryId: args.oldCard.memory_id,
      companionId: args.oldCard.companion_id,
      imageUrl: args.oldCard.image_url, // 保留最后一次卡片
      imageSource: args.oldCard.image_source,
      imagePrompt: args.oldCard.image_prompt,
      isFallbackTextCard: true,
      generationAttempt: 4,
      styleCheckPassed: false,
      styleCheckSeverity: 'major',
      styleCheckIssues: ['regen_exhausted'],
    });
    return {
      card: fallbackCard,
      attempt: 4,
      isExhausted: true,
      contentAudit: null,
    };
  }

  // 拼接修订描述
  const reviseHint =
    args.revisionType === 'color'
      ? '颜色调整：'
      : args.revisionType === 'missing'
        ? '补充内容：'
        : '整体重做：';
  const merged = `${args.originalDescription}\n\n[${reviseHint}${args.revisionText}]`;

  const keywords =
    (await runKeywordExtract(
      { descriptionText: merged, taskTopic: args.taskTitle },
      args.oldCard.companion_id,
    )) ?? keywordExtractFallback(args.taskTitle);

  // V1.0：使用带重试的生成流程
  const prompt = buildImagePrompt(keywords.prompt_content);
  const newCard = await generateCardWithRetry({
    prompt,
    companionId: args.oldCard.companion_id,
    memoryId: args.oldCard.memory_id,
    keywords,
  });

  return {
    card: newCard,
    attempt: newAttempt,
    isExhausted: false,
    contentAudit: {
      passed: newCard.content_audit_passed ?? true,
      labels: newCard.content_audit_labels ?? [],
    },
  };
}
