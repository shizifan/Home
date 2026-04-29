/**
 * Pass 1 — 记忆归类
 * 输入：当前 input + memory_bank 摘要
 * 输出：Pass1Output（已解析 + 验证）；失败时返回降级 set_aside 占位
 */

import 'server-only';

import { callLLM } from './client';
import { Pass1Schema, parseJsonStrict, type Pass1Output } from './validators';
import { renderPrompt, loadFewShotJSON } from './promptLoader';
import { PASS1_FAIL_REASONING } from './fallbacks';
import type { CompanionPresetMeta } from '@/lib/companionPresets';
import type { MemoryBankEntry, VisionTags } from '@/types';

interface Pass1Input {
  companion: CompanionPresetMeta;
  day: number;
  inputType: 'photo' | 'text' | 'choice' | 'skipped';
  inputContent: string;
  visionTags?: VisionTags;
  memoryBank: MemoryBankEntry[];
}

const FEW_SHOT_FILES = [
  'pass1/examples/create_new.json',
  'pass1/examples/append.json',
  'pass1/examples/uncertain.json',
  'pass1/examples/set_aside.json',
];

function buildFewShot(): string {
  return FEW_SHOT_FILES.map(loadFewShotJSON).join('\n\n');
}

function summarizeMemoryBank(bank: MemoryBankEntry[]): string {
  // 只把摘要 + id 注入 prompt，不放完整 evidence —— 避免 token 通胀（PRD §15.9.2）
  if (bank.length === 0) return '（空 — 这是 Day 1 第一次输入）';
  const grouped = {
    remembered: [] as string[],
    uncertain: [] as string[],
    set_aside: [] as string[],
    unknown: [] as string[],
  };
  for (const m of bank) {
    const line = `  - {id: "${m.id}", name: "${m.concept_name}"${m.ai_summary ? `, summary: "${m.ai_summary}"` : ''}}`;
    grouped[m.type as keyof typeof grouped]?.push(line);
  }
  const sections = [];
  if (grouped.remembered.length)
    sections.push(`remembered:\n${grouped.remembered.join('\n')}`);
  if (grouped.uncertain.length)
    sections.push(`uncertain:\n${grouped.uncertain.join('\n')}`);
  if (grouped.set_aside.length)
    sections.push(`set_aside:\n${grouped.set_aside.join('\n')}`);
  if (grouped.unknown.length)
    sections.push(`unknown:\n${grouped.unknown.join('\n')}`);
  return sections.join('\n\n');
}

export async function runPass1(input: Pass1Input, companionId?: string) {
  const personalityExamples = input.companion.personality_examples
    .map((s) => `- ${s}`)
    .join('\n');

  const systemPrompt = renderPrompt(
    'pass1',
    {
      name: input.companion.name,
      appearance: input.companion.appearance,
      personality: input.companion.personality,
      personality_examples: personalityExamples,
      day: input.day,
      memory_bank_json: summarizeMemoryBank(input.memoryBank),
      current_input_description: describeInput(input),
      input_type: input.inputType,
      input_content: input.inputContent,
      vision_tags: input.visionTags ? JSON.stringify(input.visionTags) : '（无）',
    },
    buildFewShot(),
  );

  const result = await callLLM<Pass1Output>({
    callType: 'pass1',
    systemPrompt,
    userPrompt: '请输出 JSON。',
    expectJson: true,
    parse: (raw) => parseJsonStrict(raw, Pass1Schema),
    companionId,
    promptVersion: 'v1',
    maxRetries: 1,
  });

  if (result.success) {
    // 校验 target_concept_id 必须能在 memory_bank 中找到
    if (result.data.action === 'append_to_existing') {
      const exists = input.memoryBank.some((m) => m.id === result.data.target_concept_id);
      if (!exists) {
        // 降级：当成 create_new 处理（PRD §15.2.4）
        return {
          ...result,
          data: { ...result.data, action: 'create_new' as const, target_concept_id: null },
        };
      }
    }
  }
  return result;
}

/**
 * Pass 1 全部失败时的降级输出（写一条 set_aside）
 */
export function pass1FallbackSetAside(input: Pass1Input): Pass1Output {
  return {
    action: 'set_aside',
    concept_name:
      input.inputType === 'skipped'
        ? '你今天没告诉我的事'
        : '我没整理完的事',
    concept_category: 'other',
    target_concept_id: null,
    evidence_text: input.inputContent.slice(0, 100) || '(空输入)',
    ai_reasoning: PASS1_FAIL_REASONING,
    confidence: 0.5,
  };
}

function describeInput(input: Pass1Input): string {
  if (input.inputType === 'photo') {
    return `孩子拍了一张照片，Vision 标签：${input.visionTags ? JSON.stringify(input.visionTags.objects ?? []) : '（无）'}`;
  }
  if (input.inputType === 'text') {
    return `孩子写了一段文字：${input.inputContent}`;
  }
  if (input.inputType === 'choice') {
    return `孩子从选项中选了：${input.inputContent}`;
  }
  return `孩子今天选择跳过任务（task_id 在上下文中）。`;
}
