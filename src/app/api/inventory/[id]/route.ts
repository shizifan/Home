/**
 * GET /api/inventory/[id]
 * 道具详情。id 是 inventory_items.id（不是 item_id）。
 */

import { NextResponse } from 'next/server';
import { findInventoryById } from '@/lib/db/repos';
import { inventoryItemToDef } from '@/lib/orchestrate/grantInventory';
import { getItemDef } from '@/lib/station/itemPool';
import { guardUserOnly, guardErrorResponse } from '@/lib/auth/apiGuard';
import { assertCompanionOwnedByUser, NotFoundOrForbiddenError } from '@/lib/auth/ownership';

export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const g = await guardUserOnly();
  if (!g.ok) return guardErrorResponse(g.code);

  const { id } = await params;
  const row = await findInventoryById(id);
  if (!row) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  try {
    await assertCompanionOwnedByUser(row.companion_id, g.user.id);
  } catch (e) {
    if (e instanceof NotFoundOrForbiddenError) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    throw e;
  }
  const view = inventoryItemToDef(row);
  const def = getItemDef(row.item_id);
  return NextResponse.json({
    item: view,
    applicable_scenarios: def?.applicable_scenarios ?? [],
    upgrade_to: def?.upgrade_to ?? null,
  });
}
