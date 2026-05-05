/**
 * GET /api/station/status
 * 返回当前 companion 的驿站解锁状态 + 当日出行限流。
 *
 * 用于：/station 地图页、毕业后的主页 "出门探索" 按钮。
 */

import { NextResponse } from 'next/server';
import { findCompanionForSingleUser, getCompanionById } from '@/lib/db/repos';
import { getStationStatus } from '@/lib/station/status';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const cid = url.searchParams.get('companion_id');
  const companion = cid
    ? await getCompanionById(cid)
    : await findCompanionForSingleUser();
  if (!companion) {
    return NextResponse.json({ error: 'no companion' }, { status: 404 });
  }
  const status = await getStationStatus(companion.id);
  return NextResponse.json({
    companion_id: companion.id,
    ...status,
  });
}
