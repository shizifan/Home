/**
 * Day N 伙伴开场白生成（PRD §5.6 各天 "伙伴开场白" 段）
 *
 * 调用时机：advance API 把 current_day 从 N-1 推到 N 时，为 N ≥ 2 生成一条引子。
 * Day 1 用预设 personality_examples[0]（onboarding 已写入）；Day 7 用固定文案；
 * 这里只处理 Day 2–6。
 *
 * 失败：1 次重试都失败 → 调用方回退到 personality_examples[0]。
 */

import 'server-only';

import { z } from 'zod';
import { callLLM } from './client';
import { parseJsonStrict } from './validators';
import { renderPrompt } from './promptLoader';
import type { CompanionPresetMeta } from '@/lib/companionPresets';
import type { Memory } from '@/types';

const DAY_THEMES: Record<number, string> = {
  2: '这是我们家',
  3: '我们去过的地方',
  4: '我喜欢的事',
  5: '它问你的问题',
  6: '整理与补充',
};

const OpeningSchema = z.object({
  opening: z.string().min(2).max(60),
});

export interface OpeningLineInput {
  companion: CompanionPresetMeta;
  /** 当前要进入的 day（2-6）*/
  day: number;
  /** 昨天的孩子输入（按时间倒序前几条；含描述/选择/跳过等都行）*/
  prevDayMemories: Memory[];
}

function summarizePrevDay(memories: Memory[]): string {
  if (!memories || memories.length === 0) return '（昨天没说话 / 跳过了）';
  const parts: string[] = [];
  for (const m of memories.slice(0, 5)) {
    const t = m.user_text || m.edited_text || m.asr_transcription;
    if (t) {
      parts.push(`- ${m.type}: ${String(t).slice(0, 80)}`);
    } else if (m.type === 'skipped') {
      parts.push(`- 跳过`);
    } else {
      parts.push(`- ${m.type} (无文字)`);
    }
  }
  return parts.join('\n');
}

export async function runOpeningLine(input: OpeningLineInput, companionId?: string) {
  if (input.day < 2 || input.day > 6) {
    throw new Error(`runOpeningLine: day=${input.day} 不在 2-6 范围内`);
  }
  const personalityExamples = input.companion.personality_examples
    .map((s) => `- ${s}`)
    .join('\n');

  const systemPrompt = renderPrompt(
    'opening_line',
    {
      name: input.companion.name,
      appearance: input.companion.appearance,
      personality: input.companion.personality,
      personality_examples: personalityExamples,
      day: String(input.day),
      prev_day: String(input.day - 1),
      theme: DAY_THEMES[input.day] ?? '',
      prev_day_summary: summarizePrevDay(input.prevDayMemories),
    },
  );

  return callLLM<{ opening: string }>({
    callType: 'opening_line',
    systemPrompt,
    userPrompt: '请输出 JSON。',
    expectJson: true,
    parse: (raw) => parseJsonStrict(raw, OpeningSchema),
    companionId,
    promptVersion: 'opening_v1',
    maxRetries: 1,
  });
}

/** 通用回退：用预设第 0 条性格示例（Day 1 也是这个） */
export function openingLineFallback(companion: CompanionPresetMeta): string {
  return companion.personality_examples[0] ?? '今天好啊。';
}
