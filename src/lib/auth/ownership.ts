/**
 * 数据隔离强校验（PRD §27.2.5）
 *
 * 所有 API 入口在解析 companion 之后，必须确认 companion.user_id === currentUser.id。
 * 否则返回 404（不返回 403，避免泄露存在性）。
 */

import 'server-only';

import { queryOne } from '@/lib/db/client';

export class NotFoundOrForbiddenError extends Error {
  constructor() {
    super('not_found_or_forbidden');
    this.name = 'NotFoundOrForbiddenError';
  }
}

/**
 * 校验 companion 属于当前用户。返回 companion.id 字符串成功；否则 throw。
 */
export async function assertCompanionOwnedByUser(
  companionId: string,
  userId: string,
): Promise<void> {
  const row = await queryOne<{ user_id: string }>(
    `select user_id from companions where id = :id`,
    { id: companionId },
  );
  if (!row || row.user_id !== userId) {
    throw new NotFoundOrForbiddenError();
  }
}

/**
 * 拿当前用户的 companion；如果传了 companionId 校验所属，否则取该用户最新的。
 */
export async function getOwnCompanion(
  userId: string,
  companionId?: string | null,
): Promise<{ id: string; preset_id: string; current_day: number } | null> {
  if (companionId) {
    const row = await queryOne<{
      id: string;
      preset_id: string;
      current_day: number;
      user_id: string;
    }>(
      `select id, preset_id, current_day, user_id from companions where id = :id`,
      { id: companionId },
    );
    if (!row || row.user_id !== userId) {
      throw new NotFoundOrForbiddenError();
    }
    return { id: row.id, preset_id: row.preset_id, current_day: row.current_day };
  }
  // 取该用户最新的 companion
  return await queryOne<{ id: string; preset_id: string; current_day: number }>(
    `select id, preset_id, current_day from companions
       where user_id = :uid
       order by created_at desc limit 1`,
    { uid: userId },
  );
}
