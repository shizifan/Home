/**
 * GET /api/station/plaza/prepare
 *
 * 进入广场准备页时调用：
 *   1. 校验：companion 已毕业 + school_count >= 1（plaza 解锁）
 *   2. 选今日剧本（哈希 + 排除最近 2 次玩过的）
 *   3. 角色分配（剧本骨架自带 roles）
 *   4. 第一次进 plaza → 触发新手礼包（PRD §14.3.2 starter pack）
 *   5. 返回：剧本元数据 + 角色 + 当前行囊（按类别分组）
 *
 * 注意：本接口本身**不**消耗 trip_id，不创建 plaza_play；
 * 实际出发由 P5-T 的 /api/station/plaza/play 处理。
 */

import { NextResponse } from 'next/server';

import {
  countPlazaPlaysByScenario,
  findCompanionForSingleUser,
  getCompanionById,
  listInventory,
  listRecentPlazaScenarios,
} from '@/lib/db/repos';
import { getStationStatus } from '@/lib/station/status';
import { pickScenarioByDate } from '@/lib/station/scenarios';
import { assignRoles } from '@/lib/station/roleAssigner';
import {
  grantStarterPack,
  inventoryItemToDef,
} from '@/lib/orchestrate/grantInventory';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const cid = url.searchParams.get('companion_id');
  const companion = cid
    ? await getCompanionById(cid)
    : await findCompanionForSingleUser();
  if (!companion) {
    return NextResponse.json({ error: 'no_companion' }, { status: 404 });
  }

  const status = await getStationStatus(companion.id);
  if (!status.graduated) {
    return NextResponse.json({ error: 'not_graduated' }, { status: 400 });
  }
  if (!status.unlocked.plaza) {
    return NextResponse.json(
      { error: 'locked:plaza', hint: '先去 1 次学校再来玩广场' },
      { status: 400 },
    );
  }

  // 第一次进 plaza 准备页（任何剧本都没玩过）→ 发新手礼包
  const recent = await listRecentPlazaScenarios(companion.id, 5);
  let starterGranted: Awaited<ReturnType<typeof grantStarterPack>> | null = null;
  if (recent.length === 0) {
    starterGranted = await grantStarterPack(companion.id);
  }

  const scenario = pickScenarioByDate(companion.preset_id, recent.slice(0, 2));
  const roles = assignRoles(scenario);
  const playedTimes = await countPlazaPlaysByScenario(
    companion.id,
    scenario.id,
  );

  const inventoryRows = await listInventory(companion.id);
  const items = inventoryRows.map(inventoryItemToDef);

  return NextResponse.json({
    today_used: status.today_used,
    scenario: {
      id: scenario.id,
      title: scenario.title,
      type: scenario.type,
      background: scenario.background,
      intro: scenario.intro,
      played_times: playedTimes, // 之前玩过几次（含本次之前）
    },
    roles: roles.map((r) => ({
      preset_id: r.preset_id,
      role: r.role,
      name: r.preset?.name ?? r.preset_id,
      appearance: r.preset?.appearance ?? '',
    })),
    inventory: {
      items,
      grouped: {
        knowledge: items.filter((i) => i.category === 'knowledge'),
        object: items.filter((i) => i.category === 'object'),
        gift: items.filter((i) => i.category === 'gift'),
        ability: items.filter((i) => i.category === 'ability'),
      },
    },
    applicable_item_ids: scenario.applicable_items, // 本次剧本适配道具，前端可标"高亮"
    starter_pack_granted: starterGranted?.map((g) => g.item_id) ?? null,
  });
}
