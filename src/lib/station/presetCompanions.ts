/**
 * 系统预设伙伴 — PRD §12.3
 *
 * 4 只角色对应 4 种"训练数据"环境，作为朋友家拜访时真实伙伴池不足的兜底；
 * 同时是教育意图的"对照组"——让孩子直观看到不同输入造就不同的 AI。
 *
 * 数据存于 /data/preset_companions/*.json，构建期 import；不入主库表，
 * 仅在 LLM Prompt 拼接时按需注入。
 */

import 'server-only';

import xiaoyu from '../../../data/preset_companions/xiaoyu.json';
import tudou from '../../../data/preset_companions/tudou.json';
import xingxing from '../../../data/preset_companions/xingxing.json';
import amu from '../../../data/preset_companions/amu.json';

import type { ConceptCategory, MemoryBankType } from '@/types';

export interface PresetMemoryEntry {
  /** 系统预设伙伴只用 'remembered' 和 'unknown' 两种 */
  type: Extract<MemoryBankType, 'remembered' | 'unknown'>;
  concept_name: string;
  concept_category?: ConceptCategory;
  ai_summary?: string;
  /** 出现频次的虚拟权重（影响伙伴说"我提过 N 次"的语气）；unknown 项无此字段 */
  evidence_weight?: number;
}

export interface PresetCompanion {
  preset_id: string;
  name: string;
  appearance: string;
  personality: string;
  personality_examples: string[];
  memory_bank: PresetMemoryEntry[];
}

// 类型断言：JSON 文件没办法在编译期保证 type 字段是字面量并集，
// 这里 unknown → cast 是约定，加载点必须信任 JSON 数据格式。
const RAW_PRESETS: PresetCompanion[] = [
  xiaoyu as unknown as PresetCompanion,
  tudou as unknown as PresetCompanion,
  xingxing as unknown as PresetCompanion,
  amu as unknown as PresetCompanion,
];

const BY_ID: Map<string, PresetCompanion> = new Map(
  RAW_PRESETS.map((p) => [p.preset_id, p]),
);

export function listPresetCompanions(): PresetCompanion[] {
  return RAW_PRESETS;
}

export function getPresetCompanion(id: string): PresetCompanion | undefined {
  return BY_ID.get(id);
}

export function isPresetCompanion(id: string | null | undefined): boolean {
  return !!id && BY_ID.has(id);
}

/**
 * 把 PresetCompanion 渲染成给 LLM Prompt 用的 memory_bank 摘要文本。
 * PRD §23.10 拜访 Prompt 中 host_memory_bank_summary 字段的内容。
 */
export function renderPresetMemorySummary(preset: PresetCompanion): string {
  const remembered = preset.memory_bank
    .filter((m) => m.type === 'remembered')
    .map(
      (m) =>
        `- 【${m.concept_category ?? 'other'}】${m.concept_name}：${m.ai_summary ?? ''}`,
    )
    .join('\n');
  const unknown = preset.memory_bank
    .filter((m) => m.type === 'unknown')
    .map((m) => `- ${m.concept_name}（${m.ai_summary ?? '不知道'}）`)
    .join('\n');

  return [
    `【已知】`,
    remembered || '（无）',
    '',
    `【完全不知道的事】`,
    unknown || '（无）',
  ].join('\n');
}
