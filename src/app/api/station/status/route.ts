/**
 * GET /api/station/status
 * 返回伙伴的驿站解锁状态。
 */

import { NextResponse } from 'next/server';
import { findCompanionForSingleUser } from '@/lib/db/repos';
import { getStationUnlockStatus } from '@/lib/station/unlock';

export const runtime = 'nodejs';

export async function GET() {
  const companion = await findCompanionForSingleUser();
  if (!companion) {
    return NextResponse.json({ error: 'No companion' }, { status: 404 });
  }

  const status = await getStationUnlockStatus(companion.id);

  return NextResponse.json({
    ...status,
    visit_count: companion.visit_count,
    school_count: companion.school_count,
    plaza_count: companion.plaza_count,
  });
}
