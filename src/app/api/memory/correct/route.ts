/**
 * POST /api/memory/correct
 *
 * Body:
 * {
 *   memory_id: string,
 *   action: 'restore' | 'dismiss' | 'clarify' | 'rename' | 'merge' | 'inform' | 'withhold',
 *   params?: {
 *     clarification?: string,        // for clarify
 *     newName?: string,              // for rename
 *     targetMemoryId?: string,       // for merge
 *   }
 * }
 *
 * Response: { feedback: string, newType?: string, newConceptName?: string }
 */

import { NextResponse } from 'next/server';
import { correctMemory } from '@/lib/orchestrate/correctMemory';
import { findMemoryBankById } from '@/lib/db/repos';
import { resolveCurrentUser } from '@/lib/auth/session';
import {
  assertCompanionOwnedByUser,
  NotFoundOrForbiddenError,
} from '@/lib/auth/ownership';
import type { CorrectionAction } from '@/types';

export const runtime = 'nodejs';
export const maxDuration = 10;

const VALID_ACTIONS: CorrectionAction[] = [
  'restore',
  'dismiss',
  'clarify',
  'rename',
  'merge',
  'inform',
  'withhold',
];

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const memoryId: string = body.memory_id;
    const action: CorrectionAction = body.action;
    if (!memoryId) {
      return NextResponse.json({ error: 'missing memory_id' }, { status: 400 });
    }
    if (!VALID_ACTIONS.includes(action)) {
      return NextResponse.json({ error: 'invalid action' }, { status: 400 });
    }

    // P6 Ownership 校验：通过 memory_bank 行的 companion_id 反查
    const entry = await findMemoryBankById(memoryId);
    if (!entry) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    const user = await resolveCurrentUser();
    if (!user) return NextResponse.json({ error: 'no_user' }, { status: 401 });
    try {
      await assertCompanionOwnedByUser(entry.companion_id, user.id);
    } catch (e) {
      if (e instanceof NotFoundOrForbiddenError) {
        return NextResponse.json({ error: 'not_found' }, { status: 404 });
      }
      throw e;
    }

    const result = await correctMemory({
      memoryId,
      action,
      params: body.params,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error('[/api/memory/correct]', err);
    return NextResponse.json(
      { error: (err as Error)?.message ?? 'internal' },
      { status: 500 },
    );
  }
}
