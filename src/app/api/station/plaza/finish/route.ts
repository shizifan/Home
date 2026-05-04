/**
 * POST /api/station/plaza/finish
 * 广场角色扮演结局生成。
 * 
 * 请求体：{
 *   companion_id: string,    // 可为空字符串，服务端自动解析
 *   trip_id: string,
 *   plaza_play_id: string,   // 可为空字符串，服务端自动创建
 *   scenario_id: string,
 *   all_acts: ActChoice[]
 * }
 */

import { NextResponse } from 'next/server';
import { findCompanionForSingleUser, createPlazaPlay, getTripById } from '@/lib/db/repos';
import { processPlazaEnding } from '@/lib/orchestrate/processPlaza';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { companion_id, trip_id, plaza_play_id, scenario_id, all_acts } = body;

  if (!trip_id || !scenario_id) {
    return NextResponse.json({ error: 'Missing trip_id or scenario_id' }, { status: 400 });
  }

  if (!Array.isArray(all_acts) || all_acts.length !== 3) {
    return NextResponse.json({ error: 'all_acts must contain exactly 3 acts' }, { status: 400 });
  }

  // 解析 companion（如果前端传空字符串，从单用户解析）
  const companion = await findCompanionForSingleUser();
  if (!companion) {
    return NextResponse.json({ error: 'No companion found' }, { status: 404 });
  }

  // 解析或创建 plaza_play
  let playId = plaza_play_id && plaza_play_id.trim() !== '' ? plaza_play_id : '';
  if (!playId) {
    // 查找是否已有该 trip 的 plaza_play
    const trip = await getTripById(trip_id);
    if (trip?.plaza_play_id) {
      playId = trip.plaza_play_id;
    } else {
      const play = await createPlazaPlay({
        companionId: companion.id,
        tripId: trip_id,
        scenarioId: scenario_id,
      });
      playId = play.id;
    }
  }

  try {
    const result = await processPlazaEnding({
      companionId: companion.id,
      tripId: trip_id,
      plazaPlayId: playId,
      scenarioId: scenario_id,
      allActs: all_acts,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error('plaza finish failed:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
