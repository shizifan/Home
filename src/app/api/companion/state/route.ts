/**
 * GET /api/companion/state
 * 返回当前伙伴 + 最新对话 + 最近 6 张照片 + 任务状态。
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

  // 房间元素：最多 6 张最近照片（V0.5 兼容）
  const photos = recentMemories
    .filter((m) => m.type === 'photo' && m.photo_url)
    .slice(0, 6)
    .map((m) => ({
      id: m.id,
      url: m.photo_url!,
      day: m.day,
    }));

  // V0.6.1：纸片卡片（仅取已确认的）
  const allCards = await listCardsForCompanion(companion.id, 12);
  const visibleCards = allCards.slice(0, 6);
  // 一次性把这些 card 对应的 memory.user_text + day 拉回来（避免 N 次查询）
  const memoryRows = visibleCards.length
    ? await query<{ id: string; day: number; user_text: string | null }>(
        `select id, day, user_text from memories where id in (${visibleCards
          .map((_, i) => `:m${i}`)
          .join(',')})`,
        Object.fromEntries(visibleCards.map((c, i) => [`m${i}`, c.memory_id])),
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

  // 红点：上次 panel 访问之后 memory_bank 是否有更新
  const lastVisit = companion.last_panel_visit_at
    ? new Date(companion.last_panel_visit_at).getTime()
    : 0;
  const hasUnreadMemory = memoryBank.some(
    (m) => new Date(m.last_updated).getTime() > lastVisit,
  );

  return NextResponse.json({
    companion: {
      id: companion.id,
      preset_id: companion.preset_id,
      custom_name: companion.custom_name,
      display_name: companion.custom_name || preset?.name || '伙伴',
      current_day: companion.current_day,
      starting_personality: companion.starting_personality,
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
