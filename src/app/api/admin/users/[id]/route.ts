/**
 * GET /api/admin/users/[id]?key=...
 *
 * 单用户详情（只读）：companion + memory_bank + 最近对话 + 卡片 + 旅行 + 广场玩法
 */

import { NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db/client';
import { requireAdmin } from '@/lib/auth/adminGuard';

export const runtime = 'nodejs';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const { id } = await params;
  const user = await queryOne<{
    id: string;
    nickname: string | null;
    status: string;
    created_at: string;
    last_active_at: string | null;
  }>(
    `select id, nickname, status, created_at, last_active_at
       from users where id = :id`,
    { id },
  );
  if (!user) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  const companion = await queryOne<{
    id: string;
    preset_id: string;
    custom_name: string | null;
    current_day: number;
    graduated_at: string | null;
    created_at: string;
  }>(
    `select id, preset_id, custom_name, current_day, graduated_at, created_at
       from companions where user_id = :uid order by created_at desc limit 1`,
    { uid: user.id },
  );

  if (!companion) {
    return NextResponse.json({ user, companion: null });
  }

  const [conversations, memoryBank, cards, trips, plazaPlays] = await Promise.all([
    query(
      `select id, day, role, content, source, created_at
         from conversations where companion_id = :cid
         order by created_at desc limit 200`,
      { cid: companion.id },
    ),
    query(
      `select id, type, concept_name, concept_category, ai_summary, ai_reasoning,
              confidence, source_type, source_companion_id, last_updated
         from memory_bank where companion_id = :cid
         order by last_updated desc`,
      { cid: companion.id },
    ),
    query(
      `select c.id, c.image_url, c.is_fallback_text_card, c.child_action,
              c.created_at, m.day, m.user_text
         from cards c left join memories m on m.id = c.memory_id
         where m.companion_id = :cid
         order by c.created_at desc limit 50`,
      { cid: companion.id },
    ),
    query(
      `select id, trip_type, purpose_type, purpose_question, status,
              report_narrative, departed_at, returned_at
         from trips where companion_id = :cid
         order by departed_at desc limit 50`,
      { cid: companion.id },
    ),
    query(
      `select id, scenario_id, scenario_title, ending_type, played_at, finished_at
         from plaza_plays where companion_id = :cid
         order by played_at desc limit 50`,
      { cid: companion.id },
    ),
  ]);

  return NextResponse.json({
    user,
    companion,
    conversations,
    memory_bank: memoryBank,
    cards,
    trips,
    plaza_plays: plazaPlays,
  });
}
