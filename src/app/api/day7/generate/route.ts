/**
 * POST /api/day7/generate
 * 触发 Day 7 档案生成。命中缓存（worldview_cards 已存在）→ 直接返回。
 *
 * 失败处理（PRD §15.6.4）：3 次重试都失败 → 返回 503，不允许预设替代。
 */

import { NextResponse } from 'next/server';
import {
  findCompanionForSingleUser,
  findWorldview,
  getCompanionById,
  getCompanionStats,
  getMemoryBank,
  setGraduatedAtIfNull,
  upsertWorldview,
} from '@/lib/db/repos';
import { getCompanionPreset } from '@/lib/companionPresets';
import { hasRestoredItems, runDay7 } from '@/lib/llm/day7';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: Request) {
  let companionId: string | null = null;
  try {
    const body = await req.json().catch(() => ({}));
    companionId = body?.companion_id ?? null;
  } catch {
    /* ignore */
  }

  const companion = companionId
    ? await getCompanionById(companionId)
    : await findCompanionForSingleUser();
  if (!companion) {
    return NextResponse.json({ error: 'no companion' }, { status: 404 });
  }

  // 命中缓存
  const cached = await findWorldview(companion.id);
  if (cached) {
    return NextResponse.json({
      worldview: serialize(cached),
      from_cache: true,
    });
  }

  if (companion.current_day < 7) {
    return NextResponse.json(
      { error: 'not yet day 7', current_day: companion.current_day },
      { status: 400 },
    );
  }

  const preset = getCompanionPreset(companion.preset_id);
  if (!preset) return NextResponse.json({ error: 'preset not found' }, { status: 500 });

  const bank = await getMemoryBank(companion.id);
  const result = await runDay7({ companion: preset, memoryBank: bank }, companion.id);

  if (!result.success) {
    return NextResponse.json(
      {
        error: 'day7_generation_failed',
        reason: result.reason,
        message: '我有点累了，让我休息一下再想这件事。等会儿再来找我吧。',
      },
      { status: 503 },
    );
  }

  // 应用第 6 项触发逻辑：如果没有 user_restored 行为，强制 almost_forgot_thing = null
  const data = { ...result.data };
  if (!hasRestoredItems(bank)) {
    data.almost_forgot_thing = null;
  }

  const stats = await getCompanionStats(companion.id);
  const row = await upsertWorldview({
    companionId: companion.id,
    data,
    stats: {
      photos: stats.photos,
      conversations: stats.conversations,
      corrections: stats.corrections,
    },
    rawLLMOutput: result.data,
  });

  // 首次生成 worldview = 毕业时刻（PRD §11.3 朋友家解锁条件）
  await setGraduatedAtIfNull(companion.id);

  return NextResponse.json({
    worldview: serialize(row),
    from_cache: false,
  });
}

export async function GET() {
  // GET 等价于"读缓存"，没缓存返回 404
  const companion = await findCompanionForSingleUser();
  if (!companion) return NextResponse.json({ error: 'no companion' }, { status: 404 });
  const cached = await findWorldview(companion.id);
  if (!cached) return NextResponse.json({ error: 'not generated yet' }, { status: 404 });
  return NextResponse.json({ worldview: serialize(cached), from_cache: true });
}

function serialize(row: {
  most_important_person: string | null;
  most_fun_thing: string | null;
  most_delicious_thing: string | null;
  most_scary_thing: string | null;
  unknown_thing: string | null;
  almost_forgot_thing: string | null;
  stats: { photos: number; conversations: number; corrections: number } | null;
  generated_at: string;
}) {
  return {
    most_important_person: row.most_important_person,
    most_fun_thing: row.most_fun_thing,
    most_delicious_thing: row.most_delicious_thing,
    most_scary_thing: row.most_scary_thing,
    unknown_thing: row.unknown_thing,
    almost_forgot_thing: row.almost_forgot_thing,
    stats: row.stats,
    generated_at: row.generated_at,
  };
}
