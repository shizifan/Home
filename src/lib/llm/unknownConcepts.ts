/**
 * 「我还不知道的事」LLM 主动生成（PRD §5.7）
 *
 * 输入：当前 memory_bank（已记住的概念）+ 当前是第几天
 * 输出：5–7 个孩子还没提过的常见事物（中文短语数组）
 *
 * 核心思路：让 LLM 实时判断"这个孩子的世界里，常见但缺失的是什么"，
 * 不再用静态 COMMON_CONCEPTS 词典。
 */

import 'server-only';

import { z } from 'zod';
import { callLLM } from './client';
import { parseJsonStrict } from './validators';
import type { CompanionPresetMeta } from '@/lib/companionPresets';
import type { MemoryBankEntry } from '@/types';

const UnknownSchema = z.object({
  items: z.array(z.string().min(1).max(20)).min(3).max(8),
});

interface Input {
  companion: CompanionPresetMeta;
  day: number;
  memoryBank: MemoryBankEntry[];
}

const SYSTEM_PROMPT = `你是 {{name}}，{{appearance}}。已经在小家住了第 {{day}} 天，认识了一个 8–12 岁的孩子。

下面是你目前已经记住的概念：

{{remembered_summary}}

请你判断：**对这个孩子常见、但 ta 还没跟你说过**的事物有哪些？挑 5–7 个最值得问的，按重要性排序。

【判断要点】
- 只列你"理论上应该知道但没线索"的；不要列你已经记住的或近义的
- 优先列：家庭成员（爸爸/兄弟姐妹/爷爷/奶奶）、学校相关（同学/老师/课程）、户外（公园/街道/游乐场）、最常见的爱好（运动/动物/游戏）
- 用孩子能听懂的中文短词（2-4 个字）
- 不要列敏感话题（疾病/死亡/家庭矛盾等）
- 第 1 天可少（3-5 个）；第 4 天起可以多（5-7 个）

【输出格式】严格 JSON：
{
  "items": ["公园", "学校", "爸爸", "其他小朋友", "运动"]
}`;

export async function runUnknownConcepts(input: Input, companionId?: string) {
  const remembered = input.memoryBank
    .filter((m) => m.type === 'remembered')
    .map((m) => `- ${m.concept_name}（${m.ai_summary ?? ''}）`)
    .join('\n');

  const systemPrompt = SYSTEM_PROMPT.replaceAll('{{name}}', input.companion.name)
    .replaceAll('{{appearance}}', input.companion.appearance)
    .replaceAll('{{day}}', String(input.day))
    .replaceAll('{{remembered_summary}}', remembered || '（还没记住任何东西）');

  return callLLM<{ items: string[] }>({
    callType: 'concept_detail', // 复用一组参数（max=400, temp=0.5, t/o=10s）
    systemPrompt,
    userPrompt: '请输出 JSON。',
    expectJson: true,
    parse: (raw) => parseJsonStrict(raw, UnknownSchema),
    companionId,
    promptVersion: 'unknown_v1',
    maxRetries: 1,
  });
}
