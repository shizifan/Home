/**
 * 管理员看板 /admin?key=...
 * 用户列表 + 进度（PRD §27.3.1）
 */

'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { MobileShell } from '@/components/ui/MobileShell';

interface UserRow {
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

function AdminInner() {
  const params = useSearchParams();
  const key = params.get('key') ?? '';
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/users?key=${encodeURIComponent(key)}`, { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) {
          setError(r.status === 403 ? 'key 不对' : `错误 ${r.status}`);
          return;
        }
        const body = (await r.json()) as { users: UserRow[] };
        setRows(body.users);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [key]);

  return (
    <MobileShell>
      <header className="px-5 pt-3 pb-2 border-b border-[rgba(95,94,90,0.12)]">
        <h1 className="font-title text-h2 text-ink-1">Home 管理员看板</h1>
        <p className="font-title text-mini text-ink-3 mt-0.5">
          仅"看不动"的只读视图。
        </p>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading && <p className="font-title text-body text-ink-3">加载中...</p>}
        {error && (
          <p className="font-title text-body text-[#E24B4A]">{error}</p>
        )}
        {!loading && !error && rows.length === 0 && (
          <p className="font-title text-body text-ink-3">还没有用户。</p>
        )}

        {/* 概览 */}
        {!loading && !error && rows.length > 0 && (
          <>
            <section className="bg-white border border-[rgba(95,94,90,0.18)] rounded-card px-4 py-3 mb-4 grid grid-cols-3 gap-3">
              <Stat n={rows.length} label="总用户数" />
              <Stat
                n={rows.filter((r) => r.user_last_active && isToday(r.user_last_active)).length}
                label="今日活跃"
              />
              <Stat
                n={rows.filter((r) => r.graduated_at).length}
                label="已毕业"
              />
            </section>

            <section className="flex flex-col gap-2">
              {rows.map((r) => (
                <Link
                  key={r.user_id}
                  href={`/admin/users/${r.user_id}?key=${encodeURIComponent(key)}`}
                  className="bg-white border border-[rgba(95,94,90,0.18)] rounded-card px-4 py-3 no-underline"
                >
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="font-title text-h3 text-ink-1">
                      {r.nickname || '（无昵称）'}
                    </span>
                    <span className="font-num text-mini text-ink-3">
                      {formatTime(r.user_last_active ?? r.user_created_at)}
                    </span>
                  </div>
                  <p className="font-title text-small text-ink-2">
                    {r.companion_id ? (
                      <>
                        伙伴：{r.display_name}（Day {r.current_day}/7
                        {r.graduated_at ? ' · 已毕业' : ''}）
                        {' · '}
                        出门 {r.trips_count}{' · '}广场 {r.plaza_plays_count}
                      </>
                    ) : (
                      <span className="text-ink-3">还没有伙伴</span>
                    )}
                  </p>
                </Link>
              ))}
            </section>
          </>
        )}
      </div>
    </MobileShell>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="text-center">
      <p className="font-num text-h1 text-ink-1 leading-none">{n}</p>
      <p className="font-title text-mini text-ink-3 mt-1">{label}</p>
    </div>
  );
}

function formatTime(t: string): string {
  if (!t) return '？';
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return '？';
  return d.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isToday(t: string): boolean {
  const d = new Date(t);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export default function AdminPage() {
  return (
    <Suspense
      fallback={
        <MobileShell>
          <div className="min-h-dvh" />
        </MobileShell>
      }
    >
      <AdminInner />
    </Suspense>
  );
}
