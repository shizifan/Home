/**
 * POST /api/dev/reset
 * 清空当前单用户下所有伙伴 + 派生数据 + uploads。
 * 仅 dev 模式 / NODE_ENV !== 'production'。
 *
 * V1.0: 更新表列表，TRUNCATE 替换 DELETE 以提高效率。
 */

import { NextResponse } from 'next/server';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { execute } from '@/lib/db/client';

export const runtime = 'nodejs';

const TABLES = [
  'llm_call_log',
  'plaza_plays',
  'inventory_items',
  'trips',
  'cards',
  'conversations',
  'worldview_cards',
  'memory_bank',
  'memories',
  'companions',
  'users',
];

export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'disabled in prod' }, { status: 403 });
  }

  // CASCADE 自动处理所有外键
  for (const table of TABLES) {
    await execute(`TRUNCATE TABLE ${table} CASCADE`);
  }

  // 删 uploads（V0.5 photo + V0.6.1 voice）
  for (const dir of ['uploads', 'uploads_voice']) {
    try {
      await rm(path.join(process.cwd(), 'public', dir), {
        recursive: true,
        force: true,
      });
    } catch {
      /* ignore */
    }
  }

  return NextResponse.json({ ok: true, deleted: true });
}
