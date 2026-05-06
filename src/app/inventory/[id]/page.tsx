/**
 * 道具详情页（PRD §14.3.3）
 */

'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { MobileShell } from '@/components/ui/MobileShell';
import { Button } from '@/components/ui/Button';
import {
  getInventoryItem,
  type InventoryItemView,
} from '@/lib/api/client';

interface DetailResponse {
  item: InventoryItemView;
  applicable_scenarios: string[];
  upgrade_to: string | null;
}

const SCENARIO_NAMES: Record<string, string> = {
  water_disaster: '水患治理',
  envoy_visit: '使节来访',
  plague_outbreak: '瘟疫蔓延',
  court_intrigue: '朝堂谋略',
  border_alarm: '边境警报',
};

export default function InventoryItemDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getInventoryItem(id)
      .then((r) => setData(r as DetailResponse))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <MobileShell>
        <div className="min-h-dvh flex items-center justify-center">
          <span className="block w-10 h-10 rounded-full border-[3px] border-amber-light border-t-transparent animate-spin" />
        </div>
      </MobileShell>
    );
  }

  if (!data) {
    return (
      <MobileShell>
        <div className="min-h-dvh flex flex-col items-center justify-center gap-4 px-8">
          <p className="font-title text-body text-ink-2 text-center">
            没找到这个道具......
          </p>
          <Link href="/inventory">
            <Button>回行囊</Button>
          </Link>
        </div>
      </MobileShell>
    );
  }

  const { item, applicable_scenarios } = data;

  return (
    <MobileShell>
      <header className="px-5 pt-3 pb-2 flex items-center justify-between border-b border-[rgba(95,94,90,0.12)]">
        <Link href="/inventory" className="font-title text-small text-ink-3">
          ← 行囊
        </Link>
        <h1 className="font-title text-h3 text-ink-1">道具详情</h1>
        <span aria-hidden className="w-12" />
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-6 pb-12">
        {/* 道具图标与名字 */}
        <div className="flex flex-col items-center mb-6">
          <span className="text-[64px] leading-none mb-2" aria-hidden>
            {item.icon}
          </span>
          <p className="font-title text-h2 text-ink-1">{item.name}</p>
          <p className="font-num text-mini text-ink-3 mt-1">
            {item.use_count > 0 ? `用过 ${item.use_count} 次` : '未用过'}
          </p>
        </div>

        {/* 详细说明 */}
        <section className="bg-white border border-[rgba(95,94,90,0.18)] rounded-card px-4 py-4 mb-4">
          <p className="font-title text-body text-ink-1 leading-[1.7]">
            {item.detailed_description || item.description}
          </p>
        </section>

        {/* 适用剧本 */}
        {applicable_scenarios.length > 0 && (
          <section className="mb-4">
            <p className="font-title text-mini text-ink-3 mb-1.5 tracking-[0.16em]">
              在这些剧本里能派上用场：
            </p>
            <div className="flex flex-wrap gap-2">
              {applicable_scenarios.map((sid) => (
                <span
                  key={sid}
                  className="font-title text-small text-amber-mid bg-amber-light/30 border border-amber-DEFAULT rounded-full px-2.5 py-0.5"
                >
                  {SCENARIO_NAMES[sid] ?? sid}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* 来源 */}
        {item.acquired_from && (
          <p className="font-title text-mini text-ink-3 text-center">
            来源：{item.acquired_from}
          </p>
        )}
      </div>
    </MobileShell>
  );
}
