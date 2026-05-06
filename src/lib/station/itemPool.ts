/**
 * 道具池静态数据 loader（PRD §14.3 + 附录 D）
 *
 * 4 类共 27 件道具。代码资产，不入主库表。
 */

import 'server-only';

import knowledge from '../../../data/items/knowledge.json';
import object_ from '../../../data/items/object.json';
import gift from '../../../data/items/gift.json';
import ability from '../../../data/items/ability.json';

import type { ItemCategory, ItemDef } from '@/types';

interface ItemFile {
  category: ItemCategory;
  items: ItemDef[];
}

const FILES: ItemFile[] = [
  knowledge as unknown as ItemFile,
  object_ as unknown as ItemFile,
  gift as unknown as ItemFile,
  ability as unknown as ItemFile,
];

const ALL_ITEMS: Array<ItemDef & { category: ItemCategory }> = FILES.flatMap(
  (f) => f.items.map((i) => ({ ...i, category: f.category })),
);

const BY_ID = new Map(ALL_ITEMS.map((i) => [i.id, i]));

export function getItemDef(itemId: string): (ItemDef & { category: ItemCategory }) | undefined {
  return BY_ID.get(itemId);
}

export function listItems(): Array<ItemDef & { category: ItemCategory }> {
  return ALL_ITEMS;
}

export function listItemsByCategory(
  category: ItemCategory,
): Array<ItemDef & { category: ItemCategory }> {
  return ALL_ITEMS.filter((i) => i.category === category);
}

/** 新手大礼包（PRD §14.3.2）— 第一次玩广场前发的 3 件基础道具 */
export const STARTER_PACK_IDS: string[] = [
  'treatise_water_control_basic', // 《治水图》
  'object_money', // 一袋金子
  'object_wine', // 一壶酒
];
