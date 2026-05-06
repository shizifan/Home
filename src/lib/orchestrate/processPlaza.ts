/**
 * 广场剧本服务层（PRD §14 / §23.12 / §23.13）
 *
 * 5 个原子动作（每个对应一个 API 入口）：
 *   1. startPlaza(scenarioId, selectedItemRowIds[3])  → 创建 trip + plaza_play
 *   2. runAct(playId, actNumber, itemRowId|null)      → LLM 生成本幕，append 到 plaza_play.act_choices
 *   3. finishPlaza(playId)                            → ending LLM + 计算 rewards + 写 plaza_play.finished_at
 *   4. getPlazaPlay(playId)                           → 查询当前进度（act_choices / ending）
 *
 * 数据流：
 *   plaza_play.act_choices = JSON 数组，每条带 item_id + quality + narrative + scene_extra
 */

import 'server-only';

import {
  appendPlazaPlayChoice,
  bumpItemUseCount,
  countPlazaPlaysByScenario,
  createPlazaPlay,
  createTrip,
  findInventoryById,
  finishPlazaPlay,
  getCompanionById,
  getPlazaPlayById,
  markTripReturned,
} from '@/lib/db/repos';
import { assertCanDepart } from '@/lib/station/status';
import { getScenario } from '@/lib/station/scenarios';
import {
  computeFinalRewards,
  getRepeatPlayHint,
  grantRewards,
  type RewardItemPayload,
} from '@/lib/station/rewardEngine';
import {
  inferItemUseQuality,
  plazaActFallback,
  plazaEndingFallback,
  runPlazaAct,
  runPlazaEnding,
  type PlazaActOutput,
  type PlazaEndingOutput,
} from '@/lib/llm/plaza';
import type {
  ActChoice,
  ItemUseQuality,
  PlazaPlay,
  Scenario,
} from '@/types';

// ──────────────────── helpers ────────────────────

interface ActChoiceWithNarrative extends ActChoice {
  narrative?: string;
  small_blue_dragon_speech?: string;
  other_response?: string;
  next_act_hook?: string;
}

function parseActChoices(play: PlazaPlay): ActChoiceWithNarrative[] {
  const raw = play.act_choices;
  if (!raw || !Array.isArray(raw)) return [];
  return raw as ActChoiceWithNarrative[];
}

// ──────────────────── start ────────────────────

export interface StartPlazaInput {
  companionId: string;
  scenarioId: string;
  selectedItemRowIds: [string, string, string]; // 3 件 inventory_items.id
}

export interface StartPlazaResult {
  trip_id: string;
  play_id: string;
  scenario: Scenario;
  selected_items: Array<{
    inventory_row_id: string;
    item_id: string;
    item_name: string;
  }>;
  repeat_hint: string | null;
  played_times_before: number;
}

export async function startPlaza(input: StartPlazaInput): Promise<StartPlazaResult> {
  await assertCanDepart(input.companionId, 'plaza');

  const scenario = getScenario(input.scenarioId);
  if (!scenario) throw new Error('scenario_not_found');

  // 校验 3 件道具确实属于该 companion
  const selected: Array<{
    inventory_row_id: string;
    item_id: string;
    item_name: string;
  }> = [];
  for (const rowId of input.selectedItemRowIds) {
    const row = await findInventoryById(rowId);
    if (!row || row.companion_id !== input.companionId) {
      throw new Error(`invalid_item_row:${rowId}`);
    }
    selected.push({
      inventory_row_id: row.id,
      item_id: row.item_id,
      item_name: row.item_name,
    });
  }
  if (new Set(selected.map((s) => s.item_id)).size !== 3) {
    throw new Error('items_must_be_distinct');
  }

  const companion = await getCompanionById(input.companionId);
  if (!companion) throw new Error('companion_not_found');

  // 建 trip + plaza_play
  const trip = await createTrip({
    companionId: companion.id,
    tripType: 'plaza',
  });
  const play = await createPlazaPlay({
    companionId: companion.id,
    tripId: trip.id,
    scenarioId: scenario.id,
    scenarioTitle: scenario.title,
  });

  const playedTimesBefore = await countPlazaPlaysByScenario(
    companion.id,
    scenario.id,
  );
  const repeatHint = await getRepeatPlayHint(companion.id, scenario.id);

  return {
    trip_id: trip.id,
    play_id: play.id,
    scenario,
    selected_items: selected,
    repeat_hint: repeatHint,
    played_times_before: playedTimesBefore,
  };
}

