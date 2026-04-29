/**
 * GET /api/memory/concept/[id]
 * 概念详情：含缓存策略（cached_detail + cache_dirty）
 */

import { NextResponse } from 'next/server';
import { execute } from '@/lib/db/client';
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

  // 缓存命中 → 直接返回
  if (!entry.cache_dirty && entry.cached_detail) {
    const cached = entry.cached_detail as {
      understanding: string;
      reasoning: string;
      evidence_rephrased: Array<{ day: number; text: string }>;
    };
    return NextResponse.json({
      id: entry.id,
      concept_name: entry.concept_name,
      concept_category: entry.concept_category,
      understanding: cached.understanding,
      reasoning: cached.reasoning,
      evidence_rephrased: cached.evidence_rephrased,
      raw_evidence: entry.evidence ?? [],
      source: 'cache',
    });
  }

  // 调 LLM 生成
  const companion = await getCompanionById(entry.companion_id);
  if (!companion) return NextResponse.json({ error: 'companion not found' }, { status: 500 });
  const preset = getCompanionPreset(companion.preset_id);
  if (!preset) return NextResponse.json({ error: 'preset not found' }, { status: 500 });

  const llm = await runConceptDetail({ companion: preset, entry }, companion.id);

  if (llm.success) {
    // 写缓存
    await execute(
      `update memory_bank set cached_detail = cast(:c as json), cache_dirty = false where id = :id`,
      { c: JSON.stringify(llm.data), id: entry.id },
    );
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
