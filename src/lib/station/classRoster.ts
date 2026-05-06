/**
 * 学校班级轮换（PRD §13.3）
 *
 * 每天选 3‑5 只伙伴参与课堂；班级稳定性"每天轮换"——
 * 今天是大熊+小狮子，明天可能是小绿龙+小老虎。
 *
 * 选取规则：
 *   1. visitor 自己必入班（孩子要看自己伙伴的回答）
 *   2. 剩下 2‑4 名额从拜访池（主角 7 + 系统预设 4 = 11，排除自己）按当日哈希挑选
 *   3. 至少 1 只系统预设伙伴 — 保证 PRD §13 极端对照组教育张力
 *   4. 总人数 = 3 ~ 5 取整
 */

import 'server-only';

import {
  getPresetCompanion,
  listMainCompanions,
  listSystemPresets,
  type PresetCompanion,
} from './presetCompanions';

/** 整数哈希函数 */
function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * 选今天的班级。
 * @param visitorPresetId 孩子自己伙伴的 preset_id；该角色必入班
 * @param size 班级人数（含 visitor），3‑5 取整；默认 4
 */
export function pickClassRoster(
  visitorPresetId: string,
  size = 4,
): PresetCompanion[] {
  const visitorSelf = getPresetCompanion(visitorPresetId);
  if (!visitorSelf) {
    throw new Error(`pickClassRoster: visitor preset_id "${visitorPresetId}" not found`);
  }

  const targetSize = Math.max(3, Math.min(5, Math.floor(size)));
  const today = new Date().toISOString().slice(0, 10);
  const seed = `${visitorPresetId}-${today}-roster`;
  const hash = hashSeed(seed);

  const sysPool = listSystemPresets(); // 4 只
  const mainPool = listMainCompanions().filter(
    (p) => p.preset_id !== visitorPresetId,
  ); // 7 只

  // 至少 1 只系统预设
  const sysPick = sysPool[hash % sysPool.length];

  // 剩下名额从主角池里按哈希取，避免重复
  const remainingCount = targetSize - 1 /* self */ - 1; /* sysPick */
  const mainPicks: PresetCompanion[] = [];
  if (remainingCount > 0) {
    const seen = new Set<string>([visitorPresetId, sysPick.preset_id]);
    let cursor = hash;
    let safety = 0;
    while (mainPicks.length < remainingCount && safety < 50) {
      cursor = hashSeed(`${cursor}-x`);
      const cand = mainPool[cursor % mainPool.length];
      if (!seen.has(cand.preset_id)) {
        mainPicks.push(cand);
        seen.add(cand.preset_id);
      }
      safety++;
    }
  }

  // 顺序：visitor 自己 → 其他主角 → 系统预设
  return [visitorSelf, ...mainPicks, sysPick];
}
