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

/**
 * PRD §5.6 Day 5 第一题：伙伴说一个**判断陈述**（轻度以偏概全），孩子答 是 / 不是 / 一半一半。
 * 第二题：基于第一题答案，伙伴再说一个跟进的判断陈述。两题都用同样的三档选项。
 * 选项是固定的，由 LLM 只生成判断陈述（statement）即可。
 */
const FIXED_OPTIONS = ['是', '不是', '一半一半'] as const;

const SingleQuestionSchema = z.object({
  /** 判断陈述（PRD §5.6："我猜你最喜欢的是搭积木？"这种带主观判断的句子）*/
  question: z.string().min(2).max(80),
});

export interface Day5Question {
  question: string;
  options: string[];
}

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

今天你想做一件事：把你对孩子的"判断"说出来，让 ta 给你确认对不对。

【出题原则·关键】
- 你只输出一个**判断陈述**（statement），不输出选项。孩子会用"是 / 不是 / 一半一半"三种回答之一来回应你。
- 这个判断必须**轻微"以偏概全"**——你基于已有的几条证据下了一个略微泛化的结论。例如孩子提过 3 次饺子，你判断"你最爱吃的就是饺子"——可能对，也可能"一半一半"。
- 用 {{personality}} 的语气说话
- 用第一人称视角："我猜你..." / "我觉得你..." / "你应该..."
- 长度≤30 字
- 不问敏感话题

【输出严格 JSON】
{
  "question": "我猜你最爱吃的就是妈妈包的饺子？"
}`;

const Q2_PROMPT = `你是 {{name}}，{{appearance}}。你的性格是 {{personality}}。

刚刚你说了一句判断，孩子用三档选项回应了你。现在你要再说一个跟进的判断。

【你的记忆面板】
{{memory_summary}}

【刚才发生的对话】
你说：{{q1}}
孩子答：{{a1}}（选项是"是"/"不是"/"一半一半"）

【你现在要做的】
- 基于孩子的回应自然地说下一句判断
- 如果孩子答"是" → 顺着这件事再做一个相关推断（"那你一定也喜欢..."）
- 如果孩子答"不是" → 自我修正一下，说一个新的判断（"那我猜你其实更喜欢..."）
- 如果孩子答"一半一半" → 表达你的困惑+做一个细化判断（"那你大概是..."）
- 同样：只输出陈述，不输出选项；孩子还是用是/不是/一半一半回应
- 用 {{personality}} 的语气；≤30 字

【输出严格 JSON】
{
  "question": "..."
}`;

function buildSummary(bank: MemoryBankEntry[]): string {
  const summary = bank
    .filter((m) => m.type === 'remembered')
    .slice(0, 10)
    .map((m) => `- ${m.concept_name}：${m.ai_summary ?? ''}`)
    .join('\n');
  return summary || '（你才认识不久）';
}

function withFixedOptions(raw: { question: string }): Day5Question {
  return { question: raw.question, options: [...FIXED_OPTIONS] };
}

export async function runDay5Q1(input: Q1Input, companionId?: string) {
  const systemPrompt = Q1_PROMPT.replaceAll('{{name}}', input.companion.name)
    .replaceAll('{{appearance}}', input.companion.appearance)
    .replaceAll('{{personality}}', input.companion.personality)
    .replaceAll('{{memory_summary}}', buildSummary(input.memoryBank));

  const result = await callLLM<{ question: string }>({
    callType: 'concept_detail',
    systemPrompt,
    userPrompt: '请输出 JSON。',
    expectJson: true,
    parse: (raw) => parseJsonStrict(raw, SingleQuestionSchema),
    companionId,
    promptVersion: 'day5_q1_v2', // 版本升 — PRD §5.6 是/不是/一半一半语义
    maxRetries: 1,
  });

  if (result.success) {
    return {
      ...result,
      data: withFixedOptions(result.data),
    } as typeof result & { data: Day5Question };
  }
  return result;
}

export async function runDay5Q2(input: Q2Input, companionId?: string) {
  const systemPrompt = Q2_PROMPT.replaceAll('{{name}}', input.companion.name)
    .replaceAll('{{appearance}}', input.companion.appearance)
    .replaceAll('{{personality}}', input.companion.personality)
    .replaceAll('{{memory_summary}}', buildSummary(input.memoryBank))
    .replaceAll('{{q1}}', input.q1)
    .replaceAll('{{a1}}', input.a1);

  const result = await callLLM<{ question: string }>({
    callType: 'concept_detail',
    systemPrompt,
    userPrompt: '请输出 JSON。',
    expectJson: true,
    parse: (raw) => parseJsonStrict(raw, SingleQuestionSchema),
    companionId,
    promptVersion: 'day5_q2_v2',
    maxRetries: 1,
  });

  if (result.success) {
    return {
      ...result,
      data: withFixedOptions(result.data),
    } as typeof result & { data: Day5Question };
  }
  return result;
}

/** Day 5 LLM 失败时的通用回退（PRD §25.2） */
export const DAY5_FALLBACK_Q1: Day5Question = {
  question: '我猜你最喜欢的事是和家里人在一起？',
  options: [...FIXED_OPTIONS],
};

export const DAY5_FALLBACK_Q2: Day5Question = {
  question: '那我猜你不太喜欢一个人呆着？',
  options: [...FIXED_OPTIONS],
};
