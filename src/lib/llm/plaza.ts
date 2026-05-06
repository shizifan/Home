/**
 * 广场剧本 LLM 调用（PRD §14 / §23.12 / §23.13）
 *
 * 两个调用点：
 *   - runPlazaAct：每幕实时调用（5-8s）；输入选定道具 + 前面幕的摘要 → 输出本幕叙事
 *   - runPlazaEnding：第 3 幕完成后调用；输入 3 次选择 → 输出 ending_type + 叙事 + 奖励列表
 *
 * 失败：1 次重试都失败 → 兜底文案；不抛错（让流程能走完）。
 */

import 'server-only';

import { z } from 'zod';
import { callLLM, type LLMResult } from './client';
import { parseJsonStrict } from './validators';
import { renderPrompt, loadFewShotJSON } from './promptLoader';
import { getItemDef } from '@/lib/station/itemPool';
import type {
  ActChoice,
  EndingType,
  ItemUseQuality,
  Scenario,
  ScenarioRewards,
} from '@/types';

// ──────────────────── runPlazaAct ────────────────────

const PlazaActSchema = z.object({
  scene_narrative: z.string().min(10).max(400),
  small_blue_dragon_speech: z.string().min(2).max(120),
  other_response: z.string().min(2).max(120),
  next_act_hook: z.string().max(120),
  item_use_quality: z.enum(['natural', 'stretched', 'skipped']),
});

export type PlazaActOutput = z.infer<typeof PlazaActSchema>;

export interface PlazaActInput {
  scenario: Scenario;
  actNumber: 1 | 2 | 3;
  /** 之前幕的叙事摘要（按 act 顺序）；act_number=1 时为空数组 */
  previousActs: Array<{ act: 1 | 2 | 3; narrative: string }>;
  /** 孩子选的道具 inventory_items.id；'none' 表示不用道具 */
  selectedItemId: string;
  /** 该 inventory 行对应的 item_id（道具池标识）；'none' 时为 undefined */
  itemId?: string;
}

function rolesBlock(scenario: Scenario): string {
  return Object.entries(scenario.roles)
    .map(([presetId, role]) => `- ${role}（preset_id=${presetId}）`)
    .join('\n');
}

function previousActsSummary(
  acts: Array<{ act: 1 | 2 | 3; narrative: string }>,
): string {
  if (acts.length === 0) return '（这是第一幕，前面还没发生什么）';
  return acts
    .sort((a, b) => a.act - b.act)
    .map((a) => `第 ${a.act} 幕：${a.narrative}`)
    .join('\n\n');
}

function actSkeleton(scenario: Scenario, actNumber: number): string {
  const act = scenario.acts.find((a) => a.number === actNumber);
  if (!act) return '（无骨架）';
  return [
    `第 ${act.number} 幕 · ${act.name}`,
    `场景：${act.scene}`,
    `决策提示：${act.decision_prompt}`,
    `品质判定参考：${act.expected_quality_hint}`,
  ].join('\n');
}

export async function runPlazaAct(
  input: PlazaActInput,
  companionId?: string,
): Promise<LLMResult<PlazaActOutput>> {
  const fewShot = loadFewShotJSON('plaza_act/examples.json');
  const itemDef = input.itemId ? getItemDef(input.itemId) : undefined;

  const systemPrompt = renderPrompt(
    'plaza_act',
    {
      scenario_id: input.scenario.id,
      scenario_title: input.scenario.title,
      scenario_background: input.scenario.background,
      act_number: String(input.actNumber),
      roles_block: rolesBlock(input.scenario),
      previous_acts_summary: previousActsSummary(input.previousActs),
      act_skeleton: actSkeleton(input.scenario, input.actNumber),
      selected_item_id: input.itemId ?? 'none',
      selected_item_name: itemDef?.name ?? '不用道具',
      selected_item_description:
        itemDef?.description ?? '孩子选择凭直觉，不用任何道具。',
    },
    fewShot,
  );

  return callLLM<PlazaActOutput>({
    callType: 'plaza_act',
    systemPrompt,
    userPrompt: '请输出 JSON。',
    expectJson: true,
    parse: (raw) => parseJsonStrict(raw, PlazaActSchema),
    companionId,
    promptVersion: 'plaza_act_v1',
    maxRetries: 1,
  });
}

