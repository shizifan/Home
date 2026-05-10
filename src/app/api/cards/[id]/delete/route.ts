/**
 * POST /api/cards/[id]/delete
 *
 * 软删除一张卡片：把 cards.is_active 置 0，让它从墙上消失。
 * memory + memory_bank 不动，孩子说过的话仍然保留。
 */

import { NextResponse } from 'next/server';

import { getCardById, setCardInactive } from '@/lib/db/cardsRepo';
import { resolveCurrentUser } from '@/lib/auth/session';
import {
  assertCompanionOwnedByUser,
  NotFoundOrForbiddenError,
} from '@/lib/auth/ownership';

export const runtime = 'nodejs';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'missing id' }, { status: 400 });
    }
    const card = await getCardById(id);
    if (!card) {
      return NextResponse.json({ error: 'not found' }, { status: 404 });
    }
    // P6 Ownership 校验
    const user = await resolveCurrentUser();
    if (!user) return NextResponse.json({ error: 'no_user' }, { status: 401 });
    try {
      await assertCompanionOwnedByUser(card.companion_id, user.id);
    } catch (e) {
      if (e instanceof NotFoundOrForbiddenError) {
        return NextResponse.json({ error: 'not_found' }, { status: 404 });
      }
      throw e;
    }
    await setCardInactive(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[/api/cards/:id/delete]', err);
    return NextResponse.json(
      { error: (err as Error)?.message ?? 'internal error' },
      { status: 500 },
    );
  }
}
