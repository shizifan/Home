/**
 * GET /api/conversation/timeline
 * 把 conversations + memories 按时间合并，输出双向气泡 + 跨天分隔的列表。
 */

import { NextResponse } from 'next/server';
import {
  findCompanionForSingleUser,
  getCompanionById,
} from '@/lib/db/repos';
import { query } from '@/lib/db/client';
import { getCompanionPreset } from '@/lib/companionPresets';
import { TASKS } from '@/lib/tasks';
import type { VisionTags } from '@/types';

export const runtime = 'nodejs';

const DAY_THEME: Record<number, string> = Object.fromEntries(
  TASKS.map((t) => [
    t.day,
    {
      1: '搬家日',
      2: '这是我们家',
      3: '我们去过的地方',
      4: '我喜欢的事',
      5: '它问你的问题',
      6: '整理与补充',
      7: '它眼中的世界',
    }[t.day],
  ]),
);

interface ConvRow {
  id: string;
  day: number;
  content: string;
  source: string | null;
  created_at: string;
}

interface MemRow {
  id: string;
  day: number;
  type: 'photo' | 'text' | 'choice' | 'skipped';
  photo_url: string | null;
  user_text: string | null;
  vision_tags: VisionTags | null;
  created_at: string;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const cidParam = url.searchParams.get('companion_id');

  const companion = cidParam
    ? await getCompanionById(cidParam)
    : await findCompanionForSingleUser();
  if (!companion) {
    return NextResponse.json({ error: 'no companion' }, { status: 404 });
  }

  const preset = getCompanionPreset(companion.preset_id);
  const displayName = companion.custom_name || preset?.name || '伙伴';

  // 拉两侧
  const [convRows, memRows] = await Promise.all([
    query<ConvRow>(
      `select id, day, content, source, created_at
         from conversations
         where companion_id = :cid and role = 'companion'
         order by created_at asc`,
      { cid: companion.id },
    ),
    query<MemRow>(
      `select id, day, type, photo_url, user_text, vision_tags, created_at
         from memories
         where companion_id = :cid
         order by created_at asc`,
      { cid: companion.id },
    ),
  ]);

  // 双指针归并
  type Item =
    | {
        kind: 'day_break';
        day: number;
        title: string;
      }
    | {
        kind: 'companion';
        id: string;
        content: string;
        source: string;
        day: number;
        at: string;
      }
    | {
        kind: 'child_photo';
        id: string;
        photo_url: string;
        tags?: string[];
        user_text?: string;
        day: number;
        at: string;
      }
    | {
        kind: 'child_text';
        id: string;
        text: string;
        day: number;
        at: string;
      }
    | {
        kind: 'child_skip';
        id: string;
        day: number;
        at: string;
      };

  const items: Item[] = [];
  let i = 0;
  let j = 0;
  let lastDay = 0;

  function emitDayBreak(day: number) {
    if (day !== lastDay) {
      items.push({
        kind: 'day_break',
        day,
        title: DAY_THEME[day] ?? `Day ${day}`,
      });
      lastDay = day;
    }
  }

  function memToItem(m: MemRow): Item | null {
    if (m.type === 'photo' && m.photo_url) {
      return {
        kind: 'child_photo',
        id: m.id,
        photo_url: m.photo_url,
        tags: m.vision_tags?.objects?.slice(0, 3),
        user_text: m.user_text ?? undefined,
        day: m.day,
        at: m.created_at,
      };
    }
    if (m.type === 'text' && m.user_text) {
      return {
        kind: 'child_text',
        id: m.id,
        text: m.user_text,
        day: m.day,
        at: m.created_at,
      };
    }
    if (m.type === 'skipped') {
      return {
        kind: 'child_skip',
        id: m.id,
        day: m.day,
        at: m.created_at,
      };
    }
    if (m.type === 'choice' && m.user_text) {
      return {
        kind: 'child_text',
        id: m.id,
        text: m.user_text,
        day: m.day,
        at: m.created_at,
      };
    }
    return null;
  }

  while (i < convRows.length || j < memRows.length) {
    const c = convRows[i];
    const m = memRows[j];

    let pickConv: boolean;
    if (!c) pickConv = false;
    else if (!m) pickConv = true;
    else pickConv = new Date(c.created_at).getTime() <= new Date(m.created_at).getTime();

    if (pickConv && c) {
      emitDayBreak(c.day);
      items.push({
        kind: 'companion',
        id: c.id,
        content: c.content,
        source: c.source ?? '',
        day: c.day,
        at: c.created_at,
      });
      i++;
    } else if (m) {
      emitDayBreak(m.day);
      const item = memToItem(m);
      if (item) items.push(item);
      j++;
    }
  }

  return NextResponse.json(
    {
      companion_display_name: displayName,
      preset_id: companion.preset_id,
      items,
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}
