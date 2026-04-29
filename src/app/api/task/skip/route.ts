/**
 * POST /api/task/skip
 * 写一条 type='skipped' 的 memory + 触发 Pass 1（写 set_aside）+ Pass 2 简短台词。
 */

import { NextResponse } from 'next/server';

import { processInput } from '@/lib/orchestrate/processInput';
import { getCompanionById } from '@/lib/db/repos';
import { getTaskByDay } from '@/lib/tasks';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const companionId: string = body.companion_id;
    const taskId: string = body.task_id;
    if (!companionId || !taskId) {
      return NextResponse.json({ error: 'missing fields' }, { status: 400 });
    }

    const companion = await getCompanionById(companionId);
    if (!companion) return NextResponse.json({ error: 'not found' }, { status: 404 });
    const task = getTaskByDay(companion.current_day);
    if (!task || task.id !== taskId) {
      return NextResponse.json({ error: 'task mismatch' }, { status: 400 });
    }

    const result = await processInput({
      companionId,
      taskId,
      taskQuestion: task.description,
      inputType: 'skipped',
    });

    return NextResponse.json({
      memory_update: {
        action: result.pass1.action,
        concept: result.pass1.concept_name,
        memory_bank_id: result.memoryBankId,
      },
      companion_response: result.pass2Reply,
      response_source: result.pass2Source,
    });
  } catch (err) {
    console.error('[/api/task/skip]', err);
    return NextResponse.json(
      { error: (err as Error)?.message ?? 'internal error' },
      { status: 500 },
    );
  }
}
