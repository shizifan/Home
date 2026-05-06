/**
 * 行囊授予服务（PRD §14.3.2 道具获取）
 *
 * 几种触发：
 *   - 'starter_pack' — 第一次玩广场前发的 3 件基础道具
 *   - 'plaza_reward:{scenario_id}:{ending_type}' — 广场剧本结束后按结局发的奖励
 *   - 'manual:{tag}' — 后台 / 调试授予
 */

import 'server-only';

import { grantInventoryItem, type GrantItemInput } from '@/lib/db/repos';
import { getItemDef, STARTER_PACK_IDS } from '@/lib/station/itemPool';
import type { InventoryItem } from '@/types';

export interface GrantResult {
  item_id: string;
  inventory_row_id: string;
  created: boolean;
  /** undefined 表示 itemPool 里查不到该 id（应该报告） */
  item_name?: string;
}

export async function grantItem(
  companionId: string,
  itemId: string,
  acquiredFrom: string,
): Promise<GrantResult> {
  const def = getItemDef(itemId);
  if (!def) {
    throw new Error(`grantItem: unknown item_id "${itemId}"`);
  }
  const input: GrantItemInput = {
    companionId,
    itemId,
    itemName: def.name,
    itemCategory: def.category,
    itemDescription: def.description,
    itemDetailedDescription: def.detailed_description,
    acquiredFrom,
  };
  const { row, created } = await grantInventoryItem(input);
  return {
    item_id: itemId,
    inventory_row_id: row.id,
    created,
    item_name: def.name,
  };
}

/** 新手大礼包（PRD §14.3.2）— 第一次玩广场前发 3 件基础道具 */
export async function grantStarterPack(
  companionId: string,
): Promise<GrantResult[]> {
  const out: GrantResult[] = [];
  for (const itemId of STARTER_PACK_IDS) {
    out.push(await grantItem(companionId, itemId, 'starter_pack'));
  }
  return out;
}

/** 把 InventoryItem 行格式化为 ItemDef 风格（前端展示） */
export function inventoryItemToDef(row: InventoryItem) {
  return {
    id: row.id,
    item_id: row.item_id,
    name: row.item_name,
    category: row.item_category,
    description: row.item_description ?? '',
    detailed_description: row.item_detailed_description ?? '',
    icon: getItemDef(row.item_id)?.icon ?? '📦',
    use_count: row.use_count,
    last_used_at: row.last_used_at,
    acquired_at: row.acquired_at,
    acquired_from: row.acquired_from,
    is_upgraded_from: row.is_upgraded_from,
  };
}