// ──────────────────── act ────────────────────

export interface RunActInput {
  playId: string;
  actNumber: 1 | 2 | 3;
  /** inventory_items.id；null 表示孩子选了"不用道具" */
  selectedItemRowId: string | null;
}

export interface RunActResult {
  act: PlazaActOutput;
  is_final_act: boolean;
  selected_item: { inventory_row_id: string; item_id: string; item_name: string } | null;
}

export async function runAct(input: RunActInput): Promise<RunActResult> {
  const play = await getPlazaPlayById(input.playId);
  if (!play) throw new Error('play_not_found');
  if (play.finished_at) throw new Error('play_already_finished');

  const scenario = getScenario(play.scenario_id);
  if (!scenario) throw new Error('scenario_not_found');

  const prior = parseActChoices(play);
  if (prior.find((c) => c.act === input.actNumber)) {
    throw new Error('act_already_done');
  }
  if (input.actNumber !== (prior.length + 1)) {
    throw new Error(`out_of_order_act:expected_${prior.length + 1}`);
  }

  // 解析道具
  let selected: { inventory_row_id: string; item_id: string; item_name: string } | null =
    null;
  let itemIdForLLM: string | undefined;
  if (input.selectedItemRowId) {
    const row = await findInventoryById(input.selectedItemRowId);
    if (!row || row.companion_id !== play.companion_id) {
      throw new Error('invalid_item_row');
    }
    selected = {
      inventory_row_id: row.id,
      item_id: row.item_id,
      item_name: row.item_name,
    };
    itemIdForLLM = row.item_id;
  }

  // 跑 LLM
  const previousActs = prior
    .filter((c) => typeof c.narrative === 'string')
    .map((c) => ({ act: c.act, narrative: c.narrative as string }));
  const llm = await runPlazaAct(
    {
      scenario,
      actNumber: input.actNumber,
      previousActs,
      selectedItemId: input.selectedItemRowId ?? 'none',
      itemId: itemIdForLLM,
    },
    play.companion_id,
  );

  let actOut: PlazaActOutput;
  let quality: ItemUseQuality;
  if (llm.success) {
    actOut = llm.data;
    quality = llm.data.item_use_quality;
  } else {
    actOut = plazaActFallback(input.actNumber);
    // 兜底质量推断（基于剧本 applicable_items）
    quality = inferItemUseQuality(scenario, itemIdForLLM ?? null);
  }

  // 写 plaza_play.act_choices append
  const choice: ActChoiceWithNarrative = {
    act: input.actNumber,
    item_id: selected?.item_id ?? null,
    quality,
    narrative: actOut.scene_narrative,
    small_blue_dragon_speech: actOut.small_blue_dragon_speech,
    other_response: actOut.other_response,
    next_act_hook: actOut.next_act_hook,
  };
  await appendPlazaPlayChoice({ playId: play.id, choice });

  // bump item use_count（道具不消耗，但记次数 PRD §14.3.2）
  if (selected) {
    await bumpItemUseCount(selected.inventory_row_id);
  }

  return {
    act: actOut,
    is_final_act: input.actNumber === 3,
    selected_item: selected,
  };
}

// ──────────────────── finish ────────────────────

export interface FinishPlazaResult {
  ending: PlazaEndingOutput;
  earned_items: Array<{
    item_id: string;
    item_name: string;
    acquisition_reason: string;
    inventory_row_id: string;
    is_new: boolean;
    is_upgrade?: boolean;
  }>;
  source: 'llm' | 'fallback';
}

