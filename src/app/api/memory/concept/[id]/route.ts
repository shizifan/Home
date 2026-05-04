/**
 * GET /api/memory/concept/[id]
 * 概念详情：V1.0 移除了 cached_detail/cache_dirty 缓存，每次重新生成。
 */

import { NextResponse } from 'next/server';
import { findMemoryBankById, getCompanionById } from '@/lib/db/repos';
import { getCompanionPreset } from '@/lib/companionPresets';
import { runConceptDetail } from '@/lib/llm/conceptDetail';

export const runtime = 'nodejs';
export const maxDuration = 12;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const entry = await findMemoryBankById(id);
  if (!entry) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  // V1.0: 不再使用 cached_detail/cache_dirty，每次调 LLM 生成
  const companion = await getCompanionById(entry.companion_id);
  if (!companion) return NextResponse.json({ error: 'companion not found' }, { status: 500 });
  const preset = getCompanionPreset(companion.preset_id);
  if (!preset) return NextResponse.json({ error: 'preset not found' }, { status: 500 });

  const llm = await runConceptDetail({ companion: preset, entry }, companion.id);

  if (llm.success) {
    return NextResponse.json({
      id: entry.id,
      concept_name: entry.concept_name,
      concept_category: entry.concept_category,
      understanding: llm.data.understanding,
      reasoning: llm.data.reasoning,
      evidence_rephrased: llm.data.evidence_rephrased,
      raw_evidence: entry.evidence ?? [],
      source: 'llm',
    });
  }

  // LLM 失败 → 退回到原始 evidence + summary（PRD §15.7.2）
  return NextResponse.json({
    id: entry.id,
    concept_name: entry.concept_name,
    concept_category: entry.concept_category,
    understanding: entry.ai_summary ?? '（暂时整理不出来）',
    reasoning: '',
    evidence_rephrased: [],
    raw_evidence: entry.evidence ?? [],
    source: 'fallback',
  });
}
