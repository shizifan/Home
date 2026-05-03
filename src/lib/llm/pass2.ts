/**
 * Pass 2 — 口语回应
 * 输入：当前 input + Pass 1 结果 + memory_bank summary
 * 输出：50 字以内的口语回应
 */

import 'server-only';

import { callLLM } from './client';
import { parsePass2Text } from './validators';
import { renderPrompt, loadFewShotJSON } from './promptLoader';
import {
  pickFallbackPass2AfterPhoto,
  pickFallbackPass2AfterText,
} from './fallbacks';
import type { CompanionPresetMeta } from '@/lib/companionPresets';
import type { MemoryBankEntry } from '@/types';
import type { Pass1Output } from './validators';

interface Pass2Input {
  companion: CompanionPresetMeta;
  day: number;
  inputType: 'photo' | 'text' | 'choice' | 'skipped' | 'voice' | 'describe';
  inputContent: string;
  pass1: Pass1Output;
  memoryBank: MemoryBankEntry[];
}

function summarizeBank(bank: MemoryBankEntry[]): string {
  if (bank.length === 0) return '（你才刚搬进来，还没记住什么）';
  const remembered = bank.filter((m) => m.type === 'remembered').slice(0, 5);
  if (!remembered.length) return '（你还在整理）';
  return remembered.map((m) => `- ${m.concept_name}`).join('\n');
}

/**
 * 起点性格衰减权重（PRD §6.2）
 * Day 1-2: 1.0 起点性格主导
 * Day 3:   0.7
 * Day 4:   0.5
 * Day 5+:  0.3 累积记忆覆盖
 */
function personalityWeight(day: number): number {
  if (day <= 2) return 1.0;
  if (day === 3) return 0.7;
  if (day === 4) return 0.5;
  return 0.3;
}

export async function runPass2(input: Pass2Input, companionId?: string) {
  const fewShotPath = `pass2/examples/${input.companion.preset_id}.json`;
  const fewShot = loadFewShotJSON(fewShotPath);

  // 性格衰减：高权重时全部 3 条；中权重 2 条；低权重 1 条
  const weight = personalityWeight(input.day);
  const exampleCount = weight >= 0.8 ? 3 : weight >= 0.5 ? 2 : 1;
  const personalityExamples = input.companion.personality_examples
    .slice(0, exampleCount)
    .map((s) => `- ${s}`)
    .join('\n');

  // 低权重时加一行注：让 LLM 知道现在该让记忆主导语气
  const decayNote =
    weight < 0.5
      ? '\n\n【注意】你已经认识这个孩子好多天了。回应语气可以更熟悉、更自然，不必只用起点的表达方式。'
      : '';

  const systemPrompt =
    renderPrompt(
      'pass2',
      {
        name: input.companion.name,
        appearance: input.companion.appearance,
        personality: input.companion.personality,
        personality_examples: personalityExamples,
        day: input.day,
        current_input_description: describeInput(input),
        pass1_action: input.pass1.action,
        pass1_concept_name: input.pass1.concept_name,
        pass1_ai_reasoning: input.pass1.ai_reasoning,
        memory_bank_summary: summarizeBank(input.memoryBank),
      },
      fewShot,
    ) + decayNote;

  const result = await callLLM<string>({
    callType: 'pass2',
    systemPrompt,
    userPrompt: '请用一句话回应。',
    expectJson: false,
    parse: (raw) => parsePass2Text(raw),
    companionId,
    promptVersion: 'v1',
    maxRetries: 1,
  });
  return result;
}

/** Pass 2 全部失败时取备用文案 */
export function pass2Fallback(
  inputType: 'photo' | 'text' | 'choice' | 'skipped' | 'voice' | 'describe',
): string {
  if (inputType === 'photo' || inputType === 'describe') return pickFallbackPass2AfterPhoto();
  return pickFallbackPass2AfterText();
}

function describeInput(input: Pass2Input): string {
  if (input.inputType === 'photo') return `孩子刚拍了一张照片`;
  if (input.inputType === 'describe') return `孩子刚描述完一个场景：${input.inputContent.slice(0, 200)}`;
  if (input.inputType === 'voice') return `孩子用语音说：${input.inputContent.slice(0, 200)}`;
  if (input.inputType === 'text') return `孩子写了：${input.inputContent.slice(0, 200)}`;
  if (input.inputType === 'choice') return `孩子选了：${input.inputContent}`;
  return `孩子今天跳过了任务。`;
}
