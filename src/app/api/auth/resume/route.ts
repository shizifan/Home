/**
 * POST /api/auth/resume
 *
 * "用昵称回来 → 选某个 user_id 进入"。下发 cookie。
 */

import { NextResponse } from 'next/server';
import { queryOne } from '@/lib/db/client';
import { setUserCookie } from '@/lib/auth/session';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  let body: { user_id?: string };
  try {
    body = (await req.json()) as { user_id?: string };
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  if (!body.user_id) {
    return NextResponse.json({ error: 'missing_user_id' }, { status: 400 });
  }
  const row = await queryOne<{ id: string; nickname: string | null }>(
    `select id, nickname from users where id = :id and status = 'active'`,
    { id: body.user_id },
  );
  if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  await setUserCookie(row.id);
  return NextResponse.json({ user_id: row.id, nickname: row.nickname });
}