export async function finishPlaza(playId: string): Promise<FinishPlazaResult> {
  const play = await getPlazaPlayById(playId);
  if (!play) throw new Error('play_not_found');
  if (play.finished_at) {
    // 已完成 — 重新组装并返回
    return reconstructFinished(play);
  }

  const scenario = getScenario(play.scenario_id);
  if (!scenario) throw new Error('scenario_not_found');

  const acts = parseActChoices(play);
  if (acts.length !== 3) {
    throw new Error(`incomplete_acts:got_${acts.length}_need_3`);
  }

  // 跑 ending LLM
  const llm = await runPlazaEnding(
    {
      scenario,
      choices: acts.map((a) => ({
        act: a.act,
        item_id: a.item_id,
        quality: a.quality,
      })),
      actNarratives: acts
        .filter((a) => typeof a.narrative === 'string')
        .map((a) => ({ act: a.act, narrative: a.narrative as string })),
    },
    play.companion_id,
  );

  let ending: PlazaEndingOutput;
  let source: 'llm' | 'fallback';
  if (llm.success) {
    ending = llm.data;
    source = 'llm';
  } else {
    ending = plazaEndingFallback(scenario, acts);
    source = 'fallback';
  }

  // 计算最终奖励 + 落库
  const finalRewards: RewardItemPayload[] = computeFinalRewards(
    scenario,
    ending.ending_type,
    acts.map((a) => ({ act: a.act, item_id: a.item_id, quality: a.quality })),
    ending.earned_items,
  );
  const granted = await grantRewards(play.companion_id, scenario.id, finalRewards);

  // 写 plaza_play 完成状态
  await finishPlazaPlay({
    playId: play.id,
    endingType: ending.ending_type,
    endingNarrative: ending.ending_narrative,
    earnedItems: granted.map((g) => g.item_id),
  });

  // 关 trip
  if (play.trip_id) {
    await markTripReturned({
      tripId: play.trip_id,
      reportNarrative: ending.ending_narrative,
      reportData: {
        scenario_id: scenario.id,
        scenario_title: scenario.title,
        ending_type: ending.ending_type,
        king_evaluation: ending.king_evaluation,
        play_id: play.id,
        source,
      },
    });
  }

  // 组装返回
  const earnedView = finalRewards.map((r) => {
    const g = granted.find((x) => x.item_id === r.item_id);
    return {
      item_id: r.item_id,
      item_name: r.item_name,
      acquisition_reason: r.acquisition_reason,
      inventory_row_id: g?.inventory_row_id ?? '',
      is_new: !!g?.created,
      is_upgrade: r.is_upgrade,
    };
  });

  return { ending, earned_items: earnedView, source };
}

/** 已 finished 的 play 重新组装返回（GET /api/station/plaza/play/[id] 复用）*/
async function reconstructFinished(play: PlazaPlay): Promise<FinishPlazaResult> {
  const scenario = getScenario(play.scenario_id);
  const earnedIds = (play.earned_items as string[] | undefined) ?? [];
  const acts = parseActChoices(play);
  return {
    ending: {
      ending_type: play.ending_type ?? 'good',
      ending_narrative: play.ending_narrative ?? '',
      king_evaluation: '',
      earned_items: earnedIds.map((id) => ({
        item_id: id,
        item_name: id,
        acquisition_reason: '',
      })),
    },
    earned_items: earnedIds.map((id) => ({
      item_id: id,
      item_name: id,
      acquisition_reason: '',
      inventory_row_id: '',
      is_new: false,
    })),
    source: scenario ? 'fallback' : 'fallback',
  };
}

// ──────────────────── query ────────────────────

export interface PlazaPlayState {
  play_id: string;
  scenario_id: string;
  scenario_title: string | null;
  acts_done: number;
  acts: ActChoiceWithNarrative[];
  finished: boolean;
  ending_type: string | null;
  ending_narrative: string | null;
}

export async function getPlazaPlayState(
  playId: string,
): Promise<PlazaPlayState | null> {
  const play = await getPlazaPlayById(playId);
  if (!play) return null;
  const acts = parseActChoices(play);
  return {
    play_id: play.id,
    scenario_id: play.scenario_id,
    scenario_title: play.scenario_title ?? null,
    acts_done: acts.length,
    acts,
    finished: !!play.finished_at,
    ending_type: play.ending_type ?? null,
    ending_narrative: play.ending_narrative ?? null,
  };
}
