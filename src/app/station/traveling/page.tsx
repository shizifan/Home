/**
 * 出门中等待页（PRD §11.5 叙事化等待）
 *
 * 实际后端在跑 LLM；本页负责：
 *   1. 显示叙事化"它出去走走了"动效
 *   2. 轮询 GET /api/station/trip/[id]，status=returned → 跳报告页
 *   3. 超时 30s 仍未 returned → 友好提示"路上还在走"，提供"先回家"按钮
 */

'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { MobileShell } from '@/components/ui/MobileShell';
import { Button } from '@/components/ui/Button';
import { getTrip } from '@/lib/api/client';

const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 30_000;

function TravelingInner() {
  const router = useRouter();
  const params = useSearchParams();
  const tripId = params.get('trip_id');
  const [phase, setPhase] = useState<'polling' | 'timeout' | 'error'>('polling');
  const startedAt = useRef<number>(Date.now());

  useEffect(() => {
    if (!tripId) {
      setPhase('error');
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      if (cancelled) return;
      try {
        const r = await getTrip(tripId);
        const trip = r.trip as unknown as { status?: string; trip_type?: string };
        if (trip.status === 'returned') {
          const dest =
            trip.trip_type === 'visit'
              ? `/station/report/visit?trip_id=${encodeURIComponent(tripId)}`
              : trip.trip_type === 'school'
                ? `/station/report/school?trip_id=${encodeURIComponent(tripId)}`
                : '/station';
          router.replace(dest);
          return;
        }
        if (Date.now() - startedAt.current > POLL_TIMEOUT_MS) {
          setPhase('timeout');
          return;
        }
        timer = setTimeout(poll, POLL_INTERVAL_MS);
      } catch {
        if (Date.now() - startedAt.current > POLL_TIMEOUT_MS) {
          setPhase('timeout');
          return;
        }
        timer = setTimeout(poll, POLL_INTERVAL_MS);
      }
    };

    poll();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [tripId, router]);

  return (
    <MobileShell>
      <div className="min-h-dvh flex flex-col items-center justify-center px-8 gap-6">
        {phase === 'polling' && (
          <>
            <div className="relative w-32 h-32 flex items-center justify-center">
              <span className="block w-20 h-20 rounded-full border-[3px] border-amber-light border-t-transparent animate-spin" />
              <span className="absolute text-[42px]" aria-hidden>
                🚪
              </span>
            </div>
            <p className="font-title text-h2 text-ink-1 text-center">
              它出门去了。
            </p>
            <p className="font-title text-body text-ink-2 text-center max-w-[280px] leading-relaxed">
              路上慢慢走，
              <br />
              一会儿就回来。
            </p>
          </>
        )}

        {phase === 'timeout' && (
          <>
            <p className="font-title text-h2 text-ink-1 text-center">
              它好像还在路上......
            </p>
            <p className="font-title text-body text-ink-2 text-center max-w-[280px] leading-relaxed">
              先回小家等等？过一会儿再来看看。
            </p>
            <Link href="/home">
              <Button>先回家</Button>
            </Link>
          </>
        )}

        {phase === 'error' && (
          <>
            <p className="font-title text-h2 text-ink-1 text-center">
              出了点问题
            </p>
            <Link href="/station">
              <Button>回驿站</Button>
            </Link>
          </>
        )}
      </div>
    </MobileShell>
  );
}

export default function TravelingPage() {
  return (
    <Suspense fallback={<MobileShell><div className="min-h-dvh" /></MobileShell>}>
      <TravelingInner />
    </Suspense>
  );
}
