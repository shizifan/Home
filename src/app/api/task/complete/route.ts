/**
 * POST /api/task/complete
 *
 * 标记 Day 6（纠正动作触发）/ Day 7（看完档案触发）任务完成。
 * 不走 LLM 链路；只写一条 memory 占位让 isTaskDoneToday 返回 true。
 *
 * 幂等：当天同一 task_id 多次调用安全，但仅第一次有意义（写多条无副作用）。
 *
 * body: { companion_id?, task_id }
 */

import { NextResponse } from 'next/server';

import {
  getCompanionById,
  isTaskDoneToday,
  markTaskCompleted,
} from '@/lib/db/repos';
import { getTaskByDay } from '@/lib/tasks';
import { guardWithCompanion, guardErrorResponse } from '@/lib/auth/apiGuard';
import type { DayNumber } from '@/types';

export const runtime = 'nodejs';

const VALID_TASK_IDS = new Set(['day6_review', 'day7_worldview']);
const MARKERS: Record<string, string> = {
  day6_review: '[memory_correct_done]',
  day7_worldview: '[worldview_viewed]',
};

export async function POST(req: Request) {
  let body: { companion_id?: string; task_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const taskId = body.task_id;
  if (!taskId || !VALID_TASK_IDS.has(taskId)) {
    return NextResponse.json(
      { error: 'invalid_task_id', allowed: Array.from(VALID_TASK_IDS) },
      { status: 400 },
    );
  }

  const guard = await guardWithCompanion(body.companion_id ?? null);
  if (!guard.ok) return guardErrorResponse(guard.code);
  const companion = await getCompanionById(guard.companion.id);
  if (!companion) {
    return NextResponse.json({ error: 'no_companion' }, { status: 404 });
  }

  const task = getTaskByDay(companion.current_day);
  if (!task || task.id !== taskId) {
    return NextResponse.json(
      { error: 'task_mismatch', current_day: companion.current_day },
      { status: 400 },
    );
  }

  // 已完成则直接返回（幂等）
  const already = await isTaskDoneToday(
    companion.id,
    companion.current_day as DayNumber,
    taskId,
  );
  if (already) {
    return NextResponse.json({ ok: true, action: 'noop_already_done' });
  }

  await markTaskCompleted({
    companionId: companion.id,
    day: companion.current_day as DayNumber,
    taskId,
    marker: MARKERS[taskId],
  });

  return NextResponse.json({ ok: true, action: 'marked_done' });
}
