'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MobileShell } from '@/components/ui/MobileShell';

interface PlazaEndingData {
  ending_type: 'perfect' | 'good' | 'barely';
  narrative: string;
  earned_items: Array<{ item_id: string; item_name: string; category: string }>;
  upgraded_items?: Array<{ from_id: string; from_name: string; to_id: string; to_name: string }>;
}

const ENDING_LABELS = {
  perfect: { label: '完美结局', icon: '🌟', color: 'text-amber-deep', bg: 'bg-amber-light/20' },
  good: { label: '好结局', icon: '✨', color: 'text-ink-1', bg: 'bg-amber-light/10' },
  barely: { label: '结局', icon: '💪', color: 'text-ink-3', bg: 'bg-[rgba(95,94,90,0.06)]' },
};

export default function PlazaEndingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tripId = searchParams.get('trip_id');
  const scenarioId = searchParams.get('scenario_id');
  const actsParam = searchParams.get('acts');
  const [loading, setLoading] = useState(true);
  const [ending, setEnding] = useState<PlazaEndingData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchEnding = useCallback(async () => {
    if (!tripId || !scenarioId || !actsParam) {
      setError('缺少必要信息');
      setLoading(false);
      return;
    }
    try {
      const acts = JSON.parse(actsParam);
      const r = await fetch('/api/station/plaza/finish', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          companion_id: '',
          trip_id: tripId,
          plaza_play_id: '', // will be handled by the server
          scenario_id: scenarioId,
          all_acts: acts,
        }),
      });

      if (!r.ok) throw new Error('finish failed');
      const data = await r.json();
      setEnding(data);
    } catch {
      setError('加载结局失败');
    } finally {
      setLoading(false);
    }
  }, [tripId, scenarioId, actsParam]);

  useEffect(() => {
    fetchEnding();
  }, [fetchEnding]);

  if (loading) {
    return (
      <MobileShell>
        <div className="min-h-dvh flex items-center justify-center">
          <p className="font-title text-h3 text-ink-3">生成结局中...</p>
        </div>
      </MobileShell>
    );
  }

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

  if (!ending) return null;

  const endingMeta = ENDING_LABELS[ending.ending_type] || ENDING_LABELS.barely;

  return (
    <MobileShell>
      <div className="px-5 pt-6 pb-4 text-center">
        <div className="text-6xl mb-4">🎭</div>
        <div className={`inline-block px-4 py-1 rounded-full ${endingMeta.bg} mb-2`}>
          <span className={`font-title text-mini ${endingMeta.color}`}>
            {endingMeta.icon} {endingMeta.label}
          </span>
        </div>
        <h1 className="font-title text-h2 text-ink-1 mt-2">剧本结束</h1>
      </div>

      <div className="px-5 flex flex-col gap-5 mb-8">
        {/* Narrative */}
        <div className="rounded-card border border-amber-light p-5 bg-bg-base">
          <p className="font-title text-small text-ink-1 leading-relaxed">
            {ending.narrative}
          </p>
        </div>

        {/* Earned items */}
        {ending.earned_items && ending.earned_items.length > 0 && (
          <div className="rounded-card border border-amber-light p-5 bg-amber-light/10">
            <h2 className="font-title text-body text-amber-deep mb-3">🎁 获得的物品</h2>
            <div className="flex flex-col gap-2">
              {ending.earned_items.map((item) => (
                <div key={item.item_id} className="flex items-center gap-2">
                  <span className="text-lg">📦</span>
                  <p className="font-title text-small text-ink-1">{item.item_name}</p>
                  <span className="font-title text-mini text-ink-3">{item.category}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upgraded items */}
        {ending.upgraded_items && ending.upgraded_items.length > 0 && (
          <div className="rounded-card border border-amber-light p-5 bg-bg-base">
            <h2 className="font-title text-body text-amber-deep mb-3">⬆ 升级的道具</h2>
            <div className="flex flex-col gap-2">
              {ending.upgraded_items.map((item) => (
                <div key={item.to_id} className="flex items-center gap-2">
                  <span className="font-title text-small text-ink-3 line-through">{item.from_name}</span>
                  <span className="font-title text-mini text-ink-3">→</span>
                  <span className="font-title text-small text-amber-deep font-bold">{item.to_name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="px-5 pb-8 flex flex-col gap-3">
        <button
          onClick={() => router.push('/station/map')}
          className="w-full h-[52px] bg-ink-1 text-bg-base rounded-full font-title text-body flex items-center justify-center gap-2 cursor-pointer transition active:scale-[0.98]"
        >
          返回地图
        </button>
        <button
          onClick={() => router.push('/station/backpack')}
          className="w-full h-[48px] bg-transparent text-ink-1 border border-[rgba(95,94,90,0.2)] rounded-full font-title text-body flex items-center justify-center gap-2 cursor-pointer transition active:scale-[0.98]"
        >
          🎒 查看行囊
        </button>
      </div>
    </MobileShell>
  );
}
