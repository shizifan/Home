/**
 * POST /api/auth/lookup
 *
 * "用昵称回来"路径（PRD §27.2.4）：
 *   - 入参 { nickname }
 *   - 列出该昵称下所有 user（按 last_active_at desc）
 *   - 不下发 cookie；让用户在前端选哪一个再调 /api/auth/resume?user_id=...
 */

import { NextResponse } from 'next/server';
import { lookupByNickname } from '@/lib/auth/session';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  let body: { nickname?: string };
  try {
    body = (await req.json()) as { nickname?: string };
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const n = (body.nickname ?? '').trim();
  if (!n) {
    return NextResponse.json({ error: 'invalid_nickname' }, { status: 400 });
  }
  const list = await lookupByNickname(n);
  return NextResponse.json({
    matches: list.map((u) => ({
      user_id: u.id,
      nickname: u.nickname,
      created_at: u.created_at,
      last_active_at: u.last_active_at ?? null,
    })),
  });
}
