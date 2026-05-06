/**
 * 学校课堂 LLM 调用（PRD §13 / §23.11）
 *
 * 输入：班级（visitor + 其他 2‑4 只伙伴的 memory_bank 摘要）+ 当日问题 + 目的
 * 输出：每只伙伴的 ≤20 字回答 + highlight + teaching_moment
 *
 * 失败：2 次重试都失败 → 上层调用方写占位文案到 trip.report_data
 */

import 'server-only';

import { z } from 'zod';
import { callLLM, type LLMResult } from './client';
import { parseJsonStrict } from './validators';
import { renderPrompt, loadFewShotJSON } from './promptLoader';
import {
  renderPresetMemorySummary,
  type PresetCompanion,
} from '@/lib/station/presetCompanions';
import type { MemoryBankEntry, SchoolPurposeType } from '@/types';

const AnswerSchema = z.object({
  companion_name: z.string().min(1).max(20),
  answer: z.string().min(1).max(60),
});

export const SchoolOutputSchema = z.object({
  question: z.string().min(2).max(120),
  answers: z.array(AnswerSchema).min(2).max(8),
  highlight: z.string().min(2).max(80),
  teaching_moment: z.string().min(0).max(80).nullable(),
});

export type SchoolOutput = z.infer<typeof SchoolOutputSchema>;

/** 班级中每个伙伴的输入：preset 信息 + memory_bank 摘要文本 */
export interface ClassmateInput {
  presetId: string;
  name: string;
  appearance: string;
  personality: string;
  /** 已经渲染好的 memory_bank 摘要（system_preset 用 renderPresetMemorySummary，
   * visitor 自己用真实 memory_bank 拼） */
  memorySummary: string;
}

export interface SchoolInput {
  classmates: ClassmateInput[];
  visitorName: string;
  visitorPresetId: string;
  question: string;
  classPurpose: SchoolPurposeType;
  teachingMomentsPool: string[];
}

function classmatesBlock(classmates: ClassmateInput[]): string {
  return classmates
    .map(
      (c) =>
        `### ${c.name}（${c.personality}）\n外形：${c.appearance}\n${c.memorySummary}\n`,
    )
    .join('\n');
}

export async function runSchool(
  input: SchoolInput,
  companionId?: string,
): Promise<LLMResult<SchoolOutput>> {
  const fewShot = loadFewShotJSON('school/examples.json');

  const systemPrompt = renderPrompt(
    'school',
    {
      class_purpose: input.classPurpose,
      question: input.question,
      visitor_name: input.visitorName,
      companions_block: classmatesBlock(input.classmates),
      teaching_moments_pool: input.teachingMomentsPool
        .map((s, i) => `${i + 1}. ${s}`)
        .join('\n'),
    },
    fewShot,
  );

  return callLLM<SchoolOutput>({
    callType: 'school',
    systemPrompt,
    userPrompt: '请输出 JSON。',
    expectJson: true,
    parse: (raw) => {
      const data = parseJsonStrict(raw, SchoolOutputSchema);
      if (!data) return null;
      // 校验：answers 必须覆盖在场所有伙伴
      const present = new Set(input.classmates.map((c) => c.name));
      const responded = new Set(data.answers.map((a) => a.companion_name));
      for (const n of present) {
        if (!responded.has(n)) {
          // 缺人 — LLM 漏答了某只伙伴，重试
          return null;
        }
      }
      return data;
    },
    companionId,
    promptVersion: 'school_v1',
    maxRetries: 1,
  });
}

/** 构造拜访者自己的 memory_bank 摘要文本（与 PresetCompanion 同形态） */
export function renderVisitorMemorySummary(bank: MemoryBankEntry[]): string {
  const remembered = bank
    .filter((m) => m.type === 'remembered')
    .slice(0, 12)
    .map(
      (m) =>
        `- 【${m.concept_category ?? 'other'}】${m.concept_name}：${m.ai_summary ?? ''}`,
    )
    .join('\n');
  const unknown = bank
    .filter((m) => m.type === 'unknown')
    .slice(0, 8)
    .map((m) => `- ${m.concept_name}`)
    .join('\n');
  return [
    '【已知】',
    remembered || '（暂无）',
    '',
    '【完全不知道的事】',
    unknown || '（暂无）',
  ].join('\n');
}

/** 把 PresetCompanion 转成 ClassmateInput */
export function presetToClassmate(p: PresetCompanion): ClassmateInput {
  return {
    presetId: p.preset_id,
    name: p.name,
    appearance: p.appearance,
    personality: p.personality,
    memorySummary: renderPresetMemorySummary(p),
  };
}

/** 失败兜底叙事 */
export function schoolFallbackOutput(
  question: string,
  classmateNames: string[],
): SchoolOutput {
  return {
    question,
    answers: classmateNames.map((n) => ({
      companion_name: n,
      answer: '今天有点累了，没想好。',
    })),
    highlight: '它们今天没说太多。',
    teaching_moment: null,
  };
}
