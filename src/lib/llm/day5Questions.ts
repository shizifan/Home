/**
 * Day 5 它问你的问题（PRD §3 Day 5 + §11.3）
 *
 * 输入：当前 memory_bank 摘要
 * 输出：2 个推测性问题，每题 3 个选项（其中一个故意是"误解"）
 *
 * 失败时取通用问句备用文案（PRD §11.6）。
 */

import 'server-only';

import { z } from 'zod';
import { callLLM } from './client';
import { parseJsonStrict } from './validators';
import type { CompanionPresetMeta } from '@/lib/companionPresets';
import type { MemoryBankEntry } from '@/types';

const Day5Schema = z.object({
  questions: z
    .array(
      z.object({
        question: z.string().min(2).max(80),
        options: z.array(z.string().min(1).max(40)).length(3),
      }),
    )
    .length(2),
});

export type Day5Output = z.infer<typeof Day5Schema>;

interface Input {
  companion: CompanionPresetMeta;
  memoryBank: MemoryBankEntry[];
}

const SYSTEM_PROMPT = `你是 {{name}}，{{appearance}}。你的性格是 {{personality}}。

已经在小家住了 5 天，认识了一个 8–12 岁的孩子。

你的"记忆面板"里已经有这些事：

{{memory_summary}}

今天你想问孩子 2 个问题——基于你对 ta 的理解，做"推测性"的判断，看自己理解得对不对。

【出题原则】
- 每题 3 个选项：1 个是"你觉得最像孩子的"猜测；1 个是合理但不太像的；1 个是明显不符合的"误解"
- 用 {{personality}} 的语气说出问题（如小青龙：用省略号、慢慢说）
- 问题要带主观判断："我猜你最喜欢的是？" 而不是泛泛的"你最喜欢什么？"
- 不要问敏感话题
- 用孩子能听懂的中文，每选项 ≤ 12 字

【输出严格 JSON】
{
  "questions": [
    {
      "question": "...",
      "options": ["...", "...", "..."]
    },
    {
      "question": "...",
      "options": ["...", "...", "..."]
    }
  ]
}`;

export async function runDay5Questions(input: Input, companionId?: string) {
  const summary = input.memoryBank
    .filter((m) => m.type === 'remembered')
    .slice(0, 10)
    .map((m) => `- ${m.concept_name}：${m.ai_summary ?? ''}`)
    .join('\n');

  const systemPrompt = SYSTEM_PROMPT.replaceAll('{{name}}', input.companion.name)
    .replaceAll('{{appearance}}', input.companion.appearance)
    .replaceAll('{{personality}}', input.companion.personality)
    .replaceAll('{{memory_summary}}', summary || '（你才认识不久）');

  return callLLM<Day5Output>({
    callType: 'concept_detail', // 复用 max=400, temp=0.5, t/o=10s
    systemPrompt,
    userPrompt: '请输出 JSON。',
    expectJson: true,
    parse: (raw) => parseJsonStrict(raw, Day5Schema),
    companionId,
    promptVersion: 'day5_v1',
    maxRetries: 1,
  });
}

/** Day 5 LLM 失败时的通用回退问题（PRD §11.6） */
export const DAY5_FALLBACK: Day5Output = {
  questions: [
    {
      question: '我能问你一个问题吗？你最喜欢什么？',
      options: ['和家人在一起', '一个人安静做事', '和朋友玩'],
    },
    {
      question: '告诉我一件你今天最难忘的事吧？',
      options: ['一件开心的事', '一件难过的事', '没什么特别的'],
    },
  ],
};
