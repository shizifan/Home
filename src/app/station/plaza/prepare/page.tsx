/**
 * 广场准备页（PRD §14.6 / §20.10）
 *
 * 展示：
 *   - 今日剧本（标题 + 简介）
 *   - 角色分配（小青龙 + 同台 3 只伙伴）
 *   - 选 3 件道具（从行囊里选；剧本适配的道具高亮）
 *   - 出发按钮 → /station/plaza/play/[scenario_id]/act/1（P5 实装）
 *
 * 第一次进准备页时后端发新手礼包；本页会用 starter_pack_granted 字段触发一个一次性提示。
 */

'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import { MobileShell } from '@/components/ui/MobileShell';
import { Button } from '@/components/ui/Button';
import {
  getPlazaPrepare,
  type InventoryItemView,
  type PlazaPrepareResponse,
} from '@/lib/api/client';

const REQUIRED_PICKS = 3;

function PlazaPrepareInner() {
  const router = useRouter();
  const [data, setData] = useState<PlazaPrepareResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ msg: string; hint?: string } | null>(null);
  const [picked, setPicked] = useState<string[]>([]);

  useEffect(() => {
    getPlazaPrepare()
      .then(setData)
      .catch((e) => {
        const err = e as Error & { hint?: string };
        setError({ msg: err.message, hint: err.hint });
      })
      .finally(() => setLoading(false));
  }, []);

  const togglePick = (rowId: string) => {
    setPicked((prev) => {
      if (prev.includes(rowId)) return prev.filter((p) => p !== rowId);
      if (prev.length >= REQUIRED_PICKS) return prev;
      return [...prev, rowId];
    });
  };

  const onDepart = () => {
    if (!data || picked.length !== REQUIRED_PICKS) return;
    // P5 实装真实出发逻辑；此处先把选择 query 化跳到剧本页占位路径
    const params = new URLSearchParams({
      scenario_id: data.scenario.id,
      items: picked.join(','),
    });
    router.push(`/station/plaza/play?${params.toString()}`);
  };

  if (loading) {
    return (
      <MobileShell>
        <div className="min-h-dvh flex items-center justify-center">
          <span className="block w-10 h-10 rounded-full border-[3px] border-amber-light border-t-transparent animate-spin" />
        </div>
      </MobileShell>
    );
  }

  if (error) {
    const friendly =
      error.msg === 'not_graduated'
        ? '它还没住满 7 天。'
        : error.msg === 'locked:plaza'
          ? error.hint || '广场还没解锁——先去 1 次学校。'
          : '出了点问题，再试一次？';
    return (
      <MobileShell>
        <div className="min-h-dvh flex flex-col items-center justify-center gap-4 px-8">
          <p className="font-title text-body text-ink-2 text-center">{friendly}</p>
          <Link href="/station">
            <Button>回驿站</Button>
          </Link>
        </div>
      </MobileShell>
    );
  }

  if (!data) return null;

  const { scenario, roles, inventory, applicable_item_ids, starter_pack_granted } =
    data;
  const items = inventory.items;
  const allEmpty = items.length === 0;

  return (
    <MobileShell>
      <header className="px-5 pt-3 pb-2 flex items-center justify-between border-b border-[rgba(95,94,90,0.12)]">
        <Link href="/station" className="font-title text-small text-ink-3">
          ← 驿站
        </Link>
        <h1 className="font-title text-h3 text-ink-1">小区广场</h1>
        <span aria-hidden className="w-12" />
      </header>

      <div className="flex-1 overflow-y-auto px-5 pt-4 pb-32">
        {/* 新手礼包提示 */}
        {starter_pack_granted && starter_pack_granted.length > 0 && (
          <div className="bg-amber-light/40 border-[1.5px] border-amber-DEFAULT rounded-card px-4 py-3 mb-4">
            <p className="font-title text-h3 text-amber-deep mb-1">
              🎒 新手礼包到啦
            </p>
            <p className="font-title text-small text-ink-2 leading-relaxed">
              第一次玩广场，给你发了 3 件基础道具：
              《治水图》、一袋金子、一壶酒。
            </p>
          </div>
        )}

        {/* 剧本简介 */}
        <section className="mb-5">
          <p className="font-num text-mini text-amber-mid mb-1.5 tracking-[0.16em]">
            今天的故事
            {scenario.played_times > 0
              ? `· 第 ${scenario.played_times + 1} 次玩`
              : ''}
          </p>
          <h2 className="font-title text-h2 text-ink-1 mb-2">
            「{scenario.title}」
          </h2>
          <p className="font-title text-body text-ink-2 leading-[1.7]">
            {scenario.background}
          </p>
        </section>

        {/* 角色分配 */}
        <section className="mb-5">
          <p className="font-title text-mini text-ink-3 mb-2 tracking-[0.16em]">
            今天同台
          </p>
          <div className="flex flex-wrap gap-2">
            {roles.map((r) => (
              <span
                key={r.preset_id}
                className={clsx(
                  'rounded-full border-[1.2px] px-3 py-1 font-title text-small',
                  r.role === '丞相'
                    ? 'bg-amber-light/30 border-amber-DEFAULT text-amber-deep'
                    : 'bg-white border-[rgba(95,94,90,0.18)] text-ink-1',
                )}
              >
                {r.name}（{r.role}）
              </span>
            ))}
          </div>
        </section>

        {/* 道具选择 */}
        <section>
          <div className="flex items-baseline justify-between mb-2">
            <p className="font-title text-h3 text-ink-1">带 3 件道具</p>
            <span className="font-num text-mini text-ink-3">
              已选 {picked.length} / {REQUIRED_PICKS}
            </span>
          </div>
          <p className="font-title text-small text-ink-3 mb-3 leading-relaxed">
            {allEmpty
              ? '行囊还是空的——这是你第一次玩广场，刚才发的新手礼包够开个头。'
              : '剧本适配的道具会标"●"。可以混搭，看看不一样的结局。'}
          </p>

          <div className="flex flex-col gap-2">
            {items.map((item) => {
              const isApplicable = applicable_item_ids.includes(item.item_id);
              const isPicked = picked.includes(item.id);
              const disabled =
                !isPicked && picked.length >= REQUIRED_PICKS;
              return (
                <ItemPickRow
                  key={item.id}
                  item={item}
                  applicable={isApplicable}
                  picked={isPicked}
                  disabled={disabled}
                  onClick={() => togglePick(item.id)}
                />
              );
            })}
          </div>
        </section>
      </div>

      <div className="absolute bottom-0 left-0 right-0 px-5 pb-7 pt-3 bg-bg-base border-t border-[rgba(95,94,90,0.12)]">
        <Button
          size="lg"
          fullWidth
          onClick={onDepart}
          disabled={picked.length !== REQUIRED_PICKS}
        >
          {picked.length === REQUIRED_PICKS
            ? '出发 →'
            : `还差 ${REQUIRED_PICKS - picked.length} 件`}
        </Button>
      </div>
    </MobileShell>
  );
}

