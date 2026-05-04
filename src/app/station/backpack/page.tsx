'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MobileShell } from '@/components/ui/MobileShell';

interface InventoryItem {
  id: string;
  item_id: string;
  item_name: string;
  item_category: string;
  item_subcategory?: string;
  item_description: string;
  item_detailed_description: string;
  acquired_at: string;
  use_count: number;
}

const CATEGORY_META: Record<string, { icon: string; label: string; color: string }> = {
  knowledge: { icon: '📜', label: '知识卷轴', color: 'text-amber-deep' },
  object: { icon: '🎁', label: '实体物品', color: 'text-[#D4537E]' },
  gift: { icon: '💝', label: '馈赠物品', color: 'text-[#97C459]' },
  ability: { icon: '⚡', label: '特殊能力', color: 'text-[#4589F1]' },
};

export default function BackpackPage() {
  const router = useRouter();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInventory = useCallback(async () => {
    try {
      const r = await fetch('/api/inventory');
      if (r.ok) {
        const data = await r.json();
        setInventory(data.items || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  // Group by category
  const grouped: Record<string, InventoryItem[]> = {};
  for (const item of inventory) {
    const cat = item.item_category;
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(item);
  }

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
          ← 返回
        </button>
        <h1 className="font-title text-h2 text-ink-1 mt-3">行囊</h1>
        <p className="font-title text-small text-ink-3 mt-1">
          共 {inventory.length} 件物品
        </p>
      </div>

      {inventory.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <p className="text-5xl mb-4">🎒</p>
          <p className="font-title text-body text-ink-3">
            行囊是空的
          </p>
          <p className="font-title text-mini text-ink-3 mt-1">
            去小区广场角色扮演可以获得道具
          </p>
        </div>
      ) : (
        <div className="px-5 flex flex-col gap-6 mb-8">
          {Object.entries(CATEGORY_META).map(([cat, meta]) => {
            const items = grouped[cat];
            if (!items || items.length === 0) return null;

            return (
              <div key={cat}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">{meta.icon}</span>
                  <h2 className={`font-title text-body ${meta.color}`}>
                    {meta.label}
                  </h2>
                  <span className="font-num text-mini text-ink-3">
                    ({items.length})
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {items.map((item) => (
                    <button
                      key={item.id}
                      className="rounded-card border border-[rgba(95,94,90,0.1)] bg-bg-base p-3 text-left hover:border-amber-light transition cursor-pointer"
                    >
                      <p className="font-title text-small text-ink-1">{item.item_name}</p>
                      <p className="font-title text-mini text-ink-3 mt-1 line-clamp-2">
                        {item.item_description}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="px-5 pb-8">
        <button
          onClick={() => router.push('/station/map')}
          className="w-full h-[48px] bg-ink-1 text-bg-base rounded-full font-title text-body flex items-center justify-center gap-2 cursor-pointer transition active:scale-[0.98]"
        >
          返回地图
        </button>
      </div>
    </MobileShell>
  );
}
