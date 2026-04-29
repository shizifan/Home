/**
 * 端到端编排：一次输入 → Vision (拍照时) → Pass 1 → 写 memory_bank → Pass 2 → 写 conversations
 * 这是 PRD §4.1 每日循环的服务端实现。
 */

import 'server-only';

import { getCompanionPreset } from '@/lib/companionPresets';
import { runPass1, pass1FallbackSetAside } from '@/lib/llm/pass1';
import { runPass2, pass2Fallback } from '@/lib/llm/pass2';
import {
  appendEvidenceToMemoryBank,
  createMemoryBankEntry,
  getCompanionById,
  getMemoryBank,
  insertCompanionLine,
  insertMemory,
} from '@/lib/db/repos';
import {
  filterChildInput,
  filterCompanionOutput,
  filterVisionTags,
  getInputRejectionLine,
} from '@/lib/safety/filters';
import type { DayNumber, Memory, MemoryInputType, VisionTags } from '@/types';
import type { Pass1Output } from '@/lib/llm/validators';

export interface OrchestrateInput {
  companionId: string;
  taskId: string;
  taskQuestion?: string;
  inputType: MemoryInputType;
  /** 文字输入；photo 也可附带文字（Day 2/3）*/
  userText?: string;
  /** photo 类型必填 */
  photoUrl?: string;
  visionTags?: VisionTags;
}

export interface OrchestrateResult {
  memory: Memory;
  pass1: Pass1Output;
  pass2Reply: string;
  pass2Source: 'llm' | 'fallback';
  memoryBankId?: string;
}

