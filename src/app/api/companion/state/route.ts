/**
 * GET /api/companion/state
 * 返回当前伙伴 + 最新对话 + 卡片 + 记忆面板摘要 + 驿站解锁状态 (V1.0 扩展)。
 */

import { NextResponse } from 'next/server';

import {
  findCompanionForSingleUser,
  getRecentCompanionLine,
  isTaskDoneToday,
  listRecentMemories,
  getMemoryBank,
} from '@/lib/db/repos';
import { listCardsForCompanion } from '@/lib/db/cardsRepo';
import { query } from '@/lib/db/client';
import { getCompanionPreset } from '@/lib/companionPresets';
import { getTaskByDay } from '@/lib/tasks';
import type { DayNumber } from '@/types';

export const runtime = 'nodejs';

export async function GET() {
  const companion = await findCompanionForSingleUser();
  if (!companion) {
    return NextResponse.json({ companion: null });
  }
  const preset = getCompanionPreset(companion.preset_id);
  const lastLine = await getRecentCompanionLine(companion.id);
  const recentMemories = await listRecentMemories(companion.id, 10);
  const memoryBank = await getMemoryBank(companion.id);

  const photos = recentMemories
    .filter((m) => m.type === 'photo' && m.photo_url)
    .slice(0, 6)
    .map((m) => ({
      id: m.id,
      url: m.photo_url!,
      day: m.day,
    }));

  // 卡片（仅取已确认的）
  const allCards = await listCardsForCompanion(companion.id, 12);
  const visibleCards = allCards.slice(0, 6);
  const memoryRows = visibleCards.length
    ? await query<{ id: string; day: number; user_text: string | null }>(
        `select id, day, user_text from memories where id in (${visibleCards
          .map((_, i) => `$${i + 1}`)
          .join(',')})`,
        visibleCards.map((c) => c.memory_id),
      )
    : [];
  const memoryDescMap = new Map(memoryRows.map((m) => [m.id, m]));
  const cards = visibleCards.map((c) => {
    const m = memoryDescMap.get(c.memory_id);
    return {
      id: c.id,
      memory_id: c.memory_id,
      image_url: c.image_url,
      is_fallback_text_card: c.is_fallback_text_card,
      day: m?.day ?? 0,
      description: m?.user_text ?? '',
    };
  });

  const today = getTaskByDay(companion.current_day);
  const todayDone = today
    ? await isTaskDoneToday(companion.id, companion.current_day as DayNumber, today.id)
    : false;

  const isGraduated = !!companion.graduated_at;

  // V1.0 驿站解锁状态
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const tripsToday = await query<{ id: string }>(
    `select id from trips
       where companion_id = $1
         and trip_type in ('visit','school','plaza')
         and created_at >= $2`,
    [companion.id, todayStart],
  );

  const station = {
    friend_house_unlocked: isGraduated,
    school_unlocked: companion.visit_count >= 2,
    plaza_unlocked: companion.school_count >= 1,
    daily_departures_remaining: Math.max(0, 1 - tripsToday.length),
  };

  const hasUnreadMemory = memoryBank.some(
    (m) => new Date(m.last_updated).getTime() > Date.now() - 5 * 60 * 1000,
  );

  return NextResponse.json({
    companion: {
      id: companion.id,
      preset_id: companion.preset_id,
      custom_name: companion.custom_name,
      display_name: companion.custom_name || preset?.name || '伙伴',
      current_day: companion.current_day,
      starting_personality: companion.starting_personality,
      visit_count: companion.visit_count,
      school_count: companion.school_count,
      plaza_count: companion.plaza_count,
    },
    last_companion_line: lastLine?.content ?? null,
    last_companion_line_source: lastLine?.source ?? null,
    today_task: today
      ? {
          id: today.id,
          kind: today.kind,
          title: today.title,
          description: today.description,
        }
      : null,
    today_done: todayDone,
    can_advance: todayDone && companion.current_day < 7,
    can_view_worldview: todayDone && companion.current_day >= 7,
    photos,
    cards,
    is_graduated: isGraduated,
    station,
    has_unread_memory: hasUnreadMemory,
    memory_bank_summary: {
      remembered: memoryBank.filter((m) => m.type === 'remembered').length,
      uncertain: memoryBank.filter((m) => m.type === 'uncertain').length,
      set_aside: memoryBank.filter((m) => m.type === 'set_aside').length,
    },
    remembered_concepts: memoryBank
      .filter((m) => m.type === 'remembered')
      .map((m) => ({
        concept_name: m.concept_name,
        concept_category: m.concept_category,
        ai_summary: m.ai_summary,
      })),
  });
}
