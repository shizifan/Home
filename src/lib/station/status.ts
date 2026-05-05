/**
 * 驿站解锁状态 + 出行限流（PRD §11.3 / §11.5）
 *
 * 解锁路径：
 *   朋友家 ← 7 天主流程完成（worldview_cards 已生成）
 *   学校   ← 朋友家拜访 ≥ 2 次（returned 状态）
 *   广场   ← 上学 ≥ 1 次（returned 状态）
 *
 * 出行限流：
 *   每个 companion 每天最多 1 次（任意 trip_type）
 *
 * 计数全部从 trips 表动态查；不在 companions 表加冗余 count 列，
 * 单一数据源减少漂移风险。
 */

import 'server-only';

import { queryOne } from '@/lib/db/client';
import type { TripType } from '@/types';

export interface StationStatus {
  /** 是否已毕业（worldview 已生成）— 驿站入口的总开关 */
  graduated: boolean;
  unlocked: {
    visit: boolean;
    school: boolean;
    plaza: boolean;
  };
  counts: {
    visit_returned: number;
    school_returned: number;
    plaza_returned: number;
  };
  /** 今日是否已经出门（任意 trip_type）*/
  today_used: boolean;
  /** 当日上限（PRD §11.5：每天 1 次）*/
  today_limit: number;
}

const DAILY_LIMIT = 1;

async function countReturnedByType(
  companionId: string,
  type: TripType,
): Promise<number> {
  const row = await queryOne<{ n: number }>(
    `select count(*) as n from trips
       where companion_id = :cid
         and trip_type = :type
         and status = 'returned'`,
    { cid: companionId, type },
  );
  return row?.n ?? 0;
}

async function countTodayTrips(companionId: string): Promise<number> {
  const row = await queryOne<{ n: number }>(
    `select count(*) as n from trips
       where companion_id = :cid
         and date(created_at) = curdate()`,
    { cid: companionId },
  );
  return row?.n ?? 0;
}

async function isGraduated(companionId: string): Promise<boolean> {
  const row = await queryOne<{ n: number }>(
    `select count(*) as n from worldview_cards where companion_id = :cid`,
    { cid: companionId },
  );
  return (row?.n ?? 0) > 0;
}

export async function getStationStatus(
  companionId: string,
): Promise<StationStatus> {
  const [graduated, visitN, schoolN, plazaN, todayN] = await Promise.all([
    isGraduated(companionId),
    countReturnedByType(companionId, 'visit'),
    countReturnedByType(companionId, 'school'),
    countReturnedByType(companionId, 'plaza'),
    countTodayTrips(companionId),
  ]);

  return {
    graduated,
    unlocked: {
      visit: graduated, // 毕业即解锁
      school: graduated && visitN >= 2,
      plaza: graduated && schoolN >= 1,
    },
    counts: {
      visit_returned: visitN,
      school_returned: schoolN,
      plaza_returned: plazaN,
    },
    today_used: todayN >= DAILY_LIMIT,
    today_limit: DAILY_LIMIT,
  };
}

/**
 * 出行入口的统一闸门：检查解锁与每日限流。
 * 通过 → resolve；不通过 → throw 友好 Error 给上层 API 翻译成 4xx。
 */
export async function assertCanDepart(
  companionId: string,
  type: TripType,
): Promise<StationStatus> {
  const s = await getStationStatus(companionId);
  if (!s.graduated) {
    throw new Error('not_graduated');
  }
  if (!s.unlocked[type]) {
    throw new Error(`locked:${type}`);
  }
  if (s.today_used) {
    throw new Error('daily_limit_reached');
  }
  return s;
}
