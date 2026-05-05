/**
 * 拜访汇报页（PRD §12.6 / §20.10）
 *
 * 4 种目的对应 4 种版式（PRD §12.6 A/B/C/D）
 * "去问问题"路径下，如果带回 new_word，给一个"在记忆面板里看 →"按钮，
 * 触发 POST /api/station/memory/import 后跳 /memory。
 */

'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { MobileShell } from '@/components/ui/MobileShell';
import { Button } from '@/components/ui/Button';
import { getTrip, importTripMemory, type VisitPurpose } from '@/lib/api/client';

interface ReportData {
  new_word?: {
    concept_name: string;
    ai_summary: string;
    ai_reasoning: string;
    confidence: number;
  } | null;
  host_meta?: {
    preset_id?: string;
    name?: string;
    appearance?: string;
  } | null;
  purpose?: { type?: VisitPurpose | string; question?: string | null };
  source?: 'llm' | 'fallback';
  imported_memory_bank_id?: string;
}

interface TripView {
  id: string;
  trip_type: string;
  status: 'traveling' | 'returned';
  report_narrative?: string;
  report_data?: ReportData;
}

const PURPOSE_LABELS: Record<VisitPurpose, string> = {
  meet_friend: '认识一个新朋友',
  observe_home: '看看朋友家',
  introduce_self: '说说自己',
  ask_question: '问朋友一件事',
};

function VisitReportInner() {
  const router = useRouter();
  const params = useSearchParams();
  const tripId = params.get('trip_id');
  const [trip, setTrip] = useState<TripView | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(false);

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

  const onImportMemory = async () => {
    if (!tripId || importing) return;
    setImporting(true);
    try {
      await importTripMemory(tripId);
      setImported(true);
      // 给一点时间让用户看到反馈，再跳
      setTimeout(() => router.push('/memory'), 600);
    } catch {
      setImporting(false);
    }
  };

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
            它好像还没回来......
          </p>
          <Link href="/home">
            <Button>先回家</Button>
          </Link>
        </div>
      </MobileShell>
    );
  }

  const data = trip.report_data ?? {};
  const hostName = data.host_meta?.name ?? '朋友';
  const purpose = data.purpose?.type as VisitPurpose | undefined;
  const purposeLabel = purpose ? PURPOSE_LABELS[purpose] ?? '' : '';
  const newWord = data.new_word ?? null;

  return (
    <MobileShell>
      <header className="px-5 pt-3 pb-2 flex items-center justify-between border-b border-[rgba(95,94,90,0.12)]">
        <Link href="/home" className="font-title text-small text-ink-3">
          ← 回小家
        </Link>
        <h1 className="font-title text-h3 text-ink-1">{hostName}家</h1>
        <span aria-hidden className="w-12" />
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-6 pb-32">
        <p className="font-num text-mini text-amber-mid mb-2 tracking-[0.16em]">
          目的 · {purposeLabel}
        </p>
        {data.purpose?.question && (
          <p className="font-title text-small text-ink-3 mb-3">
            它替你问了：「{data.purpose.question}」
          </p>
        )}

        {/* 主叙事 */}
        <article className="bg-white border-[1.2px] border-ink-2 rounded-card px-5 py-5 leading-[1.8]">
          <p className="font-title text-h3 text-ink-1 whitespace-pre-line">
            {trip.report_narrative}
          </p>
        </article>

        {/* 二手知识卡 */}
        {newWord && (
          <section className="mt-5 bg-amber-light/30 border-[1.5px] border-amber-DEFAULT rounded-card px-5 py-4">
            <p className="font-num text-mini text-amber-mid tracking-[0.16em] mb-2">
              带回了一个新词
            </p>
            <p className="font-title text-h2 text-amber-deep mb-1">
              「{newWord.concept_name}」
            </p>
            <p className="font-title text-body text-ink-1 leading-[1.7]">
              {newWord.ai_summary}
            </p>
            <p className="font-title text-small text-ink-3 mt-2">
              （{hostName}告诉它的，可能不一定准）
            </p>
          </section>
        )}

        {data.source === 'fallback' && (
          <p className="font-title text-mini text-ink-3 mt-4 text-center">
            （它今天有点累，没说太多）
          </p>
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 px-5 pb-7 pt-3 bg-bg-base border-t border-[rgba(95,94,90,0.12)]">
        {newWord && !imported && !data.imported_memory_bank_id && (
          <Button
            size="lg"
            fullWidth
            onClick={onImportMemory}
            disabled={importing}
            className="mb-2"
          >
            {importing ? '正在记下来......' : '在记忆面板里看 →'}
          </Button>
        )}
        {(imported || data.imported_memory_bank_id) && (
          <p className="font-title text-small text-ink-3 text-center mb-2">
            ✓ 已经记下来了
          </p>
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

export default function VisitReportPage() {
  return (
    <Suspense fallback={<MobileShell><div className="min-h-dvh" /></MobileShell>}>
      <VisitReportInner />
    </Suspense>
  );
}
