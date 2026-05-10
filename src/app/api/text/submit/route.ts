/**
 * POST /api/text/submit
 * JSON body: { companion_id, task_id, user_text }
 */

import { NextResponse } from 'next/server';

import { processInput } from '@/lib/orchestrate/processInput';
import { getCompanionById } from '@/lib/db/repos';
import { getTaskByDay } from '@/lib/tasks';
import { resolveCurrentUser } from '@/lib/auth/session';
import {
  assertCompanionOwnedByUser,
  NotFoundOrForbiddenError,
} from '@/lib/auth/ownership';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const companionId: string = body.companion_id;
    const taskId: string = body.task_id;
    const text: string = (body.user_text ?? '').toString().trim();

    if (!companionId || !taskId) {
      return NextResponse.json({ error: 'missing fields' }, { status: 400 });
    }
    if (!text) {
      return NextResponse.json({ error: 'empty text' }, { status: 400 });
    }
    if (text.length > 500) {
      return NextResponse.json({ error: 'text too long' }, { status: 400 });
    }

    const user = await resolveCurrentUser();
    if (!user) return NextResponse.json({ error: 'no_user' }, { status: 401 });
    try {
      await assertCompanionOwnedByUser(companionId, user.id);
    } catch (e) {
      if (e instanceof NotFoundOrForbiddenError) {
        return NextResponse.json({ error: 'not_found' }, { status: 404 });
      }
      throw e;
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
      inputType: 'text',
      userText: text,
    });

    return NextResponse.json({
      memory_update: {
        action: result.pass1.action,
        concept: result.pass1.concept_name,
        reasoning: result.pass1.ai_reasoning,
        memory_bank_id: result.memoryBankId,
      },
      companion_response: result.pass2Reply,
      response_source: result.pass2Source,
    });
  } catch (err) {
    console.error('[/api/text/submit]', err);
    return NextResponse.json(
      { error: (err as Error)?.message ?? 'internal error' },
      { status: 500 },
    );
  }
}
