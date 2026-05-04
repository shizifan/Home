'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MobileShell } from '@/components/ui/MobileShell';

interface Scenario {
  id: string;
  title: string;
  synopsis: string;
}

interface InventoryItem {
  id: string;
  item_id: string;
  item_name: string;
  item_category: string;
  item_description: string;
}

export default function PlazaPrepPage() {
  const router = useRouter();
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [departing, setDeparting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      // Fetch inventory
      const invR = await fetch('/api/inventory');
      if (invR.ok) {
        const invData = await invR.json();
        setInventory(invData.items || []);
      }

      // Fetch available scenarios (hardcoded list matching data/ directory)
      setScenarios([
        { id: 'water_disaster', title: '治水记', synopsis: '洪水肆虐，百姓危在旦夕。身为丞相，你需要召集大臣商议对策。' },
        { id: 'envoy_visit', title: '来使记', synopsis: '西域使节来访，态度傲慢。你需要在朝堂上维护国威。' },
        { id: 'plague_outbreak', title: '瘟疫记', synopsis: '边城爆发瘟疫，时间紧迫。' },
        { id: 'court_intrigue', title: '朝堂记', synopsis: '朝中暗流涌动，有大臣意图动摇朝廷。' },
        { id: 'border_alarm', title: '边关记', synopsis: '边关告急！敌军来犯。' },
      ]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleItem = (itemId: string) => {
    setSelectedItems((prev) => {
      if (prev.includes(itemId)) {
        return prev.filter((id) => id !== itemId);
      }
      if (prev.length >= 3) return prev; // max 3 items
      return [...prev, itemId];
    });
  };

  const handleDepart = async () => {
    if (!selectedScenario) return;
    setDeparting(true);

    try {
      const r = await fetch('/api/station/depart', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          trip_type: 'plaza',
          scenario_id: selectedScenario,
        }),
      });

      if (!r.ok) {
        const err = (await r.json().catch(() => ({}))) as { error?: string };
        alert(err.error ?? '出发失败');
        setDeparting(false);
        return;
      }

      const data = await r.json();

      // Build query params with selected items
      const params = new URLSearchParams({
        trip_id: data.trip_id,
        scenario_id: selectedScenario,
        items: selectedItems.join(','),
      });

      router.push(`/station/plaza/act/1?${params.toString()}`);
    } catch {
      alert('出发失败，请重试');
      setDeparting(false);
    }
  };

  const selectedScenarioData = scenarios.find((s) => s.id === selectedScenario);

  if (loading) {
    return (
      <MobileShell>
        <div className="min-h-dvh flex items-center justify-center">
          <p className="font-title text-h3 text-ink-3">加载中...</p>
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
        <h1 className="font-title text-h2 text-ink-1 mt-3">角色扮演</h1>
        <p className="font-title text-small text-ink-3 mt-1">选择一个剧本</p>
      </div>

      {/* Scenario selection */}
      <div className="px-5 flex flex-col gap-3 mb-6">
        {scenarios.map((s) => (
          <button
            key={s.id}
            onClick={() => setSelectedScenario(s.id)}
            className={`w-full text-left rounded-card border p-4 transition ${
              selectedScenario === s.id
                ? 'border-amber-deep bg-amber-light/20'
                : 'border-[rgba(95,94,90,0.1)] bg-bg-base'
            }`}
          >
            <h3 className="font-title text-body text-ink-1">{s.title}</h3>
            <p className="font-title text-mini text-ink-3 mt-1">{s.synopsis}</p>
          </button>
        ))}
      </div>

      {/* Item selection (only after scenario selected) */}
      {selectedScenarioData && (
        <>
          <div className="px-5 mb-3">
            <h2 className="font-title text-body text-ink-1">
              选择道具（最多3件 - 已选 {selectedItems.length}/3）
            </h2>
            <p className="font-title text-mini text-ink-3 mt-1">
              每幕将使用 1 件道具
            </p>
          </div>

          <div className="px-5 flex flex-col gap-2 mb-6">
            {inventory.length === 0 && (
              <p className="font-title text-small text-ink-3 text-center py-4">
                行囊是空的（这是正常的——游戏结束后会获得道具）
              </p>
            )}
            {inventory.map((item) => (
              <button
                key={item.id}
                onClick={() => toggleItem(item.item_id)}
                className={`w-full text-left rounded-card border p-3 transition ${
                  selectedItems.includes(item.item_id)
                    ? 'border-amber-deep bg-amber-light/20'
                    : 'border-[rgba(95,94,90,0.1)] bg-bg-base'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-title text-small text-ink-1">{item.item_name}</p>
                    <p className="font-title text-mini text-ink-3">{item.item_description}</p>
                  </div>
                  <span className={`font-num text-mini ${selectedItems.includes(item.item_id) ? 'text-amber-deep' : 'text-ink-3'}`}>
                    {selectedItems.includes(item.item_id) ? '已选' : `+`}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {/* Optional: no items mode */}
          <div className="px-5 mb-4">
            <button
              onClick={() => setSelectedItems([])}
              className="font-title text-mini text-ink-3 cursor-pointer underline"
            >
              不用道具，凭直觉
            </button>
          </div>
        </>
      )}

      <div className="px-5 pb-8">
        <button
          onClick={handleDepart}
          disabled={!selectedScenario || departing}
          className="w-full h-[52px] bg-ink-1 text-bg-base rounded-full font-title text-body flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition active:scale-[0.98]"
        >
          {departing ? '出发中...' : '🎭 出发'}
        </button>
      </div>
    </MobileShell>
  );
}
