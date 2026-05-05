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
  listMemoriesByDay,
} from '@/lib/db/repos';
import { getCompanionPreset } from '@/lib/companionPresets';
import { getTaskByDay } from '@/lib/tasks';
import { openingLineFallback, runOpeningLine } from '@/lib/llm/openingLine';
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

  // PRD §5.6 各天伙伴开场白：
  //   Day 7 固定文案（不调 LLM）
  //   Day 2-6 LLM 基于昨天输入生成；失败回退 personality_examples[0]
  const preset = getCompanionPreset(companion.preset_id as never);
  let opening: string | null = null;
  let openingSource = `preset_open_day${nextDay}`;

  if (nextDay === 7) {
    opening = '我已经在小家住满 7 天了。这一周你告诉了我好多事，我也整理了好多记忆——我想给你看看，我现在眼中的世界是什么样的。你看看对不对？';
    openingSource = 'preset_day7_fixed';
  } else if (nextDay >= 2 && preset) {
    // 拉昨天孩子的输入做 LLM 引子
    const prevMems = await listMemoriesByDay(
      companion.id,
      companion.current_day as DayNumber,
    );
    try {
      const r = await runOpeningLine(
        { companion: preset, day: nextDay, prevDayMemories: prevMems },
        companion.id,
      );
      if (r.success) {
        opening = r.data.opening;
        openingSource = `llm_open_day${nextDay}`;
      }
    } catch {
      /* 回退到下方 fallback */
    }
    if (!opening) {
      opening = openingLineFallback(preset);
      openingSource = `fallback_open_day${nextDay}`;
    }
  }

  if (opening) {
    await insertCompanionLine({
      companionId: companion.id,
      day: nextDay,
      content: opening,
      source: openingSource,
    });
  }

  return NextResponse.json({
    ok: true,
    new_day: nextDay,
    opening,
    opening_source: openingSource,
  });
}
