/**
 * GET /api/task/day5-questions?companion_id=...
 * 返回 Day 5 的 2 道推测性选择题。结果不缓存（每次进入任务可重新生成）。
 */

import { NextResponse } from 'next/server';
import {
  findCompanionForSingleUser,
  getCompanionById,
  getMemoryBank,
} from '@/lib/db/repos';
import { getCompanionPreset } from '@/lib/companionPresets';
import { DAY5_FALLBACK, runDay5Questions } from '@/lib/llm/day5Questions';

export const runtime = 'nodejs';
export const maxDuration = 12;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const cid = url.searchParams.get('companion_id');
  const companion = cid ? await getCompanionById(cid) : await findCompanionForSingleUser();
  if (!companion) {
    return NextResponse.json({ error: 'no companion' }, { status: 404 });
  }

  const preset = getCompanionPreset(companion.preset_id);
  if (!preset) return NextResponse.json({ error: 'preset not found' }, { status: 500 });

  const bank = await getMemoryBank(companion.id);
  const result = await runDay5Questions({ companion: preset, memoryBank: bank }, companion.id);

  if (result.success) {
    return NextResponse.json({ questions: result.data.questions, source: 'llm' });
  }
  return NextResponse.json({ questions: DAY5_FALLBACK.questions, source: 'fallback' });
}