function ItemPickRow({
  item,
  applicable,
  picked,
  disabled,
  onClick,
}: {
  item: InventoryItemView;
  applicable: boolean;
  picked: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={picked}
      className={clsx(
        'text-left rounded-card border-[1.5px] px-3 py-2.5 active:scale-[0.99] cursor-pointer flex items-center gap-3',
        picked
          ? 'bg-amber-light/30 border-amber-DEFAULT'
          : applicable
            ? 'bg-white border-[rgba(186,117,23,0.4)]'
            : 'bg-white border-[rgba(95,94,90,0.18)]',
        disabled && !picked && 'opacity-40 cursor-not-allowed',
      )}
    >
      <span className="text-[22px] leading-none" aria-hidden>
        {item.icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-title text-body text-ink-1">
          {applicable && '● '}
          {item.name}
        </p>
        <p className="font-title text-mini text-ink-3 truncate">
          {item.description}
        </p>
      </div>
      {picked && (
        <span aria-hidden className="text-amber-DEFAULT font-bold">
          ✓
        </span>
      )}
    </button>
  );
}

export default function PlazaPreparePage() {
  return (
    <Suspense
      fallback={
        <MobileShell>
          <div className="min-h-dvh" />
        </MobileShell>
      }
    >
      <PlazaPrepareInner />
    </Suspense>
  );
}
