/**
 * 家长中心（PRD §10.6 / §17.5）
 * P6-1：从 mock 切到真数据，5 个 Tab：
 *   - 概览：进度 + 4 数字统计 + 最近活动
 *   - 时间线：孩子全部输入 + 伙伴全部回应（合并）
 *   - 记忆面板：当前 4 区块只读视图
 *   - 纠正历史：所有 user_correction_history
 *   - Day 7 档案：仅 Day 7 后可见
 *   - 设置：清空 / 重看引导 / 隐私
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { MobileShell } from '@/components/ui/MobileShell';
import { Button } from '@/components/ui/Button';
import { useCompanionStore } from '@/stores/companionStore';
import { clearAllLocal } from '@/lib/storage/local';
import {
  getCompanionState,
  getMemoryBank,
  getTimeline,
  getWorldview,
  type CompanionStateResponse,
  type MemoryBankResponse,
  type TimelineResponse,
  type WorldviewData,
} from '@/lib/api/client';
import {
  ConceptCard,
  SectionHeader,
  SetAsideCard,
  UncertainCard,
  UnknownCard,
} from '@/components/memory/cards';
import { ChatList } from '@/components/chat/ChatList';
import type { ConceptCategory } from '@/types';

type Tab = 'overview' | 'timeline' | 'memory' | 'corrections' | 'day7' | 'settings';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'overview', label: '概览' },
  { id: 'timeline', label: '历史' },
  { id: 'memory', label: '记忆' },
  { id: 'corrections', label: '纠正' },
  { id: 'day7', label: '档案' },
  { id: 'settings', label: '设置' },
];

export default function ParentPage() {
  const { reset } = useCompanionStore();
  const [tab, setTab] = useState<Tab>('overview');
  const [state, setState] = useState<CompanionStateResponse | null>(null);
  const [bank, setBank] = useState<MemoryBankResponse | null>(null);
  const [timeline, setTimeline] = useState<TimelineResponse | null>(null);
  const [worldview, setWorldview] = useState<WorldviewData | null>(null);

  useEffect(() => {
    Promise.all([
      getCompanionState().catch(() => null),
      getMemoryBank().catch(() => null),
      getTimeline().catch(() => null),
      getWorldview().catch(() => null),
    ]).then(([s, b, t, w]) => {
      setState(s);
      setBank(b);
      setTimeline(t);
      setWorldview(w);
    });
  }, []);

  const onReset = async () => {
    if (!confirm('清空全部数据并重新开始吗？\n\n会清空 MySQL 中这个伙伴的所有记录 + 浏览器 LocalStorage。')) return;
    try {
      await fetch('/api/dev/reset', { method: 'POST' });
    } catch {
      /* ignore */
    }
    reset();
    clearAllLocal();
    window.location.href = '/';
  };

  return (
    <MobileShell>
      <header className="px-5 pt-3 pb-2 flex items-center justify-between border-b border-[rgba(95,94,90,0.12)]">
        <h1 className="font-title text-h2 text-ink-1">家长中心</h1>
        <Link href="/home" className="font-title text-small text-ink-3">
          ← 回小家
        </Link>
      </header>

      {/* Tab 切换 */}
      <nav className="px-3 pt-2 pb-1 overflow-x-auto whitespace-nowrap" aria-label="标签页">
        <div className="inline-flex gap-1.5">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={clsx(
                'font-title text-small px-3 py-1.5 rounded-full border transition cursor-pointer',
                tab === t.id
                  ? 'bg-ink-1 text-bg-base border-ink-1'
                  : 'bg-white text-ink-2 border-[rgba(95,94,90,0.18)]',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      <div className="flex-1 overflow-y-auto" style={{ height: 'calc(100dvh - 44px - 50px - 50px)' }}>
        {tab === 'overview' && <OverviewTab state={state} bank={bank} timeline={timeline} />}
        {tab === 'timeline' && <TimelineTab data={timeline} />}
        {tab === 'memory' && <MemoryReadonlyTab bank={bank} />}
        {tab === 'corrections' && <CorrectionsTab bank={bank} />}
        {tab === 'day7' && <Day7Tab worldview={worldview} />}
        {tab === 'settings' && <SettingsTab onReset={onReset} />}
      </div>
    </MobileShell>
  );
}

// ──────────────────── 概览 ────────────────────
function OverviewTab({
  state,
  bank,
  timeline,
}: {
  state: CompanionStateResponse | null;
  bank: MemoryBankResponse | null;
  timeline: TimelineResponse | null;
}) {
  if (!state?.companion) {
    return (
      <div className="p-6 text-center">
        <p className="font-title text-body text-ink-2">还没有伙伴入住。</p>
      </div>
    );
  }
  const c = state.companion;
  const photoCount = (timeline?.items ?? []).filter((i) => i.kind === 'child_photo').length;
  const childTextCount = (timeline?.items ?? []).filter((i) => i.kind === 'child_text').length;
  const skipCount = (timeline?.items ?? []).filter((i) => i.kind === 'child_skip').length;
  const companionLineCount = (timeline?.items ?? []).filter((i) => i.kind === 'companion').length;
  const correctionsCount =
    (bank?.remembered ?? []).reduce(
      (s, e) => s + (e.user_correction_history?.length ?? 0),
      0,
    ) +
    (bank?.uncertain ?? []).reduce(
      (s, e) => s + (e.user_correction_history?.length ?? 0),
      0,
    ) +
    (bank?.set_aside ?? []).reduce(
      (s, e) => s + (e.user_correction_history?.length ?? 0),
      0,
    );

  return (
    <div className="p-5 flex flex-col gap-4">
      <section className="bg-white border border-[rgba(95,94,90,0.18)] rounded-card px-5 py-4">
        <div className="flex items-baseline justify-between mb-2">
          <h2 className="font-title text-h2 text-ink-1">{c.display_name}</h2>
          <span className="font-num text-small text-amber-mid tracking-[0.16em]">
            DAY {c.current_day} / 7
          </span>
        </div>
        <p className="font-title text-small text-ink-3">
          {c.current_day < 7 ? `还有 ${7 - c.current_day} 天的故事要发生` : '7 天已经完成'}
        </p>
      </section>

      <div className="grid grid-cols-4 gap-2">
        <StatBox n={photoCount} label="张照片" />
        <StatBox n={childTextCount} label="句话" />
        <StatBox n={correctionsCount} label="次纠正" highlight={correctionsCount > 0} />
        <StatBox n={c.current_day} label="天陪伴" />
      </div>

      <section className="bg-white/60 border border-[rgba(95,94,90,0.12)] rounded-card px-4 py-3">
        <h3 className="font-title text-h3 text-ink-1 mb-2">记忆分布</h3>
        <div className="flex flex-col gap-1.5">
          <DistRow color="#F0997B" label="记住的" n={bank?.remembered.length ?? 0} />
          <DistRow color="#AFA9EC" label="拿不准" n={bank?.uncertain.length ?? 0} />
          <DistRow color="#85B7EB" label="放下的" n={bank?.set_aside.length ?? 0} />
          <DistRow color="#888780" label="还不知道的" n={bank?.unknown.length ?? 0} />
        </div>
      </section>

      <section className="bg-white/60 border border-[rgba(95,94,90,0.12)] rounded-card px-4 py-3">
        <h3 className="font-title text-h3 text-ink-1 mb-2">活动</h3>
        <p className="font-title text-small text-ink-2 leading-[1.7]">
          孩子说过的 {childTextCount} 句话 + 跳过 {skipCount} 次<br />
          {c.display_name} 回应了 {companionLineCount} 句
        </p>
      </section>
    </div>
  );
}

function StatBox({ n, label, highlight }: { n: number; label: string; highlight?: boolean }) {
  return (
    <div
      className={clsx(
        'rounded-card px-2 py-3 text-center border',
        highlight
          ? 'bg-amber-light/40 border-amber-light'
          : 'bg-white border-[rgba(95,94,90,0.12)]',
      )}
    >
      <div
        className={clsx(
          'font-num text-h1 font-semibold leading-none',
          highlight ? 'text-amber-deep' : 'text-ink-1',
        )}
      >
        {n}
      </div>
      <div className="font-title text-mini text-ink-3 mt-1">{label}</div>
    </div>
  );
}

function DistRow({ color, label, n }: { color: string; label: string; n: number }) {
  const max = 20;
  const ratio = Math.min(1, n / max);
  return (
    <div className="flex items-center gap-2">
      <span className="font-title text-small text-ink-2 w-20">{label}</span>
      <div className="flex-1 h-2 bg-[rgba(95,94,90,0.08)] rounded-full overflow-hidden">
        <div
          className="h-full transition-all"
          style={{ width: `${ratio * 100}%`, background: color }}
        />
      </div>
      <span className="font-num text-small text-ink-2 w-6 text-right">{n}</span>
    </div>
  );
}

// ──────────────────── 时间线 ────────────────────
function TimelineTab({ data }: { data: TimelineResponse | null }) {
  if (!data) return <Empty text="还没有对话历史" />;
  if (data.items.length === 0) return <Empty text="还没有对话历史" />;
  return (
    <div className="h-full flex flex-col">
      <ChatList items={data.items} companionName={data.companion_display_name} />
    </div>
  );
}

// ──────────────────── 记忆只读 ────────────────────
function MemoryReadonlyTab({ bank }: { bank: MemoryBankResponse | null }) {
  if (!bank) return <Empty text="还没有记忆" />;
  const total = bank.remembered.length + bank.uncertain.length + bank.set_aside.length + bank.unknown.length;
  if (total === 0) return <Empty text="它还没有形成记忆" />;
  return (
    <div className="px-4 pb-8">
      {bank.remembered.length > 0 && (
        <>
          <SectionHeader color="#F0997B" icon="heart" title="记住的东西" count={bank.remembered.length} />
          {bank.remembered.map((c) => (
            <ConceptCard
              key={c.id}
              color="#F0997B"
              iconBg="#F0997B"
              iconText={categoryLabel(c.concept_category)}
              name={c.concept_name}
              summary={c.ai_summary || ''}
              evidence={(c.evidence ?? []).map((e) => `Day ${e.day}: ${e.quote}`)}
            />
          ))}
        </>
      )}
      {bank.uncertain.length > 0 && (
        <>
          <SectionHeader color="#AFA9EC" icon="q" title="拿不准的事" count={bank.uncertain.length} />
          {bank.uncertain.map((u) => (
            <UncertainCard key={u.id} title={`关于「${u.concept_name}」`} body={u.ai_reasoning || u.ai_summary || ''} />
          ))}
        </>
      )}
      {bank.set_aside.length > 0 && (
        <>
          <SectionHeader color="#85B7EB" icon="moon" title="放下的事" count={bank.set_aside.length} />
          {bank.set_aside.map((s) => (
            <SetAsideCard
              key={s.id}
              title={s.concept_name}
              quote={s.ai_summary || ''}
              reason={s.ai_reasoning || ''}
              confirmed
            />
          ))}
        </>
      )}
      {bank.unknown.length > 0 && (
        <>
          <SectionHeader color="#888780" icon="fog" title="还不知道的事" />
          <UnknownCard items={bank.unknown.map((u) => ({ id: u.id, name: u.concept_name }))} />
        </>
      )}
    </div>
  );
}

// ──────────────────── 纠正历史 ────────────────────
function CorrectionsTab({ bank }: { bank: MemoryBankResponse | null }) {
  if (!bank) return <Empty text="还没有纠正记录" />;
  // 把所有有 correction_history 的概念展开
  const all = [
    ...bank.remembered,
    ...bank.uncertain,
    ...bank.set_aside,
    ...bank.unknown,
  ].flatMap((c) =>
    (c.user_correction_history ?? []).map((h) => ({
      id: `${c.id}-${h.at}`,
      conceptName: c.concept_name,
      action: h.action,
      at: h.at,
      payload: h.payload,
    })),
  );
  all.sort((a, b) => (a.at < b.at ? 1 : -1));

  if (all.length === 0) return <Empty text="孩子还没做过纠正" />;

  return (
    <div className="p-5 flex flex-col gap-2">
      {all.map((row) => (
        <div
          key={row.id}
          className="bg-white border border-[rgba(95,94,90,0.12)] rounded-card px-4 py-3"
        >
          <div className="flex items-baseline justify-between mb-1">
            <span className="font-title text-h3 text-ink-1">{row.conceptName}</span>
            <span className="font-num text-mini text-ink-3">{formatTime(row.at)}</span>
          </div>
          <p className="font-title text-small text-ink-2">
            <ActionBadge action={row.action} />
            {row.payload && Object.keys(row.payload).length > 0 && (
              <span className="font-num text-mini text-ink-3 ml-2">
                {summarizePayload(row.payload)}
              </span>
            )}
          </p>
        </div>
      ))}
    </div>
  );
}

function ActionBadge({ action }: { action: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    restore: { label: '捡回来', cls: 'bg-amber-light text-amber-deep' },
    dismiss: { label: '让它放下', cls: 'bg-[#B5D4F4] text-[#2C2C2A]' },
    clarify: { label: '澄清', cls: 'bg-m-uncertain text-ink-1' },
    rename: { label: '改名', cls: 'bg-m-remember/40 text-amber-deep' },
    merge: { label: '合并', cls: 'bg-m-remember/40 text-amber-deep' },
    inform: { label: '主动告诉', cls: 'bg-m-remember/60 text-amber-deep' },
    withhold: { label: '先不说', cls: 'bg-m-unknown text-ink-2' },
  };
  const m = map[action] ?? { label: action, cls: 'bg-white text-ink-2' };
  return (
    <span className={`inline-block font-num text-mini rounded-full px-2 py-0.5 mr-1 ${m.cls}`}>
      {m.label}
    </span>
  );
}

function summarizePayload(payload: Record<string, unknown>): string {
  if ('newName' in payload && typeof payload.newName === 'string')
    return `→ ${payload.newName}`;
  if ('text' in payload && typeof payload.text === 'string')
    return `"${payload.text.slice(0, 30)}…"`;
  if ('clarification' in payload && typeof payload.clarification === 'string')
    return `"${payload.clarification.slice(0, 30)}…"`;
  if ('fromName' in payload) return `← ${payload.fromName}`;
  return '';
}

// ──────────────────── Day 7 档案 ────────────────────
function Day7Tab({ worldview }: { worldview: WorldviewData | null }) {
  if (!worldview) return <Empty text="还没到 Day 7（或档案未生成）" />;
  const items = [
    ['最重要的人', worldview.most_important_person],
    ['最好玩的事', worldview.most_fun_thing],
    ['最好吃的', worldview.most_delicious_thing],
    ['最害怕的', worldview.most_scary_thing],
    ['不知道的', worldview.unknown_thing],
  ] as const;
  return (
    <div className="p-5">
      <div className="bg-white border-[1.2px] border-ink-2 rounded-card px-5 py-5">
        <div className="flex items-baseline gap-2 mb-3">
          <span className="font-title text-h2 text-ink-1">它眼中的世界</span>
          <span className="flex-1 h-px bg-[rgba(95,94,90,0.25)]" />
          <span className="font-num text-mini text-ink-3 tracking-[0.16em]">DAY 7</span>
        </div>
        {items.map(([label, value]) => (
          <div key={label} className="grid items-baseline gap-3 py-2.5" style={{ gridTemplateColumns: '90px 1fr' }}>
            <div className="font-title text-small text-ink-3">{label}</div>
            <div className="font-title text-body text-ink-1">{value ?? '—'}</div>
          </div>
        ))}
        {worldview.almost_forgot_thing && (
          <div
            className="grid items-baseline gap-3 py-3 px-3 rounded-card mt-1"
            style={{
              gridTemplateColumns: '90px 1fr',
              background: 'rgba(239,159,39,0.18)',
              boxShadow: 'inset 0 0 0 1.5px #EF9F27',
            }}
          >
            <div className="font-title text-small text-amber-mid font-medium">⭐ 差点忘了的</div>
            <div className="font-title text-body text-amber-deep font-medium">
              {worldview.almost_forgot_thing}
            </div>
          </div>
        )}
        {worldview.stats && (
          <div className="mt-4 pt-3 border-t border-[rgba(95,94,90,0.18)] flex justify-around">
            <NumStat n={worldview.stats.photos} label="张照片" />
            <NumStat n={worldview.stats.conversations} label="句对话" />
            <NumStat n={worldview.stats.corrections} label="次纠正" />
            <NumStat n={7} label="天陪伴" />
          </div>
        )}
      </div>
      <div className="mt-4">
        <Link href="/day7/graduation">
          <Button fullWidth>看毕业卡 →</Button>
        </Link>
      </div>
    </div>
  );
}

function NumStat({ n, label }: { n: number; label: string }) {
  return (
    <div className="text-center">
      <div className="font-num text-h1 font-semibold text-ink-1 leading-none">{n}</div>
      <div className="font-title text-mini text-ink-3 mt-1">{label}</div>
    </div>
  );
}

// ──────────────────── 设置 ────────────────────
function SettingsTab({ onReset }: { onReset: () => void }) {
  return (
    <div className="p-5 flex flex-col gap-4" id="settings">
      <section className="bg-white/60 border border-[rgba(95,94,90,0.12)] rounded-card px-4 py-3">
        <h3 className="font-title text-h3 text-ink-1 mb-2">隐私说明</h3>
        <p className="font-title text-small text-ink-2 leading-relaxed">
          孩子的所有照片、文字都存在你的设备 / 你配置的 MySQL 服务器中。
          <br />
          AI 调用走 DeepSeek + Qwen-VL，每次只发送当次必要的内容。
          <br />
          正式上线前会补齐：完整的隐私政策 / 数据保留期 / 一键导出。
        </p>
      </section>

      <section className="bg-white/60 border border-[rgba(95,94,90,0.12)] rounded-card px-4 py-3">
        <h3 className="font-title text-h3 text-ink-1 mb-2">家长操作</h3>
        <p className="font-title text-small text-ink-3 mb-3">
          清空会一并删除：伙伴、所有输入、记忆面板、Day 7 档案、上传的图片。
        </p>
        <Button variant="danger" fullWidth onClick={onReset}>
          清空并重新开始
        </Button>
      </section>

      <Link
        href="/parent/monitor"
        className="bg-white/60 border border-[rgba(95,94,90,0.12)] rounded-card px-4 py-3 no-underline"
      >
        <h3 className="font-title text-h3 text-ink-1 mb-1">LLM 绩效面板 →</h3>
        <p className="font-title text-small text-ink-3">查看后台 AI 调用的成功率、时延、用量分布。</p>
      </Link>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="p-12 text-center">
      <p className="font-title text-body text-ink-3">{text}</p>
    </div>
  );
}

function categoryLabel(cat?: ConceptCategory | string): string {
  switch (cat) {
    case 'person':
      return '人';
    case 'place':
      return '地';
    case 'food':
      return '食';
    case 'activity':
      return '事';
    case 'object':
      return '物';
    case 'emotion':
      return '心';
    default:
      return '·';
  }
}

function formatTime(at: string): string {
  const d = new Date(at);
  const Y = d.getFullYear();
  const M = String(d.getMonth() + 1).padStart(2, '0');
  const D = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${Y}-${M}-${D} ${h}:${m}`;
}
