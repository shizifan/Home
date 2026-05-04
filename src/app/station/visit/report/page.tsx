'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MobileShell } from '@/components/ui/MobileShell';

interface ReportData {
  scene_narrative?: string;
  observation?: string;
  highlights?: string[];
  new_word?: {
    concept: string;
    source_companion: string;
  };
}

export default function VisitReportPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tripId = searchParams.get('trip_id');
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<ReportData | null>(null);
  const [destination, setDestination] = useState<{ id: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    if (!tripId) {
      setError('缺少出行信息');
      setLoading(false);
      return;
    }
    try {
      const r = await fetch(`/api/station/trip/${tripId}`);
      if (!r.ok) throw new Error('fetch failed');
      const data = await r.json();
      setReport(data.trip?.report_data || {});
      setDestination(data.destination_companion || null);
    } catch {
      setError('加载报告失败');
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  if (loading) {
    return (
      <MobileShell>
        <div className="min-h-dvh flex items-center justify-center">
          <p className="font-title text-h3 text-ink-3">加载中...</p>
        </div>
      </MobileShell>
    );
  }

  if (error || !report) {
    return (
      <MobileShell>
        <div className="min-h-dvh flex flex-col items-center justify-center px-5 gap-4">
          <p className="font-title text-body text-ink-1">{error ?? '报告未生成'}</p>
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
      <div className="px-5 pt-6 pb-4">
        <button
          onClick={() => router.push('/station/map')}
          className="font-title text-small text-ink-3 flex items-center gap-1 cursor-pointer"
        >
          ← 返回地图
        </button>
        <h1 className="font-title text-h2 text-ink-1 mt-3">
          拜访{destination?.name ?? '朋友'}的家
        </h1>
      </div>

      <div className="px-5 flex flex-col gap-5 mb-8">
        {/* Scene narrative */}
        <div className="rounded-card border border-amber-light p-5 bg-bg-base">
          <h2 className="font-title text-body text-amber-deep mb-3">🏠 拜访故事</h2>
          <p className="font-title text-small text-ink-1 leading-relaxed">
            {report.scene_narrative || '小青龙来到了朋友的家...'}
          </p>
        </div>

        {/* Observation */}
        <div className="rounded-card border border-amber-light p-5 bg-bg-base">
          <h2 className="font-title text-body text-amber-deep mb-3">🔍 小青龙的观察</h2>
          <p className="font-title text-small text-ink-1 leading-relaxed">
            {report.observation || '对方的家和我们的家很不一样。'}
          </p>
        </div>

        {/* Highlights */}
        {report.highlights && report.highlights.length > 0 && (
          <div className="rounded-card border border-amber-light p-5 bg-bg-base">
            <h2 className="font-title text-body text-amber-deep mb-3">✨ 有趣的发现</h2>
            <ul className="space-y-2">
              {report.highlights.map((h, i) => (
                <li key={i} className="font-title text-small text-ink-1 flex gap-2">
                  <span className="text-amber-deep">•</span>
                  {h}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* New word */}
        {report.new_word && (
          <div className="rounded-card border border-amber-light p-5 bg-amber-light/10">
            <h2 className="font-title text-body text-amber-deep mb-3">📝 学到了新东西</h2>
            <p className="font-title text-small text-ink-1">
              小青龙从{report.new_word.source_companion}那里听说了
              <span className="text-amber-deep font-bold">「{report.new_word.concept}」</span>！
              这条知识已经存入记忆面板。
            </p>
          </div>
        )}
      </div>

      <div className="px-5 pb-8">
        <button
          onClick={() => router.push('/station/map')}
          className="w-full h-[52px] bg-ink-1 text-bg-base rounded-full font-title text-body flex items-center justify-center gap-2 cursor-pointer transition active:scale-[0.98]"
        >
          返回地图
        </button>
      </div>
    </MobileShell>
  );
}
