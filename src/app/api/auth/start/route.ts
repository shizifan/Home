/**
 * POST /api/auth/start
 *
 * "欢迎来到 Home" 页提交昵称后调本接口（PRD §27.2）。
 * 行为：
 *   - 入参 { nickname, fingerprint? }
 *   - 服务端：createOrLookupUser（同 nickname+fp 复用，否则新建）
 *   - 下发 cookie home_uid
 *   - 返回 { user_id, nickname, created, homonym_count }
 *
 * 出题安全：限流（IP / 全局每日上限）将在 P6-T4 加一层 middleware；
 * 此 route 本身只做识别。
 */

import { NextResponse } from 'next/server';

import {
  createOrLookupUser,
  readFingerprintHeader,
  setUserCookie,
} from '@/lib/auth/session';
import {
  checkGlobalDailyUser,
  checkIpCreateUser,
  readIp,
} from '@/lib/auth/rateLimit';

export const runtime = 'nodejs';

const NICKNAME_MAX = 50;
const NICKNAME_MIN = 1;

export async function POST(req: Request) {
  let body: { nickname?: string; fingerprint?: string };
  try {
    body = (await req.json()) as { nickname?: string; fingerprint?: string };
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const nickname = (body.nickname ?? '').trim();
  if (nickname.length < NICKNAME_MIN || nickname.length > NICKNAME_MAX) {
    return NextResponse.json(
      { error: 'invalid_nickname', detail: `1‑${NICKNAME_MAX} 字` },
      { status: 400 },
    );
  }

  const fp = body.fingerprint?.slice(0, 100) ?? readFingerprintHeader(req) ?? null;

  // PRD §27.4 限流（仅在新建用户时算次数；已存在用户被同 fp 复用不计）
  const ip = readIp(req);
  const ipCheck = await checkIpCreateUser(ip);
  if (!ipCheck.ok) {
    return NextResponse.json(
      { error: ipCheck.reason, message: ipCheck.message },
      { status: 429 },
    );
  }
  const globalCheck = await checkGlobalDailyUser();
  if (!globalCheck.ok) {
    return NextResponse.json(
      { error: globalCheck.reason, message: globalCheck.message },
      { status: 429 },
    );
  }

  try {
    const r = await createOrLookupUser({
      nickname,
      device_fingerprint: fp,
    });
    await setUserCookie(r.user.id);
    return NextResponse.json({
      user_id: r.user.id,
      nickname: r.user.nickname,
      created: r.created,
      homonym_count: r.homonym_count,
    });
  } catch (e) {
    const msg = (e as Error)?.message ?? 'unknown';
    if (msg === 'nickname_required') {
      return NextResponse.json({ error: 'invalid_nickname' }, { status: 400 });
    }
    console.error('[/api/auth/start]', e);
    return NextResponse.json(
      { error: 'internal_error', detail: msg },
      { status: 500 },
    );
  }
}
