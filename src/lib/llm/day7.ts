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
  /** 累计跳过的任务数（用于 Day 7 三档模式）*/
  skipCount?: number;
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

  // skipMode 三档处理（Plan_04 §1.3）
  const skipMode: 'normal' | 'limited' | 'sparse' =
    (input.skipCount ?? 0) >= 6 ? 'sparse' : (input.skipCount ?? 0) >= 3 ? 'limited' : 'normal';

  const promptNote =
    skipMode === 'sparse'
      ? '\n\n【重要】孩子的输入非常少。第5项"我完全不知道"应该直接反思训练数据不足。'
      : skipMode === 'limited'
        ? '\n\n【提示】孩子的输入有限。回答可以更笼统一些。'
        : '';

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
    },
    fewShot,
  );

  const result = await callLLM<Day7Output>({
    callType: 'day7',
    systemPrompt: systemPrompt + promptNote,
    userPrompt: '请输出 JSON。',
    expectJson: true,
    parse: (raw) => {
      const data = parseJsonStrict(raw, Day7Schema);
      if (!data) return null;
      // 第 5 题必须命中 unknown 列表（PRD §15.6.4）
      // sparse 模式跳过此验证（因为会被硬替换）
      if (skipMode !== 'sparse') {
        const unknownNames = input.memoryBank
          .filter((m) => m.type === 'unknown')
          .map((m) => m.concept_name);
        if (unknownNames.length > 0) {
          const hit = unknownNames.some((n) => data.unknown_thing.includes(n));
          if (!hit) return null;
        }
      }
      return data;
    },
    companionId,
    promptVersion: 'v1',
    maxRetries: 2,
  });

  // sparse 模式：硬替换第 5 项为固定反思文案
  if (result.success && skipMode === 'sparse') {
    result.data.unknown_thing = '其实……我对你的事知道得不太多。这是你给我的全部。';
  }

  return result;
}

export function hasRestoredItems(bank: MemoryBankEntry[]): boolean {
  return bank.some((m) => {
    if (!Array.isArray(m.user_correction_history)) return false;
    return m.user_correction_history.some((h) => h.action === 'restore');
  });
}
