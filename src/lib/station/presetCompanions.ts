/**
 * 拜访池：可被拜访的伙伴 memory_bank 快照
 *
 * 两类：
 *   1. system_preset（4 只）— 极端"训练数据"环境，PRD §12.3 教育意图的对照组
 *      （小鱼海边 / 土豆农村 / 星星城市 / 阿木英文动画）
 *   2. main_companion（8 只）— PRD §15.1 八个主角伙伴的"另一个孩子"版本
 *      （小青龙 / 大熊 / 小火龙 / 藤藤蛇 / 小绿龙 / 琳娜贝尔 / 小老虎 / 小狮子）
 *      因 V1.0 单用户期没有真实毕业用户可匹配，用这 8 只填充 PRD §12.3 "真实伙伴"池
 *
 * 数据存于 /data/{preset_companions,main_companions}/*.json，构建期 import；
 * 不入主库表，仅在 LLM Prompt 拼接时按需注入。
 */

import 'server-only';

// 4 系统预设伙伴（极端训练数据）
import xiaoyu from '../../../data/preset_companions/xiaoyu.json';
import tudou from '../../../data/preset_companions/tudou.json';
import xingxing from '../../../data/preset_companions/xingxing.json';
import amu from '../../../data/preset_companions/amu.json';

// 8 主角伙伴（"另一个孩子"版本）
import mainXiaoqinglong from '../../../data/main_companions/xiaoqinglong.json';
import mainDabear from '../../../data/main_companions/dabear.json';
import mainXiaohuolong from '../../../data/main_companions/xiaohuolong.json';
import mainTengtengshe from '../../../data/main_companions/tengtengshe.json';
import mainXiaolvlong from '../../../data/main_companions/xiaolvlong.json';
import mainLinnabel from '../../../data/main_companions/linnabel.json';
import mainXiaolaohu from '../../../data/main_companions/xiaolaohu.json';
import mainXiaoshizi from '../../../data/main_companions/xiaoshizi.json';

import type { ConceptCategory, MemoryBankType } from '@/types';

export interface PresetMemoryEntry {
  /** 拜访池伙伴只用 'remembered' 和 'unknown' 两种 */
  type: Extract<MemoryBankType, 'remembered' | 'unknown'>;
  concept_name: string;
  concept_category?: ConceptCategory;
  ai_summary?: string;
  /** 出现频次的虚拟权重（影响伙伴说"我提过 N 次"的语气）；unknown 项无此字段 */
  evidence_weight?: number;
}

export type HostKind = 'system_preset' | 'main_companion';

export interface PresetCompanion {
  preset_id: string;
  name: string;
  appearance: string;
  personality: string;
  personality_examples: string[];
  memory_bank: PresetMemoryEntry[];
  /** 来源池标记 — 主角池优先级高于系统预设池 */
  kind: HostKind;
}

function tag(
  obj: Omit<PresetCompanion, 'kind'>,
  kind: HostKind,
): PresetCompanion {
  return { ...obj, kind };
}

const SYSTEM_PRESETS: PresetCompanion[] = [
  tag(xiaoyu as unknown as Omit<PresetCompanion, 'kind'>, 'system_preset'),
  tag(tudou as unknown as Omit<PresetCompanion, 'kind'>, 'system_preset'),
  tag(xingxing as unknown as Omit<PresetCompanion, 'kind'>, 'system_preset'),
  tag(amu as unknown as Omit<PresetCompanion, 'kind'>, 'system_preset'),
];

const MAIN_COMPANIONS: PresetCompanion[] = [
  tag(mainXiaoqinglong as unknown as Omit<PresetCompanion, 'kind'>, 'main_companion'),
  tag(mainDabear as unknown as Omit<PresetCompanion, 'kind'>, 'main_companion'),
  tag(mainXiaohuolong as unknown as Omit<PresetCompanion, 'kind'>, 'main_companion'),
  tag(mainTengtengshe as unknown as Omit<PresetCompanion, 'kind'>, 'main_companion'),
  tag(mainXiaolvlong as unknown as Omit<PresetCompanion, 'kind'>, 'main_companion'),
  tag(mainLinnabel as unknown as Omit<PresetCompanion, 'kind'>, 'main_companion'),
  tag(mainXiaolaohu as unknown as Omit<PresetCompanion, 'kind'>, 'main_companion'),
  tag(mainXiaoshizi as unknown as Omit<PresetCompanion, 'kind'>, 'main_companion'),
];

const ALL: PresetCompanion[] = [...MAIN_COMPANIONS, ...SYSTEM_PRESETS];
const BY_ID: Map<string, PresetCompanion> = new Map(
  ALL.map((p) => [p.preset_id, p]),
);

export function listPresetCompanions(): PresetCompanion[] {
  return ALL;
}

/** 主角池（8 只）— 默认拜访目标，可排除 visitor 自己 */
export function listMainCompanions(): PresetCompanion[] {
  return MAIN_COMPANIONS;
}

/** 系统预设池（4 只）— 极端对照组 */
export function listSystemPresets(): PresetCompanion[] {
  return SYSTEM_PRESETS;
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
