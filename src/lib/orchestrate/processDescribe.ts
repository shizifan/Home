/**
 * 描述任务端到端编排（V0.6.1 §4.5）
 *
 * 输入：孩子提交的描述文字（来自 ASR 或直接打字）
 * 输出：完整 describe 响应（卡片 + 伙伴回应 + memory_bank 更新）
 *
 * 顺序（双图源并行测试期）：
 *   1. 写 memories
 *   2. 并行：Pass1 + 关键词提取
 *   3. 并行调用 DashScope + MiniMax 出图（不审核、不重试）
 *   4. 写 memory_bank（与 V0.5 同源）
 *   5. Pass2 → 写 conversations
 *
 * 风格 / 内容审核暂时跳过（待主力定下来后再上）。
 */

import 'server-only';

import { getCompanionPreset } from '@/lib/companionPresets';
import { runPass1, pass1FallbackSetAside } from '@/lib/llm/pass1';
import { runPass2, pass2Fallback } from '@/lib/llm/pass2';
import { runKeywordExtract, keywordExtractFallback } from '@/lib/llm/keywordExtract';
import { generateImagesParallel } from '@/lib/imagegen/parallel';
import { buildImagePrompt, pickReferenceImage } from '@/lib/imagegen/stylePrompt';
import {
  appendEvidenceToMemoryBank,
  getCompanionById,
  getMemoryBank,
  insertCompanionLine,
  insertMemory,
  upsertMemoryBankEntry,
} from '@/lib/db/repos';
import { createCard, incrementMemoryRegenerateCount } from '@/lib/db/cardsRepo';
import {
  filterChildInput,
  filterCompanionOutput,
  getInputRejectionLine,
} from '@/lib/safety/filters';
import type { Card, DayNumber, KeywordExtractOutput } from '@/types';
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

  // 3. 双图源并行出图（暂不做风格 / 内容审核）
  const card = await generateBothAndPersist({
    companionId: companion.id,
    memoryId: memory.id,
    keywords,
    attempt: 1,
  });

  // 6. 写 memory_bank（与 V0.5 同逻辑）
  const memoryBankId = await applyPass1ToBank({
    companionId: companion.id,
    day,
    memoryId: memory.id,
    pass1Data,
    memoryBank,
  });

  // 7. Pass 2 → 伙伴对卡片做出口语回应
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

  // 8. 写 conversations
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
  };
}

/**
 * 内部：DashScope + MiniMax 同时跑，两份结果都保存。
 * 暂不做风格 / 内容审核（测试期）。
 */
async function generateBothAndPersist(args: {
  companionId: string;
  memoryId: string;
  keywords: KeywordExtractOutput;
  attempt: 1 | 2 | 3 | 4;
}): Promise<Card> {
  const prompt = buildImagePrompt(args.keywords.prompt_content);
  const refImg = pickReferenceImage(args.keywords.scene_type);

  const { dashscope, minimax } = await generateImagesParallel(
    { prompt, referenceImageUrl: refImg },
    args.companionId,
  );

  // 主图优先 dashscope；alt 给 minimax；任一失败时把另一家提到主位
  let primaryUrl: string | null = null;
  let primarySource: 'dashscope' | 'minimax' | null = null;
  let altUrl: string | null = null;
  let altSource: 'dashscope' | 'minimax' | null = null;

  if (dashscope) {
    primaryUrl = dashscope.imageUrl;
    primarySource = 'dashscope';
  }
  if (minimax) {
    if (primaryUrl) {
      altUrl = minimax.imageUrl;
      altSource = 'minimax';
    } else {
      primaryUrl = minimax.imageUrl;
      primarySource = 'minimax';
    }
  }

  const failureNotes: string[] = [];
  if (!dashscope) failureNotes.push('dashscope_failed');
  if (!minimax) failureNotes.push('minimax_failed');

  return await createCard({
    memoryId: args.memoryId,
    companionId: args.companionId,
    imageUrl: primaryUrl,
    imageSource: primarySource,
    altImageUrl: altUrl,
    altImageSource: altSource,
    imagePrompt: prompt,
    rawKeywordExtract: args.keywords,
    styleCheckPassed: null,
    styleCheckSeverity: null,
    styleCheckIssues: failureNotes,
    generationAttempt: args.attempt,
    isFallbackTextCard: !primaryUrl,
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
      memory_id: memoryId,
      day,
      excerpt: pass1Data.evidence_text,
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
    evidence: [{ memory_id: memoryId, day, excerpt: pass1Data.evidence_text }],
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
    evidence: [{ memory_id: memory.id, day: args.day, excerpt: '(过滤)' }],
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
  };
}

/**
 * Revise 流程：基于 card_id 找到 memory，重新跑关键词提取 + 图像生成 + 风格审核。
 * 不重写 memory_bank（复用原 Pass1 结果）。
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
}): Promise<{ card: Card; attempt: number; isExhausted: boolean }> {
  // memories.regenerate_count 计数的是"用户点过几次「不太对」"
  // 自增后：newCount=1 表示这是第 1 次 revise，对应新 card 的 generation_attempt=2
  const newCount = await incrementMemoryRegenerateCount(args.oldCard.memory_id);
  // 新 card 的 generation_attempt = 1 (原始) + revise 次数
  const newAttempt = newCount + 1;

  // 第 4 次 revise 之后（newCount=4，会让 attempt=5 超过上限 4）→ 熔断，不再重做
  if (newAttempt > 4) {
    const fallbackCard = await createCard({
      memoryId: args.oldCard.memory_id,
      companionId: args.oldCard.companion_id,
      imageUrl: args.oldCard.image_url, // 保留最后一次卡片
      imageSource: args.oldCard.image_source,
      altImageUrl: args.oldCard.alt_image_url,
      altImageSource: args.oldCard.alt_image_source,
      imagePrompt: args.oldCard.image_prompt,
      isFallbackTextCard: true,
      generationAttempt: 4,
      styleCheckPassed: false,
      styleCheckSeverity: 'major',
      styleCheckIssues: ['regen_exhausted'],
    });
    return { card: fallbackCard, attempt: 4, isExhausted: true };
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

  const newCard = await generateBothAndPersist({
    companionId: args.oldCard.companion_id,
    memoryId: args.oldCard.memory_id,
    keywords,
    attempt: Math.min(newAttempt, 4) as 1 | 2 | 3 | 4,
  });

  return { card: newCard, attempt: newAttempt, isExhausted: false };
}
