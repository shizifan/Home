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
