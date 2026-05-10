/**
 * GET /api/admin/users?key=...
 *
 * 返回所有 user 的简列表 + 简要进度（current_day / 是否毕业 / 出门次数）。
 */

import { NextResponse } from 'next/server';
import { query } from '@/lib/db/client';
import { requireAdmin } from '@/lib/auth/adminGuard';

export const runtime = 'nodejs';

interface UserListRow {
  user_id: string;
  nickname: string | null;
  status: string;
  user_created_at: string;
  user_last_active: string | null;
  companion_id: string | null;
  preset_id: string | null;
  display_name: string | null;
  current_day: number | null;
  graduated_at: string | null;
  trips_count: number;
  plaza_plays_count: number;
}

export async function GET(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const rows = await query<UserListRow>(
    `select
       u.id as user_id,
       u.nickname,
       u.status,
       u.created_at as user_created_at,
       u.last_active_at as user_last_active,
       c.id as companion_id,
       c.preset_id,
       coalesce(c.custom_name, c.preset_id) as display_name,
       c.current_day,
       c.graduated_at,
       (select count(*) from trips t where t.companion_id = c.id) as trips_count,
       (select count(*) from plaza_plays p where p.companion_id = c.id) as plaza_plays_count
     from users u
     left join companions c on c.user_id = u.id
     order by coalesce(u.last_active_at, u.created_at) desc
     limit 200`,
  );

  return NextResponse.json({
    total: rows.length,
    users: rows,
  });
}
