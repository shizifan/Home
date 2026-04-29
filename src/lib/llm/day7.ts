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

  return callLLM<Day7Output>({
    callType: 'day7',
    systemPrompt,
    userPrompt: '请输出 JSON。',
    expectJson: true,
    parse: (raw) => {
      const data = parseJsonStrict(raw, Day7Schema);
      if (!data) return null;
      // 第 5 题必须命中 unknown 列表（PRD §15.6.4）
      const unknownNames = input.memoryBank
        .filter((m) => m.type === 'unknown')
        .map((m) => m.concept_name);
      if (unknownNames.length > 0) {
        const hit = unknownNames.some((n) => data.unknown_thing.includes(n));
        if (!hit) {
          // LLM 没引用任何 unknown 概念 — 验证失败
          return null;
        }
      }
      return data;
    },
    companionId,
    promptVersion: 'v1',
    maxRetries: 2, // 总共 3 次（PRD §15.6.4）
  });
}

export function hasRestoredItems(bank: MemoryBankEntry[]): boolean {
  return bank.some((m) => {
    if (!Array.isArray(m.user_correction_history)) return false;
    return m.user_correction_history.some((h) => h.action === 'restore');
  });
}
