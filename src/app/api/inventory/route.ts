/**
 * GET /api/inventory
 * 获取伙伴的行囊物品列表。
 */

import { NextResponse } from 'next/server';
import { findCompanionForSingleUser } from '@/lib/db/repos';
import { getInventory } from '@/lib/db/repos';

export const runtime = 'nodejs';

export async function GET() {
  const companion = await findCompanionForSingleUser();
  if (!companion) {
    return NextResponse.json({ error: 'No companion' }, { status: 404 });
  }

  const items = await getInventory(companion.id);

  // 按分类分组
  const grouped: Record<string, typeof items> = {};
  for (const item of items) {
    const cat = item.item_category;
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(item);
  }

  return NextResponse.json({
    items,
    grouped,
    total: items.length,
  });
}
