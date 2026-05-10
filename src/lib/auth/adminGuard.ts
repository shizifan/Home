/**
 * /admin 鉴权（PRD §27.3.3）
 *
 * 极简：URL ?key=... 与环境变量 ADMIN_KEY 比较。
 * 不是真实安全（V0.7 升级后会换成手机号 + 邀请码）。
 */

import 'server-only';

import { NextResponse } from 'next/server';

export function isAdmin(req: Request): boolean {
  const expected = process.env.ADMIN_KEY;
  if (!expected) return false;
  const url = new URL(req.url);
  const got = url.searchParams.get('key');
  if (!got) return false;
  // 长度比较 + 值相等（避免短路定时攻击的微弱可能）
  if (got.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) {
    diff |= got.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

export function requireAdmin(req: Request): Response | null {
  if (isAdmin(req)) return null;
  return NextResponse.json({ error: 'forbidden' }, { status: 403 });
}
