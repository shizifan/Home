/**
 * GET /api/station/status
 * 返回当前 companion 的驿站解锁状态 + 当日出行限流。
 *
 * 用于：/station 地图页、毕业后的主页 "出门探索" 按钮。
 */

import { NextResponse } from 'next/server';
import { getStationStatus } from '@/lib/station/status';
import { guardWithCompanion, guardErrorResponse } from '@/lib/auth/apiGuard';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const cid = url.searchParams.get('companion_id');
  const guard = await guardWithCompanion(cid);
  if (!guard.ok) return guardErrorResponse(guard.code);
  const status = await getStationStatus(guard.companion.id);
  return NextResponse.json({
    companion_id: guard.companion.id,
    ...status,
  });
}
