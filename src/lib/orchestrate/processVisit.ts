/**
 * 朋友家拜访服务层（PRD §12 / §23.10）
 *
 * 串：assertCanDepart → 选 host → createTrip → runVisit → markTripReturned
 *
 * V1.0 简化策略：host 池只用 4 只系统预设伙伴，按确定性哈希挑（保证今日同一拜访者
 * 不会反复匹配同一只）。P7 阶段再加"按差异度优先 + 真实毕业用户"的复杂逻辑。
 */

import 'server-only';

import {
  createTrip,
  getCompanionById,
  getMemoryBank,
  getTripById,
  markTripReturned,
} from '@/lib/db/repos';
import { getCompanionPreset } from '@/lib/companionPresets';
import { assertCanDepart } from '@/lib/station/status';
import {
  getPresetCompanion,
  listMainCompanions,
  listSystemPresets,
  type PresetCompanion,
} from '@/lib/station/presetCompanions';
import {
  runVisit,
  visitFallbackOutput,
  type VisitOutput,
} from '@/lib/llm/visit';
import type { Trip, VisitPurposeType } from '@/types';

export interface ProcessVisitInput {
  companionId: string;
  purposeType: VisitPurposeType;
  purposeQuestion?: string;
  /** 可选：指定拜访谁；不传则按当日哈希挑一只系统预设 */
  hostPresetId?: string;
}

export interface StartVisitResult {
  trip: Trip;
  host: {
    preset_id: string;
    name: string;
    appearance: string;
    is_system_preset: true;
  };
}

export interface ProcessVisitResult {
  trip: Trip;
  visit: VisitOutput;
  source: 'llm' | 'fallback';
  host: {
    preset_id: string;
    name: string;
    appearance: string;
    is_system_preset: true;
  };
}

/**
 * 拜访池挑选策略（V1.0 单用户期 — 用户决议 2026-05-06）：
 *   1. 仅 main_companion 池（8 主角"另一个孩子"），排除 visitor 自己 → 永远是 7 只
 *   2. 哈希按 (visitor + 当日) 选具体哪只，今日同一拜访者不重复，第二天换
 *   3. hint 直接覆盖（dev / 测试用）
 *
 * 与 PRD §12.3 的偏离：
 *   PRD 设计 1/3 出现系统预设（小鱼/土豆/星星/阿木）做"极端训练数据对照"。
 *   单用户体验下"只见外星人"违和；用户明确决定 visit 池只用熟悉的 8 主角。
 *   系统预设池留给学校（保持课堂"同题不同答"的对照张力）和后续多用户阶段。
 */
