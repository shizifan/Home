/**
 * GET /api/inventory[?companion_id=...]
 *
 * 返回当前 companion 的行囊：按 4 类分组。
 */

import { NextResponse } from 'next/server';
import { listInventory } from '@/lib/db/repos';
import { inventoryItemToDef } from '@/lib/orchestrate/grantInventory';
import { guardWithCompanion, guardErrorResponse } from '@/lib/auth/apiGuard';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const cid = url.searchParams.get('companion_id');
  const guard = await guardWithCompanion(cid);
  if (!guard.ok) return guardErrorResponse(guard.code);
  const rows = await listInventory(guard.companion.id);
  const items = rows.map(inventoryItemToDef);
  return NextResponse.json({
    companion_id: guard.companion.id,
    items,
    grouped: {
      knowledge: items.filter((i) => i.category === 'knowledge'),
      object: items.filter((i) => i.category === 'object'),
      gift: items.filter((i) => i.category === 'gift'),
      ability: items.filter((i) => i.category === 'ability'),
    },
  });
}
