'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import { MobileShell } from '@/components/ui/MobileShell';

interface PlazaActData {
  act_number: number;
  scene_narrative: string;
  companion_speech: string;
  reactions: string;
  item_use_quality?: string;
  remaining_items: Array<{ item_id: string; item_name: string }>;
}

interface ActChoice {
  act: number;
  selected_item_id: string | null;
  item_name?: string;
  narrative: string;
  item_use_quality?: string;
}

export default function PlazaActPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();
  const actNumber = Number(params.n);

  const tripId = searchParams.get('trip_id');
  const scenarioId = searchParams.get('scenario_id');
  const itemsParam = searchParams.get('items') || '';

  const allItems = itemsParam ? itemsParam.split(',').filter(Boolean) : [];
  const previousActs: ActChoice[] = JSON.parse(searchParams.get('prev_acts') || '[]');

  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<PlazaActData | null>(null);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get remaining items (items not used in previous acts and not selected yet)
  const usedItemIds = previousActs.map((a) => a.selected_item_id).filter(Boolean) as string[];
  const remainingItems = result?.remaining_items || allItems
    .filter((id) => !usedItemIds.includes(id))
    .map((id) => ({ item_id: id, item_name: id }));

  const itemsForCurrentAct = remainingItems.filter(
    (item) => item.item_id !== selectedItem || submitting
  );

  const playAct = useCallback(async () => {
    try {
      const r = await fetch('/api/station/plaza/play', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          companion_id: '', // will be resolved server-side from singleton user
          scenario_id: scenarioId,
          act_number: actNumber,
          selected_item_id: selectedItem,
          previous_acts: previousActs,
        }),
      });

      if (!r.ok) throw new Error('play failed');
      const data = await r.json();
      setResult(data);
    } catch {
      setError('加载场景失败');
    } finally {
      setLoading(false);
    }
  }, [scenarioId, actNumber, selectedItem, previousActs]);

  const handleUseItem = async (itemId: string | null) => {
    setSelectedItem(itemId);
    setSubmitting(true);
    setLoading(true);

    try {
      const r = await fetch('/api/station/plaza/play', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          companion_id: '',
          scenario_id: scenarioId,
          act_number: actNumber,
          selected_item_id: itemId,
          previous_acts: previousActs,
        }),
      });

      if (!r.ok) throw new Error('play failed');
      const data = await r.json();
      setResult(data);
    } catch {
      setError('执行场景失败');
    } finally {
      setLoading(false);
      setSubmitting(false);
    }
  };

  const handleNextAct = () => {
    const newActChoice: ActChoice = {
      act: actNumber,
      selected_item_id: selectedItem,
      item_name: remainingItems.find((i) => i.item_id === selectedItem)?.item_name,
      narrative: result?.scene_narrative || '',
      item_use_quality: result?.item_use_quality,
    };

    const allActs = [...previousActs, newActChoice];

    if (actNumber >= 3) {
      // Go to ending
      const params = new URLSearchParams({
        trip_id: tripId || '',
        scenario_id: scenarioId || '',
        acts: JSON.stringify(allActs),
      });
      router.push(`/station/plaza/ending?${params.toString()}`);
    } else {
      // Go to next act
      const params = new URLSearchParams({
        trip_id: tripId || '',
        scenario_id: scenarioId || '',
        items: itemsParam,
        prev_acts: JSON.stringify(allActs),
      });
      router.push(`/station/plaza/act/${actNumber + 1}?${params.toString()}`);
    }
  };

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

  if (loading && submitting) {
    return (
      <MobileShell>
        <div className="min-h-dvh flex items-center justify-center">
          <p className="font-title text-h3 text-ink-3">正在展开剧情...</p>
        </div>
      </MobileShell>
    );
  }

  // Step 1: Item selection (not yet submitted)
  if (!result) {
    return (
      <MobileShell>
        <div className="px-5 pt-6 pb-4">
          <h1 className="font-title text-h2 text-ink-1">第 {actNumber} 幕</h1>
          <p className="font-title text-small text-ink-3 mt-1">
            从剩余道具中选择 1 件使用
          </p>
        </div>

        <div className="px-5 flex flex-col gap-3 mb-6">
          {itemsForCurrentAct.map((item) => (
            <button
              key={item.item_id}
              onClick={() => handleUseItem(item.item_id)}
              disabled={submitting}
              className="w-full text-left rounded-card border border-[rgba(95,94,90,0.1)] bg-bg-base p-4 hover:border-amber-light transition disabled:opacity-50 cursor-pointer"
            >
              <p className="font-title text-small text-ink-1">{item.item_name}</p>
            </button>
          ))}
          <button
            onClick={() => handleUseItem(null)}
            disabled={submitting}
            className="w-full text-left rounded-card border border-[rgba(95,94,90,0.1)] bg-bg-base p-4 hover:border-amber-light transition disabled:opacity-50 cursor-pointer"
          >
            <p className="font-title text-small text-ink-3">不用道具，凭直觉</p>
          </button>
        </div>

        <div className="px-5 pb-8">
          <button
            onClick={() => router.push('/station/map')}
            className="font-title text-mini text-ink-3 cursor-pointer underline"
          >
            返回地图
          </button>
        </div>
      </MobileShell>
    );
  }

  // Step 2: Show result
  return (
    <MobileShell>
      <div className="px-5 pt-6 pb-4">
        <h1 className="font-title text-h2 text-ink-1">第 {result.act_number} 幕</h1>
      </div>

      <div className="px-5 flex flex-col gap-5 mb-8">
        {/* Scene narrative */}
        <div className="rounded-card border border-amber-light p-5 bg-bg-base">
          <p className="font-title text-small text-ink-1 leading-relaxed">
            {result.scene_narrative}
          </p>
        </div>

        {/* Companion speech */}
        <div className="rounded-card border border-amber-light p-5 bg-amber-light/10">
          <p className="font-title text-small text-ink-1 leading-relaxed">
            {result.companion_speech}
          </p>
        </div>

        {/* Reactions */}
        {result.reactions && (
          <div className="rounded-card border border-[rgba(95,94,90,0.1)] p-5 bg-bg-base">
            <p className="font-title text-mini text-ink-3 leading-relaxed">
              {result.reactions}
            </p>
          </div>
        )}

        {/* Item quality tag */}
        {result.item_use_quality && (
          <div className="flex justify-center">
            <span className={`font-title text-mini px-3 py-1 rounded-full ${
              result.item_use_quality === 'clever'
                ? 'bg-amber-light/30 text-amber-deep'
                : 'bg-[rgba(95,94,90,0.1)] text-ink-3'
            }`}>
              {result.item_use_quality === 'clever' ? '✨ 妙用' : '道具使用'}
            </span>
          </div>
        )}
      </div>

      <div className="px-5 pb-8">
        <button
          onClick={handleNextAct}
          className="w-full h-[52px] bg-ink-1 text-bg-base rounded-full font-title text-body flex items-center justify-center gap-2 cursor-pointer transition active:scale-[0.98]"
        >
          {actNumber >= 3 ? '查看结局 →' : `进入第 ${actNumber + 1} 幕 →`}
        </button>
      </div>
    </MobileShell>
  );
}
