/**
 * GET /api/memory/bank?companion_id=...
 * 按 4 区块返回真实 memory_bank 内容（PRD §14.2）。
 *
 * P3 polish：当 unknown 为空 + remembered ≥ 2 时，触发 LLM 主动生成"不知道的事"。
 */

import { NextResponse } from 'next/server';
import {
  bulkInsertUnknown,
  countByType,
  findCompanionForSingleUser,
  getCompanionById,
  getMemoryBank,
} from '@/lib/db/repos';
import { getCompanionPreset } from '@/lib/companionPresets';
import { runUnknownConcepts } from '@/lib/llm/unknownConcepts';
import type { MemoryBankEntry } from '@/types';

export const runtime = 'nodejs';
export const maxDuration = 12;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const companionIdParam = url.searchParams.get('companion_id');

  let companionId = companionIdParam;
  let companion = null;
  if (!companionId) {
    companion = await findCompanionForSingleUser();
    if (!companion) return NextResponse.json({ error: 'no companion' }, { status: 404 });
    companionId = companion.id;
  } else {
    companion = await getCompanionById(companionId);
    if (!companion) return NextResponse.json({ error: 'companion not found' }, { status: 404 });
  }

  // —— 自动生成 unknown（如果空）——
  const unknownCount = await countByType(companionId, 'unknown');
  const rememberedCount = await countByType(companionId, 'remembered');
  if (unknownCount === 0 && rememberedCount >= 2) {
    const preset = getCompanionPreset(companion.preset_id);
    if (preset) {
      const fullBank = await getMemoryBank(companionId);
      const result = await runUnknownConcepts(
        {
          companion: preset,
          day: companion.current_day,
          memoryBank: fullBank,
        },
        companion.id,
      );
      if (result.success) {
        await bulkInsertUnknown(companionId, result.data.items);
      }
      // 失败就静默 — 用户重进面板时会再尝试
    }
  }

  const bank = await getMemoryBank(companionId);

  // 重要性排序：证据数 × 时间衰减
  const now = Date.now();
  function score(m: MemoryBankEntry): number {
    const ev = Array.isArray(m.evidence) ? m.evidence.length : 0;
    const recency = Math.max(0, 1 - (now - new Date(m.last_updated).getTime()) / (3 * 24 * 3600 * 1000));
    return ev + recency;
  }

  const grouped = {
    remembered: bank.filter((m) => m.type === 'remembered').sort((a, b) => score(b) - score(a)),
    uncertain: bank.filter((m) => m.type === 'uncertain'),
    set_aside: bank.filter((m) => m.type === 'set_aside'),
    unknown: bank.filter((m) => m.type === 'unknown'),
  };

  const flatten = (entries: MemoryBankEntry[]) =>
    entries.map((m) => ({
      id: m.id,
      concept_name: m.concept_name,
      concept_category: m.concept_category,
      ai_summary: m.ai_summary,
      ai_reasoning: m.ai_reasoning,
      evidence: m.evidence,
      confidence: m.confidence,
      source_type: m.source_type,
      source_companion_id: m.source_companion_id,
      user_corrected: m.user_corrected,
      user_correction_history: m.user_correction_history,
      last_updated: m.last_updated,
    }));

  return NextResponse.json({
    remembered: flatten(grouped.remembered),
    uncertain: flatten(grouped.uncertain),
    set_aside: flatten(grouped.set_aside),
    unknown: flatten(grouped.unknown),
  });
}
