/**
 * 备用文案库（PRD §11.6 + §15.7.2）
 * 任何 LLM 失败到达上限即从这里取台词。
 */

import 'server-only';
import fallbacks from '@prompts/shared/fallbacks.json';
import type { CompanionPresetId } from '@/components/characters/types';

type FallbackData = typeof fallbacks;

export function pickFallbackPass2AfterPhoto(): string {
  const list = (fallbacks as FallbackData).vision_or_pass2_fail_after_photo;
  return list[Math.floor(Math.random() * list.length)];
}

export function pickFallbackPass2AfterText(): string {
  const list = (fallbacks as FallbackData).pass2_fail_after_text;
  return list[Math.floor(Math.random() * list.length)];
}

export function getSkipResponse(presetId: CompanionPresetId): string {
  const map = (fallbacks as FallbackData).skip_response_by_companion as Record<
    string,
    string
  >;
  return map[presetId] ?? '...好的。';
}

export function pickMissedDayLine(): string {
  const list = (fallbacks as FallbackData).missed_day_returns;
  return list[Math.floor(Math.random() * list.length)];
}

export function pickSessionResume(): string {
  const list = (fallbacks as FallbackData).session_resume;
  return list[Math.floor(Math.random() * list.length)];
}

export const AI_SELF_STATE_LINES =
  (fallbacks as FallbackData).ai_self_state_lines;

export const DAY7_FAIL_LINE =
  (fallbacks as FallbackData).day7_fail_after_3_retries;

/**
 * Pass 1 兜底：所有重试都失败时，写一条 set_aside 到 memory_bank。
 * 理由按 PRD §15.7.2：「我有点累，待会再整理这个」。
 */
export const PASS1_FAIL_REASONING = '我有点累，待会再整理这个。';
