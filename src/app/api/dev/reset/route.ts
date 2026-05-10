/**
 * POST /api/dev/reset
 * 清空当前单用户下所有伙伴 + 派生数据 + uploads。
 * 仅 dev 模式 / NODE_ENV !== 'production'。
 */

import { NextResponse } from 'next/server';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { execute, query, SINGLE_USER_ID } from '@/lib/db/client';
import { resolveCurrentUser } from '@/lib/auth/session';

export const runtime = 'nodejs';

export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'disabled in prod' }, { status: 403 });
  }
  // dev only：优先用当前 cookie 用户，回落 SINGLE_USER_ID（保持 seed-graduate 兼容）
  const u = await resolveCurrentUser();
  const uid = u?.id ?? SINGLE_USER_ID;
  const rows = await query<{ id: string }>(
    `select id from companions where user_id = :uid`,
    { uid },
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
