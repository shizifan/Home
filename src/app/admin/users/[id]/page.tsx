/**
 * /admin/users/[id]?key=... — 单用户详情只读
 */

'use client';

import { Suspense, use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { MobileShell } from '@/components/ui/MobileShell';

interface DetailResponse {
  user: {
    id: string;
    nickname: string | null;
    status: string;
    created_at: string;
    last_active_at: string | null;
  };
  companion: {
    id: string;
    preset_id: string;
    custom_name: string | null;
    current_day: number;
    graduated_at: string | null;
    created_at: string;
  } | null;
  conversations?: Array<{
    id: string;
    day: number;
    role: 'companion' | 'child' | 'system';
    content: string;
    source: string | null;
    created_at: string;
  }>;
  memory_bank?: Array<{
    id: string;
    type: string;
    concept_name: string;
    concept_category: string | null;
    ai_summary: string | null;
    ai_reasoning: string | null;
    confidence: number;
    source_type: string;
    source_companion_id: string | null;
    last_updated: string;
  }>;
  cards?: Array<{
    id: string;
    image_url: string | null;
    is_fallback_text_card: boolean;
    child_action: string | null;
    created_at: string;
    day: number;
    user_text: string | null;
  }>;
  trips?: Array<{
    id: string;
    trip_type: string;
    purpose_type: string | null;
    purpose_question: string | null;
    status: string;
    report_narrative: string | null;
    departed_at: string;
    returned_at: string | null;
  }>;
  plaza_plays?: Array<{
    id: string;
    scenario_id: string;
    scenario_title: string | null;
    ending_type: string | null;
    played_at: string;
    finished_at: string | null;
  }>;
}

function DetailInner({ userId }: { userId: string }) {
  const params = useSearchParams();
  const key = params.get('key') ?? '';
  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(
      `/api/admin/users/${encodeURIComponent(userId)}?key=${encodeURIComponent(key)}`,
      { cache: 'no-store' },
    )
      .then(async (r) => {
        if (!r.ok) {
          setError(r.status === 403 ? 'key 不对' : `错误 ${r.status}`);
          return;
        }
        setData((await r.json()) as DetailResponse);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [userId, key]);

  if (loading)
    return (
      <p className="font-title text-body text-ink-3 p-5">加载中...</p>
    );
  if (error)
    return <p className="font-title text-body text-[#E24B4A] p-5">{error}</p>;
  if (!data) return null;

  const { user, companion } = data;

  return (
    <div className="p-4 flex flex-col gap-4 pb-12">
      <Link
        href={`/admin?key=${encodeURIComponent(key)}`}
        className="font-title text-small text-ink-3 no-underline"
      >
        ← 用户列表
      </Link>

      <section className="bg-white border border-[rgba(95,94,90,0.18)] rounded-card px-4 py-3">
        <h2 className="font-title text-h2 text-ink-1">{user.nickname ?? '（无昵称）'}</h2>
        <p className="font-title text-small text-ink-3 mt-0.5">
          user_id：{user.id}
        </p>
        <p className="font-title text-small text-ink-2 mt-2">
          创建：{user.created_at} · 最近活跃：{user.last_active_at ?? '从未'}
        </p>
      </section>

      {companion && (
        <section className="bg-white border border-[rgba(95,94,90,0.18)] rounded-card px-4 py-3">
          <p className="font-title text-h3 text-ink-1">
            伙伴 · {companion.custom_name || companion.preset_id}
          </p>
          <p className="font-title text-small text-ink-2 mt-1">
            Day {companion.current_day}/7 · {companion.graduated_at ? '已毕业' : '未毕业'}
          </p>
        </section>
      )}

      <Section title={`对话 ${data.conversations?.length ?? 0}`}>
        {(data.conversations ?? []).slice(0, 30).map((c) => (
          <div key={c.id} className="text-sm py-1">
            <span className="font-num text-mini text-ink-3 mr-2">
              D{c.day}·{c.role}
            </span>
            <span className="font-title text-ink-1">{c.content}</span>
          </div>
        ))}
      </Section>

      <Section title={`memory_bank ${data.memory_bank?.length ?? 0}`}>
        {(data.memory_bank ?? []).slice(0, 20).map((m) => (
          <div key={m.id} className="text-sm py-1">
            <span className="font-num text-mini text-ink-3 mr-2">{m.type}</span>
            <span className="font-title text-ink-1">{m.concept_name}</span>
            {m.ai_summary && (
              <span className="font-title text-ink-3 ml-1">: {m.ai_summary}</span>
            )}
            {m.source_type === 'secondhand' && (
              <span className="font-title text-mini text-amber-mid ml-1">
                ·二手
              </span>
            )}
          </div>
        ))}
      </Section>

      <Section title={`卡片 ${data.cards?.length ?? 0}`}>
        {(data.cards ?? []).slice(0, 10).map((c) => (
          <div key={c.id} className="text-sm py-1">
            <span className="font-num text-mini text-ink-3 mr-2">D{c.day}</span>
            <span className="font-title text-ink-1">
              {(c.user_text ?? '').slice(0, 60)}
            </span>
          </div>
        ))}
      </Section>

      <Section title={`旅行 ${data.trips?.length ?? 0}`}>
        {(data.trips ?? []).map((t) => (
          <div key={t.id} className="text-sm py-1">
            <span className="font-num text-mini text-ink-3 mr-2">
              {t.trip_type}·{t.status}
            </span>
            <span className="font-title text-ink-1">
              {t.purpose_type ?? '?'} {t.purpose_question ? `: ${t.purpose_question}` : ''}
            </span>
          </div>
        ))}
      </Section>

      <Section title={`广场 ${data.plaza_plays?.length ?? 0}`}>
        {(data.plaza_plays ?? []).map((p) => (
          <div key={p.id} className="text-sm py-1">
            <span className="font-num text-mini text-ink-3 mr-2">
              {p.ending_type ?? '...'}
            </span>
            <span className="font-title text-ink-1">{p.scenario_title}</span>
          </div>
        ))}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-[rgba(95,94,90,0.18)] rounded-card px-4 py-3">
      <p className="font-title text-h3 text-ink-1 mb-1">{title}</p>
      <div className="max-h-[280px] overflow-y-auto">{children}</div>
    </section>
  );
}

export default function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <MobileShell>
      <Suspense
        fallback={
          <p className="font-title text-body text-ink-3 p-5">加载中...</p>
        }
      >
        <DetailInner userId={id} />
      </Suspense>
    </MobileShell>
  );
}
