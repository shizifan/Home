/**
 * 广场角色分配（PRD §14.4）
 *
 * 8 主角各有"角色倾向"（思考型/权威型/行动型...）。
 * 同一只伙伴在不同剧本里可能扮演不同角色，但倾向保持稳定。
 *
 * 当前实现简化为：剧本骨架内 roles 字段直接预定 — 每个剧本写死 4 个角色对应的 preset_id。
 * P5 阶段会做更动态的分配（按当日伙伴池）。
 */

import 'server-only';

import { getPresetCompanion, type PresetCompanion } from './presetCompanions';
import type { Scenario } from '@/types';

export interface AssignedRole {
  preset_id: string;
  preset?: PresetCompanion;
  role: string; // '丞相' / '国王' / 武将 等
}

/**
 * 把剧本 roles 字段（preset_id → role 名）展开成 AssignedRole 列表，
 * 按角色名去重 + 按预定顺序返回。
 */
export function assignRoles(scenario: Scenario): AssignedRole[] {
  const out: AssignedRole[] = [];
  for (const [presetId, role] of Object.entries(scenario.roles)) {
    out.push({
      preset_id: presetId,
      preset: getPresetCompanion(presetId),
      role,
    });
  }
  return out;
}
