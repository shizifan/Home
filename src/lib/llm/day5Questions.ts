/**
 * Day 5 它问你的问题（PRD §5.6 + §18.3）
 *
 * 出题逻辑（V0.6.2 重构）：
 *   - Q1：基于 memory_bank 的"推测性"判断题
 *   - Q2：基于 Q1 + 孩子的回答，做跟进问题（PRD §5.6 "根据第一题答案，LLM 生成跟进问题"）
 *
 * 失败时取通用问句备用文案（PRD §25.2）。
 */

import 'server-only';

import { z } from 'zod';
import { callLLM } from './client';
import { parseJsonStrict } from './validators';
import type { CompanionPresetMeta } from '@/lib/companionPresets';
import type { MemoryBankEntry } from '@/types';

const SingleQuestionSchema = z.object({
  question: z.string().min(2).max(80),
  options: z.array(z.string().min(1).max(40)).length(3),
});

export type Day5Question = z.infer<typeof SingleQuestionSchema>;

interface Q1Input {
  companion: CompanionPresetMeta;
  memoryBank: MemoryBankEntry[];
}

interface Q2Input extends Q1Input {
  q1: string;
  a1: string;
}

const Q1_PROMPT = `你是 {{name}}，{{appearance}}。你的性格是 {{personality}}。

已经在小家住了 5 天，认识了一个 8–12 岁的孩子。

你的"记忆面板"里已经有这些事：

{{memory_summary}}

今天你想问孩子第 1 个问题——基于你对 ta 的理解，做一个"推测性"的判断题，看自己理解得对不对。

【出题原则】
- 3 个选项：1 个是"你觉得最像孩子的"猜测；1 个是合理但不太像的；1 个是明显的"误解"
- 用 {{personality}} 的语气说出问题（如小青龙：用省略号、慢慢说）
- 问题要带主观判断："我猜你最喜欢的是？" 而不是泛泛的"你最喜欢什么？"
- 不要问敏感话题
- 用孩子能听懂的中文，每选项 ≤ 12 字

【输出严格 JSON】
{
  "question": "...",
  "options": ["...", "...", "..."]
}`;

const Q2_PROMPT = `你是 {{name}}，{{appearance}}。你的性格是 {{personality}}。

刚刚你问了孩子第 1 个问题，孩子做了选择。现在你要追问第 2 个问题。

【你的记忆面板】
{{memory_summary}}

【刚才发生的对话】
你问：{{q1}}
孩子选了：{{a1}}

【你现在要做的】
基于孩子刚才的选择，自然地追问下去。要让孩子感觉你在认真听。

【出题原则】
- 跟第 1 题有逻辑关联（"既然你选了 X，那……"）
- 3 个选项；1 个是"你觉得最像"，1 个是合理替代，1 个是明显不对
- 用 {{personality}} 的语气
- 不要问敏感话题
- 每选项 ≤ 12 字

【输出严格 JSON】
{
  "question": "...",
  "options": ["...", "...", "..."]
}`;

function buildSummary(bank: MemoryBankEntry[]): string {
  const summary = bank
    .filter((m) => m.type === 'remembered')
    .slice(0, 10)
    .map((m) => `- ${m.concept_name}：${m.ai_summary ?? ''}`)
    .join('\n');
  return summary || '（你才认识不久）';
}

export async function runDay5Q1(input: Q1Input, companionId?: string) {
  const systemPrompt = Q1_PROMPT.replaceAll('{{name}}', input.companion.name)
    .replaceAll('{{appearance}}', input.companion.appearance)
    .replaceAll('{{personality}}', input.companion.personality)
    .replaceAll('{{memory_summary}}', buildSummary(input.memoryBank));

  return callLLM<Day5Question>({
    callType: 'concept_detail',
    systemPrompt,
    userPrompt: '请输出 JSON。',
    expectJson: true,
    parse: (raw) => parseJsonStrict(raw, SingleQuestionSchema),
    companionId,
    promptVersion: 'day5_q1_v1',
    maxRetries: 1,
  });
}

export async function runDay5Q2(input: Q2Input, companionId?: string) {
  const systemPrompt = Q2_PROMPT.replaceAll('{{name}}', input.companion.name)
    .replaceAll('{{appearance}}', input.companion.appearance)
    .replaceAll('{{personality}}', input.companion.personality)
    .replaceAll('{{memory_summary}}', buildSummary(input.memoryBank))
    .replaceAll('{{q1}}', input.q1)
    .replaceAll('{{a1}}', input.a1);

  return callLLM<Day5Question>({
    callType: 'concept_detail',
    systemPrompt,
    userPrompt: '请输出 JSON。',
    expectJson: true,
    parse: (raw) => parseJsonStrict(raw, SingleQuestionSchema),
    companionId,
    promptVersion: 'day5_q2_v1',
    maxRetries: 1,
  });
}

/** Day 5 LLM 失败时的通用回退（PRD §25.2） */
export const DAY5_FALLBACK_Q1: Day5Question = {
  question: '我能问你一个问题吗？你最喜欢什么？',
  options: ['和家人在一起', '一个人安静做事', '和朋友玩'],
};

export const DAY5_FALLBACK_Q2: Day5Question = {
  question: '告诉我一件你今天最难忘的事吧？',
  options: ['一件开心的事', '一件难过的事', '没什么特别的'],
};