export async function processInput(
  input: OrchestrateInput,
): Promise<OrchestrateResult> {
  const companion = await getCompanionById(input.companionId);
  if (!companion) throw new Error('companion not found');

  const preset = getCompanionPreset(companion.preset_id);
  if (!preset) throw new Error(`unknown preset_id ${companion.preset_id}`);

  const day = companion.current_day as DayNumber;

  // —— 输入安全过滤（PRD §17.2 第 1 层） ——
  if (input.userText) {
    const ck = filterChildInput(input.userText);
    if (!ck.ok) {
      // 直接构造一条受控的"安全提示"path：写 set_aside + 安全文案
      const memory = await insertMemory({
        companionId: companion.id,
        day,
        type: input.inputType,
        userText: '(被安全过滤)',
        taskId: input.taskId,
        taskQuestion: input.taskQuestion,
      });
      const rejection = getInputRejectionLine(ck.reason ?? 'other');
      const fallbackEntry = await createMemoryBankEntry({
        companionId: companion.id,
        type: 'set_aside',
        conceptName: '我先放一放的话',
        conceptCategory: 'other',
        aiSummary: '一些不太适合记下的话，先放着。',
        aiReasoning: '这次的内容我先放一放。',
        evidence: [{ memory_id: memory.id, day, excerpt: '(过滤)' }],
        confidence: 1.0,
      });
      await insertCompanionLine({
        companionId: companion.id,
        day,
        content: rejection,
        source: 'safety_filter',
        relatedMemoryId: memory.id,
        relatedMemoryBankId: fallbackEntry.id,
      });
      return {
        memory,
        pass1: {
          action: 'set_aside',
          concept_name: '我先放一放的话',
          concept_category: 'other',
          target_concept_id: null,
          evidence_text: '(过滤)',
          ai_reasoning: '我把这次内容先放一放。',
          confidence: 1.0,
        },
        pass2Reply: rejection,
        pass2Source: 'fallback',
        memoryBankId: fallbackEntry.id,
      };
    }
  }

  // —— Vision tag 黑名单过滤 ——
  const cleanedVisionTags = filterVisionTags(
    input.visionTags ? { objects: input.visionTags.objects } : null,
  );
  const visionTagsForPass1 = cleanedVisionTags
    ? { ...input.visionTags, objects: cleanedVisionTags.objects }
    : input.visionTags;

  // 1. 写 memories（先落库，确保即使 LLM 全失败原始数据也保留）
  const memory = await insertMemory({
    companionId: companion.id,
    day,
    type: input.inputType,
    photoUrl: input.photoUrl,
    visionTags: visionTagsForPass1,
    userText: input.userText,
    taskId: input.taskId,
    taskQuestion: input.taskQuestion,
  });

  // 2. Pass 1
  const memoryBank = await getMemoryBank(companion.id);
  const inputContent = input.userText
    ?? (input.inputType === 'photo' ? '(照片)' : '(无文字)');

  const pass1Result = await runPass1(
    {
      companion: preset,
      day,
      inputType: input.inputType,
      inputContent,
      visionTags: input.visionTags,
      memoryBank,
    },
    companion.id,
  );

  const pass1Data: Pass1Output = pass1Result.success
    ? pass1Result.data
    : pass1FallbackSetAside({
        companion: preset,
        day,
        inputType: input.inputType,
        inputContent,
        visionTags: input.visionTags,
        memoryBank,
      });

  // 3. 写 memory_bank
  let memoryBankId: string | undefined;
  if (pass1Data.action === 'append_to_existing' && pass1Data.target_concept_id) {
    await appendEvidenceToMemoryBank(pass1Data.target_concept_id, {
      memory_id: memory.id,
      day,
      excerpt: pass1Data.evidence_text,
    });
    memoryBankId = pass1Data.target_concept_id;
  } else {
    const type =
      pass1Data.action === 'create_new'
        ? 'remembered'
        : pass1Data.action === 'mark_uncertain'
          ? 'uncertain'
          : 'set_aside';
    try {
      const entry = await createMemoryBankEntry({
        companionId: companion.id,
        type,
        conceptName: pass1Data.concept_name,
        conceptCategory: pass1Data.concept_category,
        aiSummary: pass1Data.evidence_text,
        aiReasoning: pass1Data.ai_reasoning,
        evidence: [
          { memory_id: memory.id, day, excerpt: pass1Data.evidence_text },
        ],
        confidence: pass1Data.confidence,
      });
      memoryBankId = entry.id;
    } catch (err) {
      // 唯一键冲突（同名概念已存在）→ 当 append 处理
      if (
        type === 'remembered' &&
        (err as { code?: string })?.code === 'ER_DUP_ENTRY'
      ) {
        const existing = memoryBank.find(
          (m) => m.concept_name === pass1Data.concept_name && m.type === 'remembered',
        );
        if (existing) {
          await appendEvidenceToMemoryBank(existing.id, {
            memory_id: memory.id,
            day,
            excerpt: pass1Data.evidence_text,
          });
          memoryBankId = existing.id;
        }
      } else {
        throw err;
      }
    }
  }

  // 4. Pass 2
  const pass2Result = await runPass2(
    {
      companion: preset,
      day,
      inputType: input.inputType,
      inputContent,
      pass1: pass1Data,
      memoryBank,
    },
    companion.id,
  );

  let pass2Reply = pass2Result.success
    ? pass2Result.data
    : pass2Fallback(input.inputType);
  let pass2Source: 'llm' | 'fallback' = pass2Result.success ? 'llm' : 'fallback';

  // —— 输出安全过滤（PRD §17.2 第 5 层） ——
  const outCheck = filterCompanionOutput(pass2Reply);
  if (!outCheck.ok) {
    pass2Reply = pass2Fallback(input.inputType);
    pass2Source = 'fallback';
  }

  // 5. 写 conversations
  await insertCompanionLine({
    companionId: companion.id,
    day,
    content: pass2Reply,
    source: pass2Source === 'llm' ? 'pass2' : 'fallback',
    relatedMemoryId: memory.id,
    relatedMemoryBankId: memoryBankId,
  });

  return {
    memory,
    pass1: pass1Data,
    pass2Reply,
    pass2Source,
    memoryBankId,
  };
}