export function plazaActFallback(actNumber: number): PlazaActOutput {
  return {
    scene_narrative: '这一幕剧情卡了一下......国王示意大家先休息。',
    small_blue_dragon_speech: '......让我再想想。',
    other_response: '国王点头：丞相先想一想。',
    next_act_hook: actNumber < 3 ? '先暂停一下，等丞相想好。' : '',
    item_use_quality: 'skipped',
  };
}

// ──────────────────── runPlazaEnding ────────────────────

const EarnedItemSchema = z.object({
  item_id: z.string().min(1).max(60),
  item_name: z.string().min(1).max(60),
  acquisition_reason: z.string().min(2).max(120),
});

const PlazaEndingSchema = z.object({
  ending_type: z.enum(['perfect', 'good', 'barely']),
  ending_narrative: z.string().min(10).max(400),
  king_evaluation: z.string().min(2).max(80),
  earned_items: z.array(EarnedItemSchema).min(1).max(4),
});

export type PlazaEndingOutput = z.infer<typeof PlazaEndingSchema>;

export interface PlazaEndingInput {
  scenario: Scenario;
  choices: ActChoice[];
  actNarratives: Array<{ act: 1 | 2 | 3; narrative: string }>;
}

function rewardsBlock(rewards: ScenarioRewards): string {
  return [
    `always: ${rewards.always.join(', ') || '（空）'}`,
    `perfect: ${rewards.perfect.join(', ') || '（空）'}`,
    `good: ${rewards.good.join(', ') || '（空）'}`,
    `barely: ${rewards.barely.join(', ') || '（空）'}`,
  ].join('\n');
}

function choicesBlock(input: PlazaEndingInput): string {
  return input.choices
    .map((c) => {
      const def = c.item_id ? getItemDef(c.item_id) : null;
      const itemDisplay =
        c.item_id === null
          ? '不用道具'
          : def
            ? `${def.name}（${def.id}）`
            : c.item_id;
      const narr =
        input.actNarratives.find((a) => a.act === c.act)?.narrative ?? '（无）';
      return [
        `第 ${c.act} 幕：选了 ${itemDisplay}`,
        `品质：${c.quality ?? 'unknown'}`,
        `叙事摘要：${narr.slice(0, 120)}`,
      ].join('\n');
    })
    .join('\n\n');
}

export async function runPlazaEnding(
  input: PlazaEndingInput,
  companionId?: string,
): Promise<LLMResult<PlazaEndingOutput>> {
  const fewShot = loadFewShotJSON('plaza_ending/examples.json');
  const systemPrompt = renderPrompt(
    'plaza_ending',
    {
      scenario_id: input.scenario.id,
      scenario_title: input.scenario.title,
      choices_block: choicesBlock(input),
      rewards_block: rewardsBlock(input.scenario.rewards),
    },
    fewShot,
  );

  return callLLM<PlazaEndingOutput>({
    callType: 'plaza_ending',
    systemPrompt,
    userPrompt: '请输出 JSON。',
    expectJson: true,
    parse: (raw) => parseJsonStrict(raw, PlazaEndingSchema),
    companionId,
    promptVersion: 'plaza_ending_v1',
    maxRetries: 1,
  });
}

/**
 * 兜底结局（LLM 完全失败时）：按规则计算 ending_type + 必发 always 道具。
 * 不调 LLM，直接根据 choices.quality 计数 natural 数。
 */
export function plazaEndingFallback(
  scenario: Scenario,
  choices: ActChoice[],
): PlazaEndingOutput {
  const naturalCount = choices.filter((c) => c.quality === 'natural').length;
  const endingType: EndingType =
    naturalCount === 3 ? 'perfect' : naturalCount === 2 ? 'good' : 'barely';
  const tierItems = scenario.rewards[endingType] ?? [];
  const items = [...scenario.rewards.always, ...tierItems.slice(0, 1)];
  const earned_items = items.map((id) => {
    const def = getItemDef(id);
    return {
      item_id: id,
      item_name: def?.name ?? id,
      acquisition_reason: '故事告一段落，这件物品落到你手里。',
    };
  });
  return {
    ending_type: endingType,
    ending_narrative: '故事在这里告一段落。剧情有些没说清楚，但事情终归是过去了。',
    king_evaluation: '丞相辛苦了。',
    earned_items,
  };
}

/** 决定 quality（在调用 LLM 前推断 — 给 fallback 用）*/
export function inferItemUseQuality(
  scenario: Scenario,
  itemId: string | null,
): ItemUseQuality {
  if (!itemId) return 'skipped';
  if (scenario.applicable_items.includes(itemId)) return 'natural';
  return 'stretched';
}
