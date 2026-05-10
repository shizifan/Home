/**
 * 8 个预设伙伴的元数据 + 全场景文案。
 * 单一数据源：prompts/shared/companions.json（V0.2.0 起含 unlock/depart/correction/wait 等台词）
 */

import companionsJson from '@prompts/shared/companions.json';
import type { CompanionPresetId } from '@/components/characters/types';

export type StationKind = 'visit' | 'school' | 'plaza';

export interface CompanionUnlockLines {
  visit: string;
  school: string;
  plaza: string;
}

export interface CompanionDepartLines {
  visit: string;
  school: string;
  plaza: string;
}

export interface CompanionCorrectionResponses {
  restore: string;
  dismiss: string;
  clarify: string;
  rename: string;
  merge: string;
}

export interface CompanionPresetMeta {
  preset_id: CompanionPresetId;
  name: string;
  appearance: string;
  personality: string;
  personality_examples: string[];
  skip_response: string;
  /** 解锁台词（PRD §17.6 / §18.6）— 可选以兼容旧 JSON */
  unlock_lines?: CompanionUnlockLines;
  /** 出发台词（PRD §18.6）*/
  depart_lines?: CompanionDepartLines;
  /** 纠正反馈台词（PRD §15.5 / §18.5）*/
  correction_responses?: CompanionCorrectionResponses;
  /** 描述卡片生成等待文案 4 条（PRD §6.4 / §18.4）*/
  wait_lines?: string[];
}

const list = (companionsJson as { companions: CompanionPresetMeta[] }).companions;

export const COMPANION_PRESETS: CompanionPresetMeta[] = list;

export function getCompanionPreset(id: CompanionPresetId): CompanionPresetMeta | undefined {
  return list.find((c) => c.preset_id === id);
}

// ─────────────── 场景文案访问器（带兜底）───────────────

/** PRD §18.6 解锁台词 */
export function getUnlockLine(
  presetId: CompanionPresetId,
  station: StationKind,
): string {
  const meta = getCompanionPreset(presetId);
  return meta?.unlock_lines?.[station] ?? '......';
}

/** PRD §18.6 出发台词 */
export function getDepartLine(
  presetId: CompanionPresetId,
  station: StationKind,
): string {
  const meta = getCompanionPreset(presetId);
  return meta?.depart_lines?.[station] ?? '我去了。';
}

/** PRD §15.5 / §18.5 纠正反馈台词；找不到具体条则回到 restore，再不行回到 skip_response */
export function getCorrectionResponse(
  presetId: CompanionPresetId,
  action: keyof CompanionCorrectionResponses,
): string {
  const meta = getCompanionPreset(presetId);
  return (
    meta?.correction_responses?.[action] ??
    meta?.correction_responses?.restore ??
    meta?.skip_response ??
    '...好的。'
  );
}

/** PRD §6.4 等待文案；按 [0,3s,6s,9s] 索引取 */
export function getWaitLine(
  presetId: CompanionPresetId,
  index: 0 | 1 | 2 | 3,
): string {
  const meta = getCompanionPreset(presetId);
  const lines = meta?.wait_lines;
  if (!lines || lines.length === 0) return '......';
  return lines[Math.min(index, lines.length - 1)];
}
