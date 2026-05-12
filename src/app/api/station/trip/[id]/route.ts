/**
 * GET /api/station/trip/[id]
 * 查 trip 完整状态与报告（含 host_meta / new_word / narrative）。
 *
 * 用于 traveling 页轮询、report 页拉取。
 */

import { NextResponse } from 'next/server';
import { getTripById } from '@/lib/db/repos';
import { guardUserOnly, guardErrorResponse } from '@/lib/auth/apiGuard';
import { assertCompanionOwnedByUser, NotFoundOrForbiddenError } from '@/lib/auth/ownership';

export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const g = await guardUserOnly();
  if (!g.ok) return guardErrorResponse(g.code);

  const { id } = await params;
  const trip = await getTripById(id);
  if (!trip) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  try {
    await assertCompanionOwnedByUser(trip.companion_id, g.user.id);
  } catch (e) {
    if (e instanceof NotFoundOrForbiddenError) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    throw e;
  }
  return NextResponse.json({ trip });
}
