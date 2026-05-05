/**
 * POST /api/station/memory/import
 * 把 trip.report_data.new_word 写入 memory_bank（source_type='secondhand'）。
 *
 * body: { trip_id: string }
 *
 * 200: { memory_bank_id, action: 'created' | 'skipped' }
 * 404: trip not found
 * 400: trip not returned / no_new_word / already_imported
 */

import { NextResponse } from 'next/server';

import { getTripById, upsertMemoryBankEntry } from '@/lib/db/repos';
import type { ConceptCategory } from '@/types';

export const runtime = 'nodejs';

interface NewWordPayload {
  concept_name: string;
  ai_summary: string;
  ai_reasoning: string;
  confidence: number;
  concept_category?: ConceptCategory;
}

interface ReportData {
  new_word?: NewWordPayload | null;
  host_meta?: { preset_id?: string; name?: string };
  imported_memory_bank_id?: string;
}

export async function POST(req: Request) {
  let body: { trip_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  if (!body.trip_id) {
    return NextResponse.json({ error: 'missing_trip_id' }, { status: 400 });
  }

  const trip = await getTripById(body.trip_id);
  if (!trip) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (trip.status !== 'returned') {
    return NextResponse.json({ error: 'trip_not_returned' }, { status: 400 });
  }
  const data = (trip.report_data as ReportData | undefined) ?? {};
  const word = data.new_word;
  if (!word || !word.concept_name) {
    return NextResponse.json({ error: 'no_new_word' }, { status: 400 });
  }
  if (data.imported_memory_bank_id) {
    return NextResponse.json({
      memory_bank_id: data.imported_memory_bank_id,
      action: 'skipped',
      reason: 'already_imported',
    });
  }

  // 写 memory_bank
  const entry = await upsertMemoryBankEntry({
    companionId: trip.companion_id,
    type: 'remembered',
    conceptName: word.concept_name,
    conceptCategory: word.concept_category ?? 'other',
    aiSummary: word.ai_summary,
    aiReasoning: word.ai_reasoning,
    evidence: [],
    confidence: word.confidence,
    sourceType: 'secondhand',
    sourceCompanionId: data.host_meta?.preset_id ?? undefined,
  });

  // 把 imported_memory_bank_id 回写到 trip.report_data，避免重复导入
  const updatedData = { ...data, imported_memory_bank_id: entry.id };
  const { execute } = await import('@/lib/db/client');
  await execute(
    `update trips set report_data = cast(:d as json) where id = :id`,
    { id: trip.id, d: JSON.stringify(updatedData) },
  );

  return NextResponse.json({
    memory_bank_id: entry.id,
    action: 'created',
  });
}