function pickHostByDate(
  visitorPresetId: string,
  hint?: string,
): PresetCompanion {
  if (hint) {
    const found = getPresetCompanion(hint);
    if (found) return found;
  }

  // 当日哈希：(visitor + date) → 索引
  const today = new Date().toISOString().slice(0, 10);
  const seed = `${visitorPresetId}-${today}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }

  const pool = listMainCompanions().filter(
    (p) => p.preset_id !== visitorPresetId,
  );
  if (pool.length === 0) {
    // 理论不可能（visitorPresetId 不在 8 主角列表里），保险兜底回系统预设
    return listSystemPresets()[hash % 4];
  }
  return pool[hash % pool.length];
}

/**
 * 同步步：校验 + 选 host + 建 trip（status=traveling），立即返回。
 * LLM 调用 / 写报告由 finishVisit 异步完成，arch 详见 depart route。
 */
export async function startVisit(
  input: ProcessVisitInput,
): Promise<StartVisitResult> {
  // 1. 校验：解锁 + 当日限流
  await assertCanDepart(input.companionId, 'visit');

  // 2. 校验：ask_question 必须带 question
  if (input.purposeType === 'ask_question' && !input.purposeQuestion?.trim()) {
    throw new Error('ask_question_requires_question');
  }

  // 3. 加载拜访者（仅校验存在性）
  const companion = await getCompanionById(input.companionId);
  if (!companion) throw new Error('companion_not_found');
  const visitorPreset = getCompanionPreset(companion.preset_id);
  if (!visitorPreset) throw new Error('visitor_preset_not_found');

  // 4. 挑 host（系统预设池）
  const host = pickHostByDate(companion.preset_id, input.hostPresetId);

  // 5. 建 trip（status=traveling）
  const trip = await createTrip({
    companionId: companion.id,
    tripType: 'visit',
    purposeType: input.purposeType,
    purposeQuestion: input.purposeQuestion,
  });

  return {
    trip,
    host: {
      preset_id: host.preset_id,
      name: host.name,
      appearance: host.appearance,
      is_system_preset: true,
    },
  };
}

/**
 * 异步步：跑 LLM，写报告到 trip.report_data，把 trip 标记 returned。
 * 不抛错——失败也用 visitFallbackOutput 写一个占位报告，孩子看到的是友好台词。
 */
export async function finishVisit(args: {
  tripId: string;
  companionId: string;
  hostPresetId: string;
  purposeType: VisitPurposeType;
  purposeQuestion?: string;
}): Promise<void> {
  try {
    const companion = await getCompanionById(args.companionId);
    if (!companion) throw new Error('companion_not_found');
    const visitorPreset = getCompanionPreset(companion.preset_id);
    if (!visitorPreset) throw new Error('visitor_preset_not_found');
    const host = getPresetCompanion(args.hostPresetId);
    if (!host) throw new Error('host_preset_not_found');
    const visitorBank = await getMemoryBank(companion.id);

    const llm = await runVisit(
      {
        visitor: visitorPreset,
        visitorMemoryBank: visitorBank,
        host: { kind: 'preset', preset: host },
        purpose: args.purposeType,
        purposeQuestion: args.purposeQuestion,
      },
      companion.id,
    );

    const output: VisitOutput = llm.success ? llm.data : visitFallbackOutput();
    const source: 'llm' | 'fallback' = llm.success ? 'llm' : 'fallback';

    await markTripReturned({
      tripId: args.tripId,
      reportNarrative: output.scene_narrative,
      reportData: {
        new_word: output.new_word,
        host_meta: {
          preset_id: host.preset_id,
          name: host.name,
          appearance: host.appearance,
          is_system_preset: true,
        },
        purpose: {
          type: args.purposeType,
          question: args.purposeQuestion ?? null,
        },
        source,
      },
    });
  } catch (e) {
    console.error('[finishVisit]', e);
    // 兜底：仍把 trip 标记 returned，写占位报告
    const fallback = visitFallbackOutput();
    await markTripReturned({
      tripId: args.tripId,
      reportNarrative: fallback.scene_narrative,
      reportData: {
        new_word: null,
        host_meta: null,
        purpose: {
          type: args.purposeType,
          question: args.purposeQuestion ?? null,
        },
        source: 'fallback',
        error: (e as Error)?.message ?? 'unknown',
      },
    });
  }
}

/** 兼容老 API：完整流程同步跑（startVisit + finishVisit），主要给 E2E 测试用 */
export async function processVisit(
  input: ProcessVisitInput,
): Promise<ProcessVisitResult> {
  const { trip, host } = await startVisit(input);
  await finishVisit({
    tripId: trip.id,
    companionId: input.companionId,
    hostPresetId: host.preset_id,
    purposeType: input.purposeType,
    purposeQuestion: input.purposeQuestion,
  });
  const updated = await getTripById(trip.id);
  if (!updated) throw new Error('trip_disappeared_after_return');
  const data = (updated.report_data as { new_word?: VisitOutput['new_word']; source?: 'llm' | 'fallback' }) ?? {};
  return {
    trip: updated,
    visit: {
      scene_narrative: updated.report_narrative ?? '',
      new_word: data.new_word ?? null,
    },
    source: data.source ?? 'fallback',
    host,
  };
}
