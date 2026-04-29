/**
 * 概念详情生成（PRD §15.4）
 * 输出 understanding / reasoning / evidence_rephrased
 * 缓存策略：memory_bank.cached_detail + cache_dirty
 */

import 'server-only';

import { callLLM } from './client';
import { ConceptDetailSchema, parseJsonStrict, type ConceptDetailOutput } from './validators';
import { renderPrompt, loadFewShotJSON } from './promptLoader';
import type { CompanionPresetMeta } from '@/lib/companionPresets';
import type { MemoryBankEntry } from '@/types';

interface ConceptDetailInput {
  companion: CompanionPresetMeta;
  entry: MemoryBankEntry;
}

export async function runConceptDetail(
  input: ConceptDetailInput,
  companionId?: string,
) {
  // 把 evidence 列表渲染成 prompt 文本
  const evidenceLines = (Array.isArray(input.entry.evidence) ? input.entry.evidence : [])
    .map((e) => `- Day ${e.day}: ${e.excerpt}`)
    .join('\n');

  const fewShot = loadFewShotJSON('concept_detail/examples.json');

  const personalityExamples = input.companion.personality_examples
    .map((s) => `- ${s}`)
    .join('\n');

  const systemPrompt = renderPrompt(
    'concept_detail',
    {
      name: input.companion.name,
      appearance: input.companion.appearance,
      personality: input.companion.personality,
      personality_examples: personalityExamples,
      concept_name: input.entry.concept_name,
      evidence_list: evidenceLines || '（暂无证据）',
    },
    fewShot,
  );

  return callLLM<ConceptDetailOutput>({
    callType: 'concept_detail',
    systemPrompt,
    userPrompt: '请输出 JSON。',
    expectJson: true,
    parse: (raw) => parseJsonStrict(raw, ConceptDetailSchema),
    companionId,
    promptVersion: 'v1',
    maxRetries: 1,
  });
}
