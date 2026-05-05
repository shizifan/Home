/**
 * GET /api/station/trip/[id]
 * 查 trip 完整状态与报告（含 host_meta / new_word / narrative）。
 *
 * 用于 traveling 页轮询、report 页拉取。
 */

import { NextResponse } from 'next/server';
import { getTripById } from '@/lib/db/repos';

export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const trip = await getTripById(id);
  if (!trip) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  return NextResponse.json({ trip });
}
