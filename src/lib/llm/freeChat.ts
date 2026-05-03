/**
 * Free Chat — ChatOverlay 开放问答
 *
 * 输入：孩子问句 + 全量 memory_bank + 最近 10 条对话
 * 输出：≤ 30 字回应文本
 *
 * 设计决策（spec/Free_Chat_Implementation.md V0.2）：
 *   - 失败一律 throw，不写静态兜底
 *   - 不重试（maxRetries=0）；超时 / 解析失败让上层 5xx 给前端
 */

import 'server-only';

import { callLLM } from './client';
import { parsePass2Text } from './validators';
import { renderPrompt } from './promptLoader';
import type { CompanionPresetMeta } from '@/lib/companionPresets';
import type { ConversationLine, MemoryBankEntry } from '@/types';

interface FreeChatInput {
  companion: CompanionPresetMeta;
  day: number;
  memoryBank: MemoryBankEntry[];
  /** 时间正序：最旧 → 最新 */
  recentConversations: ConversationLine[];
  question: string;
}

const MAX_REPLY_LEN = 30;

function summarizeBank(bank: MemoryBankEntry[]): string {
  if (bank.length === 0) return '（你才刚搬来，还没记住什么。）';
  const groups: Record<string, MemoryBankEntry[]> = {};
  for (const m of bank) (groups[m.type] ??= []).push(m);

  const labelMap: Record<string, string> = {
    remembered: '【已经记住】',
    uncertain: '【拿不准】',
    set_aside: '【先放一放】',
    unknown: '【还不知道但听过】',
  };
  const order = ['remembered', 'uncertain', 'set_aside', 'unknown'];
  const parts: string[] = [];
  for (const key of order) {
    const items = groups[key];
    if (!items?.length) continue;
    parts.push(labelMap[key] ?? `【${key}】`);
    for (const m of items) {
      const summary = m.ai_summary ? `: ${m.ai_summary}` : '';
      parts.push(`- ${m.concept_name}${summary}`);
    }
  }
  return parts.join('\n');
}

function formatRecent(rows: ConversationLine[], companionName: string): string {
  if (rows.length === 0) return '（暂无对话历史）';
  return rows
    .map((r) => {
      const speaker =
        r.role === 'child'
          ? '孩子'
          : r.role === 'companion'
            ? companionName
            : '系统';
      return `${speaker}：${r.content}`;
    })
    .join('\n');
}

/**
 * 跑 Free Chat。失败 / 解析不出文本一律 throw，由 API 层转 500。
 */
export async function runFreeChat(
  input: FreeChatInput,
  companionId?: string,
): Promise<string> {
  const personalityExamples = input.companion.personality_examples
    .slice(0, 3)
    .map((s) => `- ${s}`)
    .join('\n');

  const systemPrompt = renderPrompt('free_chat', {
    name: input.companion.name,
    appearance: input.companion.appearance,
    personality: input.companion.personality,
    personality_examples: personalityExamples,
    day: input.day,
    memory_bank_summary: summarizeBank(input.memoryBank),
    recent_conversations: formatRecent(
      input.recentConversations,
      input.companion.name,
    ),
    question: input.question,
  });

  const result = await callLLM<string>({
    callType: 'free_chat',
    systemPrompt,
    userPrompt: '请用一句话回答，≤30 字。',
    expectJson: false,
    parse: (raw) => parsePass2Text(raw, MAX_REPLY_LEN),
    companionId,
    promptVersion: 'v1',
    maxRetries: 0,
  });

  if (!result.success) {
    const reason = result.reason;
    const detail = result.error ?? result.raw ?? '';
    throw new Error(`free_chat llm failed: ${reason}${detail ? ` — ${detail}` : ''}`);
  }
  return result.data;
}
