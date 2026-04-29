/**
 * POST /api/companion/advance
 * 把伙伴推到下一天。校验：当日任务必须已完成（含跳过）。
 * Day 7 完成后不再推进，引导到 worldview。
 */

import { NextResponse } from 'next/server';
import {
  advanceCompanionDay,
  findCompanionForSingleUser,
  insertCompanionLine,
  isTaskDoneToday,
} from '@/lib/db/repos';
import { getCompanionPreset } from '@/lib/companionPresets';
import { getTaskByDay } from '@/lib/tasks';
import type { DayNumber } from '@/types';

export const runtime = 'nodejs';

export async function POST() {
  const companion = await findCompanionForSingleUser();
  if (!companion) {
    return NextResponse.json({ error: 'no companion' }, { status: 404 });
  }

  if (companion.current_day >= 7) {
    return NextResponse.json({ error: 'already at day 7' }, { status: 400 });
  }

  const todayTask = getTaskByDay(companion.current_day);
  if (!todayTask) {
    return NextResponse.json({ error: 'no task for today' }, { status: 500 });
  }

  const done = await isTaskDoneToday(
    companion.id,
    companion.current_day as DayNumber,
    todayTask.id,
  );
  if (!done) {
    return NextResponse.json({ error: 'today task not done yet' }, { status: 400 });
  }

  const nextDay = (companion.current_day + 1) as DayNumber;
  await advanceCompanionDay(companion.id, nextDay);

  // 写入下一天的伙伴开场白（按 PRD §11.3 各天主题）
  const opening = getOpeningLine(companion.preset_id, nextDay);
  if (opening) {
    await insertCompanionLine({
      companionId: companion.id,
      day: nextDay,
      content: opening,
      source: `preset_open_day${nextDay}`,
    });
  }

  return NextResponse.json({
    ok: true,
    new_day: nextDay,
    opening,
  });
}

/**
 * 各天的伙伴开场白
 * Day 1 用 preset.personality_examples[0]（已经在 onboarding 时写入）
 * Day 2-6 用通用的回归台词，等 P4-8 接入更精细的回归文案
 * Day 7 用 PRD §11.3 Day 7 的固定文案
 */
function getOpeningLine(presetId: string, day: DayNumber): string | null {
  if (day === 7) {
    return '我已经在小家住满 7 天了。这一周你告诉了我好多事，我也整理了好多记忆——我想给你看看，我现在眼中的世界是什么样的。你看看对不对？';
  }
  const preset = getCompanionPreset(presetId as never);
  if (!preset) return null;
  // 使用 personality_examples[0]（与 Day 1 同源，作为各天的"问候开场"）
  return preset.personality_examples[0] ?? null;
}
