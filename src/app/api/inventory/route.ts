/**
 * GET /api/inventory[?companion_id=...]
 *
 * 返回当前 companion 的行囊：按 4 类分组 + 道具池中"未拥有"项灰显（前端可选）。
 */

import { NextResponse } from 'next/server';
import {
  findCompanionForSingleUser,
  getCompanionById,
  listInventory,
} from '@/lib/db/repos';
import { inventoryItemToDef } from '@/lib/orchestrate/grantInventory';

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
  const rows = await listInventory(companion.id);
  const items = rows.map(inventoryItemToDef);
  return NextResponse.json({
    companion_id: companion.id,
    items,
    grouped: {
      knowledge: items.filter((i) => i.category === 'knowledge'),
      object: items.filter((i) => i.category === 'object'),
      gift: items.filter((i) => i.category === 'gift'),
      ability: items.filter((i) => i.category === 'ability'),
    },
  });
}
