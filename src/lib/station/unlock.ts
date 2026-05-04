/**
 * 驿站解锁逻辑
 * 从 companion/state API 中抽取出独立模块，供所有 API route 复用。
 */

import 'server-only';

import { getCompanionById, countTodayTrips } from '@/lib/db/repos';
import type { StationUnlockStatus } from '@/types';

export async function getStationUnlockStatus(
  companionId: string,
): Promise<StationUnlockStatus> {
  const companion = await getCompanionById(companionId);
  if (!companion) {
    return {
      friendHouseUnlocked: false,
      schoolUnlocked: false,
      plazaUnlocked: false,
      dailyDeparturesRemaining: 0,
    };
  }

  const isGraduated = companion.graduated_at != null;

  return {
    friendHouseUnlocked: isGraduated,
    schoolUnlocked: isGraduated && companion.visit_count >= 2,
    plazaUnlocked: isGraduated && companion.school_count >= 1,
    dailyDeparturesRemaining: Math.max(0, 1 - await countTodayTrips(companionId)),
  };
}

export type { StationUnlockStatus };
