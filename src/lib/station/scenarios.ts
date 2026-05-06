/**
 * 广场剧本静态数据 loader（PRD §14.5.2 + 附录 B）
 *
 * 5 个剧本：水患治理 / 使节来访 / 瘟疫蔓延 / 朝堂谋略 / 边境警报
 */

import 'server-only';

import waterDisaster from '../../../data/scenarios/water_disaster.json';
import envoyVisit from '../../../data/scenarios/envoy_visit.json';
import plagueOutbreak from '../../../data/scenarios/plague_outbreak.json';
import courtIntrigue from '../../../data/scenarios/court_intrigue.json';
import borderAlarm from '../../../data/scenarios/border_alarm.json';

import type { Scenario } from '@/types';

const ALL: Scenario[] = [
  waterDisaster as unknown as Scenario,
  envoyVisit as unknown as Scenario,
  plagueOutbreak as unknown as Scenario,
  courtIntrigue as unknown as Scenario,
  borderAlarm as unknown as Scenario,
];

const BY_ID = new Map(ALL.map((s) => [s.id, s]));

export function getScenario(id: string): Scenario | undefined {
  return BY_ID.get(id);
}

export function listScenarios(): Scenario[] {
  return ALL;
}

/**
 * 选今日剧本：哈希 (companion + 当日)；避免连续 2 天同一剧本（参考前一次玩法）。
 * 实际使用时由调用方加上 plaza_plays 历史去重。
 */
export function pickScenarioByDate(
  visitorPresetId: string,
  excludeIds: string[] = [],
): Scenario {
  const today = new Date().toISOString().slice(0, 10);
  const seed = `${visitorPresetId}-${today}-scenario`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  const pool = ALL.filter((s) => !excludeIds.includes(s.id));
  if (pool.length === 0) return ALL[hash % ALL.length];
  return pool[hash % pool.length];
}
