/**
 * POST /api/companion/create
 * Body: { preset_id, starting_personality, custom_name? }
 * 单用户：每次都覆盖（或拒绝）已有伙伴。MVP 简化：允许多个，前端取最新。
 */

import { NextResponse } from 'next/server';
import {
  createCompanion,
  setCompanionName,
  insertCompanionLine,
} from '@/lib/db/repos';
import { COMPANION_PRESET_IDS } from '@/components/characters/types';
import { getCompanionPreset } from '@/lib/companionPresets';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const presetId: string = body.preset_id;
    if (!COMPANION_PRESET_IDS.includes(presetId as typeof COMPANION_PRESET_IDS[number])) {
      return NextResponse.json({ error: 'unknown preset_id' }, { status: 400 });
    }
    const preset = getCompanionPreset(presetId as typeof COMPANION_PRESET_IDS[number]);
    if (!preset) return NextResponse.json({ error: 'unknown preset' }, { status: 400 });

    const companion = await createCompanion({
      presetId: preset.preset_id,
      startingPersonality: preset.personality, // 用 personality 作 starting_personality 文字
    });

    const customName = (body.custom_name ?? '').toString().trim();
    if (customName) {
      await setCompanionName(companion.id, customName.slice(0, 20));
    }

    // 写入 Day 1 开场白（preset 固定文案）
    await insertCompanionLine({
      companionId: companion.id,
      day: 1,
      content: preset.personality_examples[0] ?? '你好。',
      source: 'preset_open_day1',
    });

    return NextResponse.json({
      companion: {
        id: companion.id,
        preset_id: companion.preset_id,
        custom_name: customName || null,
        current_day: companion.current_day,
      },
    });
  } catch (err) {
    console.error('[/api/companion/create]', err);
    return NextResponse.json(
      { error: (err as Error)?.message ?? 'internal' },
      { status: 500 },
    );
  }
}
