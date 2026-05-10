/**
 * API 入口辅助：把"解析用户 + 拿 own companion + 校验所属"打包，避免每个 route 抄一遍。
 *
 * 返回 4 种状态由调用方分支处理：
 *   - { ok: true, user, companion }     正常
 *   - { ok: false, code: 'no_user' }    没 cookie / 已过期 → 401
 *   - { ok: false, code: 'no_companion' }  用户存在但还没创建过伙伴 → 404
 *   - { ok: false, code: 'forbidden' }    传了 companion_id 但不属于当前用户 → 404（伪 404）
 */

import 'server-only';

import { NextResponse } from 'next/server';
import { resolveCurrentUser, type AppUser } from './session';
import { getOwnCompanion, NotFoundOrForbiddenError } from './ownership';

export type GuardResult =
  | {
      ok: true;
      user: AppUser;
      companion: { id: string; preset_id: string; current_day: number };
    }
  | { ok: false; code: 'no_user' | 'no_companion' | 'forbidden' };

export async function guardWithCompanion(
  companionIdHint?: string | null,
): Promise<GuardResult> {
  const user = await resolveCurrentUser();
  if (!user) return { ok: false, code: 'no_user' };
  try {
    const companion = await getOwnCompanion(user.id, companionIdHint);
    if (!companion) return { ok: false, code: 'no_companion' };
    return { ok: true, user, companion };
  } catch (e) {
    if (e instanceof NotFoundOrForbiddenError) {
      return { ok: false, code: 'forbidden' };
    }
    throw e;
  }
}

/** 仅校验有 user，不要求 companion 存在（用于 /api/companion/create 等场景） */
export async function guardUserOnly(): Promise<
  { ok: true; user: AppUser } | { ok: false; code: 'no_user' }
> {
  const user = await resolveCurrentUser();
  if (!user) return { ok: false, code: 'no_user' };
  return { ok: true, user };
}

export function guardErrorResponse(
  code: 'no_user' | 'no_companion' | 'forbidden',
): Response {
  if (code === 'no_user') {
    return NextResponse.json({ error: 'no_user' }, { status: 401 });
  }
  // no_companion / forbidden 都返 404，避免泄露存在性
  return NextResponse.json(
    { error: code === 'no_companion' ? 'no_companion' : 'not_found' },
    { status: 404 },
  );
}
