/**
 * GET /api/inventory/:id
 * 获取单个物品详情。
 */

import { NextResponse } from 'next/server';
import { queryOne } from '@/lib/db/client';
import type { InventoryItem } from '@/types';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const item = await queryOne<InventoryItem>(
    `select * from inventory_items where id = $1 or item_id = $1 limit 1`,
    [id],
  );

  if (!item) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 });
  }

  return NextResponse.json(item);
}
