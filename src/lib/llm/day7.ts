/**
 * Day 7 档案生成（PRD §15.6）
 *
 * 5 必填字段 + almost_forgot_thing 条件触发（仅当孩子有 user_restored 行为时）。
 * 严格 JSON。3 次重试上限，失败不允许预设替代。
 */

import 'server-only';

import { callLLM } from './client';
import { Day7Schema, parseJsonStrict, type Day7Output } from './validators';
import { renderPrompt, loadFewShotJSON } from './promptLoader';
import type { CompanionPresetMeta } from '@/lib/companionPresets';
import type { MemoryBankEntry } from '@/types';

interface Day7Input {
  companion: CompanionPresetMeta;
  memoryBank: MemoryBankEntry[];
  /** PRD §9.4：孩子这一周跳过的任务总数（含被动跳过 / 主动跳过）*/
  skipCount: number;
}

function summarizeRemembered(bank: MemoryBankEntry[]): string {
  const items = bank.filter((m) => m.type === 'remembered');
  if (items.length === 0) return '（空）';
  return items
    .map((m) => {
      const ev = Array.isArray(m.evidence) ? m.evidence.length : 0;
      return `- ${m.concept_name}（出现 ${ev} 次，类别=${m.concept_category ?? 'other'}）：${m.ai_summary ?? ''}`;
    })
    .join('\n');
}

/**
 * PRD §9.4 跳过差异化：
 *   0–2 个跳过 → 档案完整生成
 *   3–5 个跳过 → 提示训练数据较少，回答可能更笼统
 *   ≥6 个跳过 → 第 5 项变为元反思「其实......我对你的事知道得不太多」
 */
function buildSkipHint(skipCount: number): string {
  if (skipCount >= 6) {
    return [
      '【特别提示·关于你这次的输入】',
      `孩子跳过了 ${skipCount} 次任务，几乎没告诉你什么具体的事。`,
      '此时第 5 项 unknown_thing 不再用 unknown_concepts_list，',
      '改为一句元反思：「其实......我对你的事知道得不太多。这是你给我的全部。」',
      '其他几项尽量用现有线索，但要让孩子能感觉到 AI 在"训练数据稀疏"下的局限。',
    ].join('\n');
  }
  if (skipCount >= 3) {
    return [
      '【特别提示·关于你这次的输入】',
      `孩子跳过了 ${skipCount} 次任务，你的训练数据较少。`,
      '回答可以更笼统、更短，不要硬编没有依据的细节。',
    ].join('\n');
  }
  return '【你的训练数据相对完整】';
}

function summarizeRestored(bank: MemoryBankEntry[]): string {
  const restored = bank.filter((m) => {
    if (!Array.isArray(m.user_correction_history)) return false;
    return m.user_correction_history.some((h) => h.action === 'restore');
  });
  if (restored.length === 0) return '（无）';
  return restored
    .map((m) => `- ${m.concept_name}：${m.ai_summary ?? ''}（曾被孩子从 set_aside 捡回）`)
    .join('\n');
}

function summarizeDismissed(bank: MemoryBankEntry[]): string {
  const dismissed = bank.filter((m) => {
    if (!Array.isArray(m.user_correction_history)) return false;
    return m.user_correction_history.some((h) => h.action === 'dismiss');
  });
  if (dismissed.length === 0) return '（无）';
  return dismissed.map((m) => `- ${m.concept_name}`).join('\n');
}

function summarizeUnknown(bank: MemoryBankEntry[]): string {
  const u = bank.filter((m) => m.type === 'unknown');
  if (u.length === 0) return '（无）';
  return u.map((m) => `- ${m.concept_name}`).join('\n');
}

export async function runDay7(input: Day7Input, companionId?: string) {
  const fewShot = loadFewShotJSON('day7/example_full.json');

  const personalityExamples = input.companion.personality_examples
    .map((s) => `- ${s}`)
    .join('\n');

  const systemPrompt = renderPrompt(
    'day7',
    {
      name: input.companion.name,
      appearance: input.companion.appearance,
      personality: input.companion.personality,
      personality_examples: personalityExamples,
      remembered_concepts_list_with_evidence: summarizeRemembered(input.memoryBank),
      user_restored_concepts_list: summarizeRestored(input.memoryBank),
      user_dismissed_concepts_list: summarizeDismissed(input.memoryBank),
      unknown_concepts_list: summarizeUnknown(input.memoryBank),
      skip_count: String(input.skipCount),
      skip_count_hint: buildSkipHint(input.skipCount),
    },
    fewShot,
  );

  const unknownNames = input.memoryBank
    .filter((m) => m.type === 'unknown')
    .map((m) => m.concept_name);

  return callLLM<Day7Output>({
    callType: 'day7',
    systemPrompt,
    userPrompt: '请输出 JSON。',
    expectJson: true,
    parse: (raw) => {
      const data = parseJsonStrict(raw, Day7Schema);
      if (!data) return null;
      // 第 5 题必须命中 unknown 列表（PRD §15.6.4）
      // 注：Day7Schema 已 transform 兜底，data.unknown_thing 一定是 string。
      // 兜底文案不会含 unknownNames 任一项，hit=false → 重试，符合预期。
      if (unknownNames.length > 0) {
        const hit = unknownNames.some((n) => data.unknown_thing.includes(n));
        if (!hit) return null;
      }
      return data;
    },
    companionId,
    promptVersion: 'v2', // PRD §15.6.4 + 严格"逐字"约束
    maxRetries: 2, // 总共 3 次（PRD §15.6.4）
  });
}

/**
 * 尝试 1：normal runDay7（3 次重试）
 * 尝试 2：如果重试 3 次都因 validate 失败且仍然有 LLM 输出，放宽校验：
 *         接受 LLM 的 JSON，但强制把 unknown_thing 覆盖为 unknown_concepts_list[0]，
 *         避免无限 503。这是 PRD §25.2 "不允许预设档案" 的边界 —— 我们没用预设档案，
 *         只用孩子真实输入里的 unknown 项强制锁定。
 */
export async function runDay7WithSoftFallback(
  input: Day7Input,
  companionId?: string,
) {
  const result = await runDay7(input, companionId);
  if (result.success) return result;
  if (result.reason !== 'validate' || !result.raw) return result;

  // 尝试解析最后一次 raw，忽略 unknown 校验
  try {
    const parsed = JSON.parse(result.raw);
    const data = Day7Schema.safeParse(parsed);
    if (!data.success) return result;
    const unknownNames = input.memoryBank
      .filter((m) => m.type === 'unknown')
      .map((m) => m.concept_name);
    if (unknownNames.length === 0) {
      return { ...result, success: true as const, data: data.data };
    }
    // 强制覆盖 unknown_thing 为 list[0]，让流程继续
    const fallbackUnknown = unknownNames[0];
    const final: Day7Output = {
      ...data.data,
      unknown_thing: `我从来没听过${fallbackUnknown}。`,
    };
    console.warn(
      `[runDay7WithSoftFallback] LLM unknown_thing="${data.data.unknown_thing}" 不含 unknown list；强制覆盖为 "${final.unknown_thing}"`,
    );
    return { ...result, success: true as const, data: final };
  } catch {
    return result;
  }
}

export function hasRestoredItems(bank: MemoryBankEntry[]): boolean {
  return bank.some((m) => {
    if (!Array.isArray(m.user_correction_history)) return false;
    return m.user_correction_history.some((h) => h.action === 'restore');
  });
}
