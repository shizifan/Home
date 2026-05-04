/**
 * POST /api/station/depart
 * 出发去驿站（朋友家/学校/广场）。
 * 
 * 请求体：{
 *   trip_type: 'visit' | 'school' | 'plaza',
 *   purpose_type?: string,
 *   purpose_question?: string,
 *   selected_items?: string[],
 *   scenario_id?: string
 * }
 */

import { NextResponse } from 'next/server';
import { findCompanionForSingleUser, createTrip, incrementStationCounter } from '@/lib/db/repos';
import { getStationUnlockStatus } from '@/lib/station/unlock';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const companion = await findCompanionForSingleUser();
  if (!companion) {
    return NextResponse.json({ error: 'No companion' }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const { trip_type, purpose_type, purpose_question, selected_items, scenario_id } = body;

  // 校验出行类型
  if (!trip_type || !['visit', 'school', 'plaza'].includes(trip_type)) {
    return NextResponse.json({ error: 'Invalid trip_type' }, { status: 400 });
  }

  // 检查解锁和出行次数
  const status = await getStationUnlockStatus(companion.id);

  if (trip_type === 'visit' && !status.friendHouseUnlocked) {
    return NextResponse.json({ error: '朋友家未解锁' }, { status: 403 });
  }
  if (trip_type === 'school' && !status.schoolUnlocked) {
    return NextResponse.json({ error: '学校未解锁' }, { status: 403 });
  }
  if (trip_type === 'plaza' && !status.plazaUnlocked) {
    return NextResponse.json({ error: '广场未解锁' }, { status: 403 });
  }

  if (status.dailyDeparturesRemaining <= 0) {
    return NextResponse.json({ error: '今天已经出过门了' }, { status: 403 });
  }

  // 广场必须提供 scenario_id
  if (trip_type === 'plaza' && !scenario_id) {
    return NextResponse.json({ error: 'scenario_id is required for plaza' }, { status: 400 });
  }

  // 创建 trip 记录
  const trip = await createTrip({
    companionId: companion.id,
    tripType: trip_type,
    purposeType: purpose_type,
    purposeQuestion: purpose_question,
  });

  // 递增计数器（根据 trip 类型）
  const counterColumn = trip_type === 'visit' ? 'visit_count'
    : trip_type === 'school' ? 'school_count'
    : 'plaza_count';
  await incrementStationCounter(companion.id, counterColumn as 'visit_count' | 'school_count' | 'plaza_count');

  return NextResponse.json({
    trip_id: trip.id,
    status: 'traveling',
    trip_type,
    scenario_id,
    selected_items,
  });
}
