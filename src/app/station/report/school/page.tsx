/**
 * 课堂回放页（PRD §13.5 / §13.6）
 *
 * 答案逐条出现（每条 600ms）→ highlight → teaching_moment（小蓝字）。
 * "小青龙不会答"分支：visitor_doesnt_know=true 时底部"现在告诉它"按钮跳记忆面板。
 */

'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import clsx from 'clsx';
import { MobileShell } from '@/components/ui/MobileShell';
import { Button } from '@/components/ui/Button';
import { getTrip } from '@/lib/api/client';

interface Answer {
  companion_name: string;
  answer: string;
}

interface Classmate {
  preset_id: string;
  name: string;
  appearance: string;
}

interface ReportData {
  question?: string;
  question_source?: 'system' | 'child';
  answers?: Answer[];
  highlight?: string;
  teaching_moment?: string | null;
  classmates?: Classmate[];
  visitor_doesnt_know?: boolean;
  visitor_name?: string;
  source?: 'llm' | 'fallback';
  purpose?: { type?: string };
}

interface TripView {
  id: string;
  trip_type: string;
  status: 'traveling' | 'returned';
  report_narrative?: string;
  report_data?: ReportData;
}

const REVEAL_INTERVAL = 600;

function SchoolReportInner() {
  const router = useRouter();
  const params = useSearchParams();
  const tripId = params.get('trip_id');
  const [trip, setTrip] = useState<TripView | null>(null);
  const [loading, setLoading] = useState(true);
  const [revealedCount, setRevealedCount] = useState(0);
  const [showHighlight, setShowHighlight] = useState(false);
  const [showTeaching, setShowTeaching] = useState(false);

  useEffect(() => {
    if (!tripId) {
      setLoading(false);
      return;
    }
    getTrip(tripId)
      .then((r) => setTrip(r.trip as unknown as TripView))
      .catch(() => setTrip(null))
      .finally(() => setLoading(false));
  }, [tripId]);

  // 答案逐条出现
  useEffect(() => {
    const answers = trip?.report_data?.answers ?? [];
    if (!answers.length) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 0; i < answers.length; i++) {
      timers.push(
        setTimeout(() => setRevealedCount(i + 1), (i + 1) * REVEAL_INTERVAL),
      );
    }
    timers.push(
      setTimeout(
        () => setShowHighlight(true),
        (answers.length + 1) * REVEAL_INTERVAL + 200,
      ),
    );
    if (trip?.report_data?.teaching_moment) {
      timers.push(
        setTimeout(
          () => setShowTeaching(true),
          (answers.length + 1) * REVEAL_INTERVAL + 1500,
        ),
      );
    }
    return () => timers.forEach(clearTimeout);
  }, [trip?.report_data?.answers, trip?.report_data?.teaching_moment]);

  if (loading) {
    return (
      <MobileShell>
        <div className="min-h-dvh flex items-center justify-center">
          <span className="block w-10 h-10 rounded-full border-[3px] border-amber-light border-t-transparent animate-spin" />
        </div>
      </MobileShell>
    );
  }

  if (!trip || trip.status !== 'returned') {
    return (
      <MobileShell>
        <div className="min-h-dvh flex flex-col items-center justify-center px-8 gap-4">
          <p className="font-title text-body text-ink-2 text-center">
            它们今天还没回来......
          </p>
          <Link href="/home">
            <Button>先回家</Button>
          </Link>
        </div>
      </MobileShell>
    );
  }

  const data = trip.report_data ?? {};
  const answers = data.answers ?? [];
  const visitorName = data.visitor_name ?? '伙伴';

  return (
    <MobileShell>
      <header className="px-5 pt-3 pb-2 flex items-center justify-between border-b border-[rgba(95,94,90,0.12)]">
        <Link href="/home" className="font-title text-small text-ink-3">
          ← 回小家
        </Link>
        <h1 className="font-title text-h3 text-ink-1">学校</h1>
        <span aria-hidden className="w-12" />
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-6 pb-32">
        {/* 题目 */}
        <section className="mb-5">
          <p className="font-num text-mini text-amber-mid mb-1.5 tracking-[0.16em]">
            今天的问题{data.question_source === 'child' ? '（你出的）' : ''}
          </p>
          <p className="font-title text-h2 text-ink-1 leading-[1.4]">
            「{data.question}」
          </p>
        </section>

        {/* 答案逐条 */}
        <section className="flex flex-col gap-3 mb-5">
          {answers.map((a, i) => {
            const isVisitor = a.companion_name === visitorName;
            const isVisible = i < revealedCount;
            return (
              <div
                key={`${a.companion_name}-${i}`}
                className={clsx(
                  'transition-all duration-300 ease-out',
                  isVisible
                    ? 'opacity-100 translate-y-0'
                    : 'opacity-0 translate-y-2 pointer-events-none',
                )}
              >
                <div
                  className={clsx(
                    'rounded-card border-[1.2px] px-4 py-3',
                    isVisitor
                      ? 'bg-amber-light/30 border-amber-DEFAULT'
                      : 'bg-white border-[rgba(95,94,90,0.18)]',
                  )}
                >
                  <p className="font-title text-mini text-ink-3 mb-1">
                    {a.companion_name}
                    {isVisitor ? '（你的伙伴）' : ''} 说：
                  </p>
                  <p className="font-title text-body text-ink-1 leading-[1.6]">
                    「{a.answer}」
                  </p>
                </div>
              </div>
            );
          })}
        </section>

        {/* highlight */}
        {showHighlight && data.highlight && (
          <section className="mb-3">
            <p className="font-title text-h3 text-ink-1 leading-[1.6] text-center">
              ── {data.highlight} ──
            </p>
          </section>
        )}

        {/* 小蓝字教学时刻 */}
        {showTeaching && data.teaching_moment && (
          <section className="mb-3">
            <p className="font-title text-small text-[#3B6D9C] leading-relaxed text-center px-3">
              {data.teaching_moment}
            </p>
          </section>
        )}

        {data.source === 'fallback' && (
          <p className="font-title text-mini text-ink-3 mt-4 text-center">
            （它们今天有点累，没说太多）
          </p>
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 px-5 pb-7 pt-3 bg-bg-base border-t border-[rgba(95,94,90,0.12)]">
        {/* PRD §13.6: 小青龙不会答 → "现在告诉它"入口 */}
        {data.visitor_doesnt_know && (
          <button
            onClick={() => router.push('/memory')}
            className="w-full bg-[rgba(175,169,236,0.18)] border-[1.5px] border-m-uncertain rounded-card px-4 py-3 active:scale-[0.99] cursor-pointer mb-2 text-left"
          >
            <p className="font-title text-h3 text-ink-1 mb-0.5">
              {visitorName}没回答上来
            </p>
            <p className="font-title text-small text-ink-3">
              你还没告诉过它这个 — 现在去记忆面板告诉它 →
            </p>
          </button>
        )}
        <Link href="/home" className="block">
          <Button variant="ghost" size="lg" fullWidth>
            回小家
          </Button>
        </Link>
      </div>
    </MobileShell>
  );
}

export default function SchoolReportPage() {
  return (
    <Suspense fallback={<MobileShell><div className="min-h-dvh" /></MobileShell>}>
      <SchoolReportInner />
    </Suspense>
  );
}
