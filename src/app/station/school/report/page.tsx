'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MobileShell } from '@/components/ui/MobileShell';

interface Answer {
  companion: string;
  answer: string;
  basis?: string;
}

interface ReportData {
  question?: string;
  answers?: Answer[];
  highlight?: string;
  teaching_moment?: string;
}

const COMPANION_COLORS = ['#D4537E', '#E8C896', '#97C459', '#1D9E75'];

export default function SchoolReportPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tripId = searchParams.get('trip_id');
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<ReportData | null>(null);
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
        <h1 className="font-title text-h2 text-ink-1 mt-3">课堂报告</h1>
      </div>

      <div className="px-5 flex flex-col gap-5 mb-8">
        {/* Question */}
        <div className="rounded-card border border-amber-light p-5 bg-amber-light/10">
          <h2 className="font-title text-mini text-amber-deep mb-2">📋 课堂问题</h2>
          <p className="font-title text-h3 text-ink-1">
            {report.question || '一个问题'}
          </p>
        </div>

        {/* Answers */}
        {report.answers && report.answers.length > 0 && (
          <div className="rounded-card border border-amber-light p-5 bg-bg-base">
            <h2 className="font-title text-body text-amber-deep mb-4">🗣 大家的回答</h2>
            <div className="flex flex-col gap-4">
              {report.answers.map((a, i) => (
                <div key={i} className="flex gap-3">
                  <div
                    className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white text-mini font-bold"
                    style={{ backgroundColor: COMPANION_COLORS[i % COMPANION_COLORS.length] }}
                  >
                    {a.companion.charAt(0)}
                  </div>
                  <div>
                    <p className="font-title text-mini text-ink-3">{a.companion}</p>
                    <p className="font-title text-small text-ink-1 mt-0.5 leading-relaxed">
                      {a.answer}
                    </p>
                    {a.basis && (
                      <p className="font-title text-mini text-ink-3 mt-1">
                        （依据：{a.basis}）
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Highlight */}
        {report.highlight && (
          <div className="rounded-card border border-amber-light p-5 bg-bg-base">
            <h2 className="font-title text-body text-amber-deep mb-3">✨ 小青龙的发现</h2>
            <p className="font-title text-small text-ink-1 leading-relaxed">
              {report.highlight}
            </p>
          </div>
        )}

        {/* Teaching Moment */}
        {report.teaching_moment && (
          <div className="rounded-card bg-[rgba(69,137,241,0.08)] border border-[rgba(69,137,241,0.2)] p-5">
            <p className="font-title text-small text-[#4589F1] leading-relaxed">
              💡 {report.teaching_moment}
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
