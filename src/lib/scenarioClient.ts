/**
 * 客户端剧本数据 — 让 plaza play 页面能拿到 act 骨架（scene / decision_prompt / 适用道具）
 * 不带 server-only，可在 'use client' 下使用。
 *
 * 与 src/lib/station/scenarios.ts 重复 import 同一份 JSON；构建期 tree-shake 后体积可控。
 */

import waterDisaster from '../../data/scenarios/water_disaster.json';
import envoyVisit from '../../data/scenarios/envoy_visit.json';
import plagueOutbreak from '../../data/scenarios/plague_outbreak.json';
import courtIntrigue from '../../data/scenarios/court_intrigue.json';
import borderAlarm from '../../data/scenarios/border_alarm.json';

import type { Scenario, ScenarioAct } from '@/types';

const ALL: Scenario[] = [
  waterDisaster as unknown as Scenario,
  envoyVisit as unknown as Scenario,
  plagueOutbreak as unknown as Scenario,
  courtIntrigue as unknown as Scenario,
  borderAlarm as unknown as Scenario,
];

const BY_ID = new Map(ALL.map((s) => [s.id, s]));

export function listScenariosClient(): Scenario[] {
  return ALL;
}

export function getScenarioClient(id: string): Scenario | undefined {
  return BY_ID.get(id);
}

/** 返回 scene + decision_prompt + 该剧本 applicable_items（act 维度暂用整剧本的）*/
export function getScenarioActSkeleton(
  scenarioId: string,
  actNumber: 1 | 2 | 3,
):
  | (ScenarioAct & { applicable_items: string[] })
  | undefined {
  const sc = BY_ID.get(scenarioId);
  if (!sc) return undefined;
  const act = sc.acts.find((a) => a.number === actNumber);
  if (!act) return undefined;
  return { ...act, applicable_items: sc.applicable_items };
}
