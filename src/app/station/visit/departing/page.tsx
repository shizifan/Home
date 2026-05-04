'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MobileShell } from '@/components/ui/MobileShell';

export default function VisitDepartingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tripId = searchParams.get('trip_id');
  const [dots, setDots] = useState(1);
  const [error, setError] = useState<string | null>(null);

  // Animated dots
  useEffect(() => {
    const interval = setInterval(() => {
      setDots((d) => (d % 3) + 1);
    }, 600);
    return () => clearInterval(interval);
  }, []);

  // Poll for trip completion
  const checkTrip = useCallback(async () => {
    if (!tripId) {
      setError('缺少出行信息');
      return true;
    }
    try {
      const r = await fetch(`/api/station/trip/${tripId}`);
      if (!r.ok) {
        setError('查询出行状态失败');
        return true;
      }
      const data = await r.json();
      if (data.trip?.status === 'returned') {
        router.push(`/station/visit/report?trip_id=${tripId}`);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [tripId, router]);

  useEffect(() => {
    if (!tripId) return;
    const timer = setInterval(async () => {
      const done = await checkTrip();
      if (done) clearInterval(timer);
    }, 1500);
    return () => clearInterval(timer);
  }, [tripId, checkTrip]);

  if (error) {
    return (
      <MobileShell>
        <div className="min-h-dvh flex flex-col items-center justify-center px-5 gap-4">
          <p className="font-title text-body text-ink-1">{error}</p>
          <button
            onClick={() => router.push('/station/map')}
            className="font-title text-body text-amber-deep cursor-pointer"
          >
            返回地图
          </button>
        </div>
      </MobileShell>
    );
  }

  return (
    <MobileShell>
      <div className="min-h-dvh flex flex-col items-center justify-center px-5">
        <div className="text-6xl mb-6 animate-bounce">🚶</div>
        <h1 className="font-title text-h2 text-ink-1">前往朋友家...</h1>
        <p className="font-title text-body text-ink-3 mt-3">
          小青龙正在路上{'.'.repeat(dots)}
        </p>
        <div className="mt-8 w-48 h-1 bg-amber-light/30 rounded-full overflow-hidden">
          <div className="h-full bg-amber-deep rounded-full animate-pulse" style={{ width: '40%' }} />
        </div>
      </div>
    </MobileShell>
  );
}
