/**
 * 广场剧本结局（PRD §14.8）
 *
 * 流程：
 *   1. 进页时如果 plaza_play 还未 finished → 调 finishPlazaPlay 触发 ending LLM + 奖励落库
 *   2. 显示 ending_narrative + 国王评价 + 获得道具列表（is_upgrade 特殊高亮）
 *   3. 底部"再玩一次 →"（回准备页）/ "回家 ↩"
 */

'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import { MobileShell } from '@/components/ui/MobileShell';
import { Button } from '@/components/ui/Button';
import { ScenarioIllustration } from '@/components/station/ScenarioIllustration';
import {
  finishPlazaPlay,
  getPlazaPlayState,
  type PlazaEndingResponse,
  type PlazaPlayStateResponse,
} from '@/lib/api/client';

type EndingType = 'perfect' | 'good' | 'barely';

const ENDING_LABELS: Record<EndingType, { title: string; tone: string }> = {
  perfect: { title: '圆满结局', tone: '#3B6D11' },
  good: { title: '基本成功', tone: '#854F0B' },
  barely: { title: '勉强解决', tone: '#5F5E5A' },
};

interface ViewState {
  state: PlazaPlayStateResponse;
  ending: PlazaEndingResponse;
}

export default function PlazaEndingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: playId } = use(params);
  const router = useRouter();
  const [view, setView] = useState<ViewState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const state = await getPlazaPlayState(playId);
        if (state.acts_done < 3 && !state.finished) {
          // 还没演完 → 跳回当前应该演的幕
          router.replace(
            `/station/plaza/play/${encodeURIComponent(playId)}/act/${state.acts_done + 1}`,
          );
          return;
        }
        // 触发 finish（已 finished 时也安全 — 服务端会 reconstruct 旧数据）
        const ending = await finishPlazaPlay(playId);
        if (cancelled) return;
        setView({ state, ending });
      } catch (e) {
        if (cancelled) return;
        setError((e as Error)?.message ?? 'unknown');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [playId, router]);

  if (error) {
    return (
      <MobileShell>
        <div className="min-h-dvh flex flex-col items-center justify-center gap-4 px-8">
          <p className="font-title text-body text-ink-2 text-center">
            它今天没演完......再来一次？
          </p>
          <Link href="/station">
            <Button>回驿站</Button>
          </Link>
        </div>
      </MobileShell>
    );
  }

  if (!view) {
    return (
      <MobileShell>
        <div className="min-h-dvh flex flex-col items-center justify-center gap-3">
          <span className="block w-12 h-12 rounded-full border-[3px] border-amber-light border-t-transparent animate-spin" />
          <p className="font-title text-body text-ink-2">故事正在收束......</p>
        </div>
      </MobileShell>
    );
  }

  const { state, ending } = view;
  const tag = ENDING_LABELS[ending.ending.ending_type];

  return (
    <MobileShell>
      <header className="px-5 pt-3 pb-2 flex items-center justify-between border-b border-[rgba(95,94,90,0.12)]">
        <Link href="/station" className="font-title text-small text-ink-3">
          ← 驿站
        </Link>
        <h1 className="font-title text-h3 text-ink-1">
          {state.scenario_title} · 结局
        </h1>
        <span aria-hidden className="w-12" />
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-5 pb-32">
        {/* 结局插画（用第 3 幕 emoji）*/}
        <ScenarioIllustration scenarioId={state.scenario_id} actNumber={3} />

        {/* 结局等级标签 */}
        <div className="flex items-center justify-center gap-2 mt-4 mb-3">
          <span
            className="font-title text-small px-3 py-1 rounded-full border-[1.5px]"
            style={{ borderColor: tag.tone, color: tag.tone }}
          >
            {tag.title}
          </span>
        </div>

        {/* 结局叙事 */}
        <article className="bg-white border-[1.2px] border-ink-2 rounded-card px-4 py-4 mb-4">
          <p className="font-title text-body text-ink-1 leading-[1.8] whitespace-pre-line">
            {ending.ending.ending_narrative}
          </p>
        </article>

        {/* 国王评价 */}
        {ending.ending.king_evaluation && (
          <div className="bg-amber-light/30 border-[1.5px] border-amber-DEFAULT rounded-card px-4 py-3 mb-5">
            <p className="font-num text-mini text-amber-mid mb-1 tracking-[0.16em]">
              国王说：
            </p>
            <p className="font-title text-h3 text-amber-deep leading-[1.6]">
              「{ending.ending.king_evaluation}」
            </p>
          </div>
        )}

        {/* 奖励道具 */}
        {ending.earned_items.length > 0 && (
          <section className="mb-3">
            <p className="font-num text-mini text-ink-3 mb-2 tracking-[0.16em]">
              小青龙带回了：
            </p>
            <div className="flex flex-col gap-2">
              {ending.earned_items.map((item) => (
                <div
                  key={item.item_id}
                  className={clsx(
                    'rounded-card border-[1.5px] px-4 py-3',
                    item.is_upgrade
                      ? 'bg-amber-light/40 border-amber-DEFAULT'
                      : 'bg-white border-[rgba(95,94,90,0.18)]',
                  )}
                >
                  <p className="font-title text-h3 text-ink-1">
                    {item.is_upgrade && '✨ 升级！'} 「{item.item_name}」
                    {item.is_new && (
                      <span className="font-title text-mini text-amber-mid ml-2">
                        新
                      </span>
                    )}
                  </p>
                  <p className="font-title text-small text-ink-2 mt-0.5 leading-relaxed">
                    {item.acquisition_reason}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {ending.source === 'fallback' && (
          <p className="font-title text-mini text-ink-3 text-center mt-3">
            （它今天有点累，故事讲得短了一些。）
          </p>
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 px-5 pb-7 pt-3 bg-bg-base border-t border-[rgba(95,94,90,0.12)]">
        <div className="flex gap-2">
          <Link href="/home" className="flex-1">
            <Button variant="ghost" size="lg" fullWidth>
              回小家 ↩
            </Button>
          </Link>
          <Link href="/station/plaza/prepare" className="flex-1">
            <Button size="lg" fullWidth>
              再玩一次 →
            </Button>
          </Link>
        </div>
      </div>
    </MobileShell>
  );
}
