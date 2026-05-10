/**
 * GET /api/auth/me
 * 当前会话用户的最简信息。前端用它判断"已登录"。
 */

import { NextResponse } from 'next/server';
import { resolveCurrentUser } from '@/lib/auth/session';

export const runtime = 'nodejs';

export async function GET() {
  const u = await resolveCurrentUser();
  if (!u) return NextResponse.json({ user: null }, { status: 200 });
  return NextResponse.json({
    user: {
      id: u.id,
      nickname: u.nickname,
      created_at: u.created_at,
    },
  });
}
