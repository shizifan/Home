/**
 * 广场剧本道具奖励引擎（PRD §14.3.2）
 *
 * 职责：
 *   1. 根据 LLM 给的 earned_items + 剧本 rewards 兜底（如果 LLM 漏了 always 列表）
 *   2. 落到 inventory_items：grantInventoryItem 已是幂等
 *   3. 道具升级触发（PRD §14.3.2）：连续 3 次 perfect 同类剧本 → 升级到 advanced 版
 *
 * 升级规则（V1.0 简化）：
 *   - 每个 knowledge 类道具的 ItemDef.upgrade_to 字段定义升级目标
 *   - 触发条件：本场 ending=perfect 且当幕 quality=natural 用了基础版道具，且历史已经至少
 *     用过该道具 N 次（默认 N=2 累计；本场是第 3 次）→ 替换为 upgrade_to
 *   - 实际写法：仅在 perfect + natural 同时满足时把 LLM 输出里的基础版替换升级版（如果 LLM 没主动给）
 */

import 'server-only';

import {
  countPlazaPlaysByScenario,
  grantInventoryItem,
} from '@/lib/db/repos';
import { getItemDef } from '@/lib/station/itemPool';
import type {
  ActChoice,
  EndingType,
  Scenario,
} from '@/types';

export interface RewardItemPayload {
  item_id: string;
  item_name: string;
  acquisition_reason: string;
  is_upgrade?: boolean;
}

/**
 * 计算最终奖励列表（合并 LLM 输出 + 剧本 rewards 兜底 + 升级触发）。
 *
 * @param scenario 剧本骨架
 * @param endingType 结局等级
 * @param choices 三幕选择（含 quality）
 * @param llmEarnedItems LLM 输出的 earned_items；可能为空
 * @returns 最终要发的奖励列表
 */
export function computeFinalRewards(
  scenario: Scenario,
  endingType: EndingType,
  choices: ActChoice[],
  llmEarnedItems: Array<{ item_id: string; item_name: string; acquisition_reason: string }>,
): RewardItemPayload[] {
  const out = new Map<string, RewardItemPayload>();

  // 1. always 列表必发
  for (const itemId of scenario.rewards.always) {
    const def = getItemDef(itemId);
    if (!def) continue;
    out.set(itemId, {
      item_id: itemId,
      item_name: def.name,
      acquisition_reason: '剧本完成的固定奖励。',
    });
  }

  // 2. 按 ending_type 取一档奖励
  const tier = scenario.rewards[endingType] ?? [];
  if (tier.length > 0) {
    const pickId = tier[0]; // 取首项（保证奖励确定性，避免随机给玩家不熟悉的）
    const def = getItemDef(pickId);
    if (def) {
      out.set(pickId, {
        item_id: pickId,
        item_name: def.name,
        acquisition_reason: `${
          endingType === 'perfect'
            ? '圆满结局的奖励。'
            : endingType === 'good'
              ? '基本成功的奖励。'
              : '勉强解决也获得的奖励。'
        }`,
      });
    }
  }

  // 3. LLM 输出的 earned_items 与上面的合并；reason 以 LLM 为准
  for (const e of llmEarnedItems) {
    const def = getItemDef(e.item_id);
    if (!def) continue; // 防 LLM 编造未知 id
    out.set(e.item_id, {
      item_id: e.item_id,
      item_name: e.item_name || def.name,
      acquisition_reason: e.acquisition_reason,
      is_upgrade: out.get(e.item_id)?.is_upgrade ?? false,
    });
  }

  // 4. 升级触发（perfect + 用了 knowledge 基础版且 quality=natural）
  //    把基础版从结果里换成 upgrade_to
  if (endingType === 'perfect') {
    for (const c of choices) {
      if (!c.item_id || c.quality !== 'natural') continue;
      const def = getItemDef(c.item_id);
      if (!def?.upgrade_to) continue;
      const upgradeDef = getItemDef(def.upgrade_to);
      if (!upgradeDef) continue;
      // 把基础版 entry 替换为升级版 entry
      out.delete(c.item_id);
      out.set(upgradeDef.id, {
        item_id: upgradeDef.id,
        item_name: upgradeDef.name,
        acquisition_reason: `你这次完美用上了《${def.name}》——它升级成了《${upgradeDef.name}》。`,
        is_upgrade: true,
      });
    }
  }

  return Array.from(out.values());
}

/**
 * 奖励落库：把 RewardItemPayload 列表写到 inventory_items。
 * 返回每件实际写入的 row id（已存在则返回现有行）。
 */
export async function grantRewards(
  companionId: string,
  scenarioId: string,
  rewards: RewardItemPayload[],
): Promise<Array<{ item_id: string; inventory_row_id: string; created: boolean }>> {
  const out: Array<{ item_id: string; inventory_row_id: string; created: boolean }> = [];
  for (const r of rewards) {
    const def = getItemDef(r.item_id);
    if (!def) continue;
    const { row, created } = await grantInventoryItem({
      companionId,
      itemId: r.item_id,
      itemName: r.item_name,
      itemCategory: def.category,
      itemDescription: def.description,
      itemDetailedDescription: def.detailed_description,
      acquiredFrom: `plaza_reward:${scenarioId}:${r.is_upgrade ? 'upgrade' : 'normal'}`,
    });
    out.push({ item_id: r.item_id, inventory_row_id: row.id, created });
  }
  return out;
}

/**
 * 给"第 N 次玩同剧本"产出 PRD §14.5.3 的特殊台词。
 * 第 2 次：「这次试试不一样的道具？」
 * 第 3 次：「我每次都能想出不同的办法。」
 * 第 1 次：null（不出现）
 */
export async function getRepeatPlayHint(
  companionId: string,
  scenarioId: string,
): Promise<string | null> {
  const playedTimes = await countPlazaPlaysByScenario(companionId, scenarioId);
  if (playedTimes >= 2) return '我每次都能想出不同的办法。';
  if (playedTimes >= 1) return '这次试试不一样的道具？';
  return null;
}
