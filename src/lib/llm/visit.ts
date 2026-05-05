/**
 * 朋友家拜访 LLM 调用（PRD §12 / §23.10）
 *
 * 输入：拜访者 / 被拜访者各自的 PresetCompanionMeta + memory_bank 摘要 + 目的
 * 输出：scene_narrative + 可选 new_word
 *
 * 失败：2 次重试都失败 → 上层调用方写占位文案到 trip.report_data
 */

import 'server-only';

import { z } from 'zod';
import { callLLM, type LLMResult } from './client';
import { parseJsonStrict } from './validators';
import { renderPrompt, loadFewShotJSON } from './promptLoader';
import type { CompanionPresetMeta } from '@/lib/companionPresets';
import type { PresetCompanion } from '@/lib/station/presetCompanions';
import { renderPresetMemorySummary } from '@/lib/station/presetCompanions';
import type { MemoryBankEntry, VisitPurposeType } from '@/types';

const VisitNewWordSchema = z.object({
  concept_name: z.string().min(1).max(40),
  ai_summary: z.string().min(1).max(120),
  ai_reasoning: z.string().min(1).max(160),
  confidence: z.number().min(0).max(1),
});

export const VisitOutputSchema = z.object({
  scene_narrative: z.string().min(10).max(400),
  new_word: VisitNewWordSchema.nullable(),
});

export type VisitOutput = z.infer<typeof VisitOutputSchema>;

export interface VisitInput {
  visitor: CompanionPresetMeta;
  visitorMemoryBank: MemoryBankEntry[];
  /** 被拜访者：可以是系统预设（PresetCompanion）或真实毕业用户的 companion 摘要（同结构） */
  host:
    | { kind: 'preset'; preset: PresetCompanion }
    | {
        kind: 'real';
        name: string;
        appearance: string;
        personality: string;
        memoryBank: MemoryBankEntry[];
      };
  purpose: VisitPurposeType;
  purposeQuestion?: string;
}

function summarizeRememberedBank(bank: MemoryBankEntry[]): string {
  const items = bank.filter((m) => m.type === 'remembered');
  if (items.length === 0) return '（暂无）';
  return items
    .slice(0, 12)
    .map(
      (m) =>
        `- 【${m.concept_category ?? 'other'}】${m.concept_name}：${m.ai_summary ?? ''}`,
    )
    .join('\n');
}

function summarizeUnknownBank(bank: MemoryBankEntry[]): string {
  const items = bank.filter((m) => m.type === 'unknown');
  if (items.length === 0) return '（暂无）';
  return items
    .slice(0, 8)
    .map((m) => `- ${m.concept_name}`)
    .join('\n');
}

function visitorSummaryText(bank: MemoryBankEntry[]): string {
  return [
    '【已知】',
    summarizeRememberedBank(bank),
    '',
    '【完全不知道的事】',
    summarizeUnknownBank(bank),
  ].join('\n');
}

function hostSummaryText(host: VisitInput['host']): string {
  if (host.kind === 'preset') {
    return renderPresetMemorySummary(host.preset);
  }
  return [
    '【已知】',
    summarizeRememberedBank(host.memoryBank),
    '',
    '【完全不知道的事】',
    summarizeUnknownBank(host.memoryBank),
  ].join('\n');
}

function hostMeta(host: VisitInput['host']): {
  name: string;
  appearance: string;
  personality: string;
} {
  if (host.kind === 'preset') {
    return {
      name: host.preset.name,
      appearance: host.preset.appearance,
      personality: host.preset.personality,
    };
  }
  return {
    name: host.name,
    appearance: host.appearance,
    personality: host.personality,
  };
}

export async function runVisit(
  input: VisitInput,
  companionId?: string,
): Promise<LLMResult<VisitOutput>> {
  const fewShot = loadFewShotJSON('visit/examples.json');
  const personalityExamples = input.visitor.personality_examples
    .map((s) => `- ${s}`)
    .join('\n');
  const host = hostMeta(input.host);

  const systemPrompt = renderPrompt(
    'visit',
    {
      visitor_name: input.visitor.name,
      visitor_appearance: input.visitor.appearance,
      visitor_personality: input.visitor.personality,
      visitor_personality_examples: personalityExamples,
      visitor_memory_bank_summary: visitorSummaryText(input.visitorMemoryBank),
      host_name: host.name,
      host_appearance: host.appearance,
      host_personality: host.personality,
      host_memory_bank_summary: hostSummaryText(input.host),
      trip_purpose: input.purpose,
      purpose_question: input.purposeQuestion ?? '（无）',
    },
    fewShot,
  );

  return callLLM<VisitOutput>({
    callType: 'visit',
    systemPrompt,
    userPrompt: '请输出 JSON。',
    expectJson: true,
    parse: (raw) => parseJsonStrict(raw, VisitOutputSchema),
    companionId,
    promptVersion: 'visit_v1',
    maxRetries: 1,
  });
}

/** 失败兜底叙事（PRD §25.6）— 写到 trip.report_data */
export const VISIT_FALLBACK_NARRATIVE =
  '它好像还没回来......明天再来看看？';

export function visitFallbackOutput(): VisitOutput {
  return {
    scene_narrative: VISIT_FALLBACK_NARRATIVE,
    new_word: null,
  };
}
