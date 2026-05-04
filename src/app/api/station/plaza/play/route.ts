/**
 * POST /api/station/plaza/play
 * 广场角色扮演单幕执行。companion_id 可为空，服务端自动解析。
 * 
 * 请求体：{
 *   companion_id: string,     // 可为空字符串
 *   scenario_id: string,
 *   act_number: 1 | 2 | 3,
 *   selected_item_id: string | null,
 *   selected_item_name?: string,
 *   previous_acts: ActChoice[]
 * }
 */

import { NextResponse } from 'next/server';
import { findCompanionForSingleUser } from '@/lib/db/repos';
import { processPlazaAct } from '@/lib/orchestrate/processPlaza';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { companion_id, scenario_id, act_number, selected_item_id, selected_item_name, previous_acts } = body;

  if (!scenario_id || !act_number) {
    return NextResponse.json({ error: 'Missing scenario_id or act_number' }, { status: 400 });
  }

  if (![1, 2, 3].includes(act_number)) {
    return NextResponse.json({ error: 'act_number must be 1, 2, or 3' }, { status: 400 });
  }

  // 解析 companion
  const companion = await findCompanionForSingleUser();
  if (!companion) {
    return NextResponse.json({ error: 'No companion found' }, { status: 404 });
  }

  try {
    const result = await processPlazaAct({
      companionId: companion.id,
      scenarioId: scenario_id,
      actNumber: act_number,
      selectedItemId: selected_item_id || null,
      selectedItemName: selected_item_name,
      previousActs: previous_acts || [],
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error('plaza play failed:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
