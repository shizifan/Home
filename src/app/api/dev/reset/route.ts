/**
 * POST /api/dev/reset
 * 清空当前单用户下所有伙伴 + 派生数据 + uploads。
 * 仅 dev 模式 / NODE_ENV !== 'production'。
 */

import { NextResponse } from 'next/server';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { execute, query, SINGLE_USER_ID } from '@/lib/db/client';

export const runtime = 'nodejs';

export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'disabled in prod' }, { status: 403 });
  }
  // 找到所有 companion id
  const rows = await query<{ id: string }>(
    `select id from companions where user_id = :uid`,
    { uid: SINGLE_USER_ID },
  );
  for (const r of rows) {
    // 顺序删（外键 cascade 会带走 memories / memory_bank / conversations / worldview / cards）
    await execute(`delete from companions where id = :id`, { id: r.id });
    // 删 uploads（V0.5 photo + V0.6.1 voice）
    for (const dir of ['uploads', 'uploads_voice']) {
      try {
        await rm(path.join(process.cwd(), 'public', dir, r.id), {
          recursive: true,
          force: true,
        });
      } catch {
        /* ignore */
      }
    }
  }
  return NextResponse.json({ ok: true, deleted: rows.length });
}
