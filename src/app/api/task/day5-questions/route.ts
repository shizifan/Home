/**
 * Day 5 双题 API（PRD §5.6 双选择题，第二题动态）
 *
 * GET /api/task/day5-questions[?companion_id=...]
 *   返回 Q1（不依赖任何上下文）
 *
 * POST /api/task/day5-questions
 *   body: { companion_id?, q1: string, a1: string }
 *   基于孩子在 Q1 的选择生成跟进 Q2
 */

import { NextResponse } from 'next/server';
import { getCompanionById, getMemoryBank } from '@/lib/db/repos';
import { getCompanionPreset } from '@/lib/companionPresets';
import {
  DAY5_FALLBACK_Q1,
  DAY5_FALLBACK_Q2,
  runDay5Q1,
  runDay5Q2,
} from '@/lib/llm/day5Questions';
import { guardWithCompanion, guardErrorResponse } from '@/lib/auth/apiGuard';

export const runtime = 'nodejs';
export const maxDuration = 12;

async function resolveCompanion(idHint: string | null) {
  const guard = await guardWithCompanion(idHint);
  if (!guard.ok) return null;
  return await getCompanionById(guard.companion.id);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const companion = await resolveCompanion(url.searchParams.get('companion_id'));
  if (!companion) {
    return NextResponse.json({ error: 'no companion' }, { status: 404 });
  }
  const preset = getCompanionPreset(companion.preset_id);
  if (!preset) return NextResponse.json({ error: 'preset not found' }, { status: 500 });
  const bank = await getMemoryBank(companion.id);
  const result = await runDay5Q1({ companion: preset, memoryBank: bank }, companion.id);
  return NextResponse.json({
    question: result.success ? result.data : DAY5_FALLBACK_Q1,
    source: result.success ? 'llm' : 'fallback',
  });
}

export async function POST(req: Request) {
  const body = (await req.json()) as { companion_id?: string; q1?: string; a1?: string };
  if (!body.q1 || !body.a1) {
    return NextResponse.json({ error: 'missing q1 or a1' }, { status: 400 });
  }
  const companion = await resolveCompanion(body.companion_id ?? null);
  if (!companion) {
    return NextResponse.json({ error: 'no companion' }, { status: 404 });
  }
  const preset = getCompanionPreset(companion.preset_id);
  if (!preset) return NextResponse.json({ error: 'preset not found' }, { status: 500 });
  const bank = await getMemoryBank(companion.id);
  const result = await runDay5Q2(
    { companion: preset, memoryBank: bank, q1: body.q1, a1: body.a1 },
    companion.id,
  );
  return NextResponse.json({
    question: result.success ? result.data : DAY5_FALLBACK_Q2,
    source: result.success ? 'llm' : 'fallback',
  });
}
