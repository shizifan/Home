/**
 * 纠正反馈 LLM 调用（PRD §15.5）
 *
 * 5 种 correction_type：
 *   - restore：让你重新记起来一件事
 *   - dismiss：让你放下一件事
 *   - clarify：给你解释了一件你拿不准的事
 *   - rename：给你改了一个概念的名字
 *   - merge：让你把两个概念合到一起
 *
 * 超时 3 秒走预设台词（PRD §15.5.4）。
 */

import 'server-only';

import { callLLM } from './client';
import { parseCorrectionText } from './validators';
import { renderPrompt } from './promptLoader';
import { filterCompanionOutput } from '@/lib/safety/filters';
import correctionExamples from '@prompts/correction/examples.json';
import type { CompanionPresetMeta } from '@/lib/companionPresets';
import type { CorrectionAction } from '@/types';

interface CorrectionInput {
  companion: CompanionPresetMeta;
  correctionType: CorrectionAction;
  correctionDetails: string;
  oldUnderstanding: string;
  newUnderstanding: string;
}

type CorrectionMap = {
  companions: Record<
    string,
    Partial<Record<CorrectionAction, string>>
  >;
};

export async function runCorrection(
  input: CorrectionInput,
  companionId?: string,
): Promise<string> {
  // 取该伙伴的预设台词作为 fallback（PRD §15.5 / §18.5）
  // 优先 companions.json 的 correction_responses（V0.2.0 起每伙伴 5 种动作齐全），
  // 否则回到 prompts/correction/examples.json 的旧映射
  const { getCorrectionResponse } = await import('@/lib/companionPresets');
  const presetMap = (correctionExamples as CorrectionMap).companions ?? {};
  const presetReply =
    getCorrectionResponse(input.companion.preset_id, input.correctionType as never) ||
    presetMap[input.companion.preset_id]?.[input.correctionType] ||
    presetMap[input.companion.preset_id]?.['restore'] ||
    '...好的，我懂了。';

  const personalityExamples = input.companion.personality_examples
    .map((s) => `- ${s}`)
    .join('\n');

  const fewShot = `示例 1：
correction_type = ${input.correctionType}
回应：${presetReply}`;

  const systemPrompt = renderPrompt(
    'correction',
    {
      name: input.companion.name,
      personality: input.companion.personality,
      personality_examples: personalityExamples,
      correction_type: input.correctionType,
      correction_details: input.correctionDetails,
      old_understanding: input.oldUnderstanding,
      new_understanding: input.newUnderstanding,
    },
    fewShot,
  );

  const result = await callLLM<string>({
    callType: 'correction',
    systemPrompt,
    userPrompt: '请用一句话回应，不超过 30 字。',
    expectJson: false,
    parse: (raw) => parseCorrectionText(raw),
    companionId,
    promptVersion: 'v1',
    maxRetries: 0, // 3s 太短，不重试，直接降级
  });

  const text = result.success ? result.data : presetReply;
  // 输出安全过滤
  const outCheck = filterCompanionOutput(text);
  return outCheck.ok ? text : presetReply;
}
