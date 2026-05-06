/**
 * 行囊页（PRD §14.3.3 / §20.12）
 * 4 类道具分组展示；空类不展示；点击进详情。
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MobileShell } from '@/components/ui/MobileShell';
import {
  getInventory,
  type InventoryItemView,
  type InventoryResponse,
} from '@/lib/api/client';

const CATEGORY_TITLES: Record<string, string> = {
  knowledge: '📖 知识',
  object: '💰 物品',
  gift: '🎁 礼物',
  ability: '✨ 能力',
};

export default function InventoryPage() {
  const router = useRouter();
  const [data, setData] = useState<InventoryResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getInventory()
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <MobileShell>
      <header className="px-5 pt-3 pb-2 flex items-center justify-between border-b border-[rgba(95,94,90,0.12)]">
        <Link href="/home" className="font-title text-small text-ink-3">
          ← 回小家
        </Link>
        <h1 className="font-title text-h3 text-ink-1">行囊</h1>
        <span aria-hidden className="w-12" />
      </header>

      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <span className="block w-10 h-10 rounded-full border-[3px] border-amber-light border-t-transparent animate-spin" />
        </div>
      )}

      {!loading && (!data || data.items.length === 0) && (
        <div className="flex-1 flex flex-col items-center justify-center px-8 gap-3">
          <p className="font-title text-h3 text-ink-1">行囊还是空的</p>
          <p className="font-title text-body text-ink-2 text-center leading-relaxed">
            去小区广场玩一次，
            <br />
            它会带回道具放进这里。
          </p>
          <Link
            href="/station"
            className="font-title text-small text-amber-mid mt-2 underline"
          >
            去驿站 →
          </Link>
        </div>
      )}

      {!loading && data && data.items.length > 0 && (
        <div className="flex-1 overflow-y-auto px-5 py-5 pb-24">
          {(['knowledge', 'object', 'gift', 'ability'] as const).map((cat) => {
            const items = data.grouped[cat];
            if (!items.length) return null;
            return (
              <section key={cat} className="mb-6">
                <h2 className="font-title text-h3 text-ink-1 mb-2">
                  {CATEGORY_TITLES[cat]}
                </h2>
                <div className="flex flex-col gap-2">
                  {items.map((item) => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      onClick={() => router.push(`/inventory/${item.id}`)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
          <p className="font-title text-mini text-ink-3 text-center mt-6">
            道具不会消耗，用过的也仍在行囊里。
          </p>
        </div>
      )}
    </MobileShell>
  );
}

function ItemRow({
  item,
  onClick,
}: {
  item: InventoryItemView;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="text-left bg-white border border-[rgba(95,94,90,0.18)] rounded-card px-4 py-3 active:scale-[0.99] cursor-pointer flex items-center gap-3"
    >
      <span className="text-[24px] leading-none" aria-hidden>
        {item.icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-title text-h3 text-ink-1">{item.name}</p>
        <p className="font-title text-small text-ink-3 truncate">
          {item.description}
        </p>
      </div>
      <span className="font-num text-mini text-ink-3 whitespace-nowrap">
        {item.use_count > 0 ? `用过 ${item.use_count} 次` : '未用过'}
      </span>
    </button>
  );
}
