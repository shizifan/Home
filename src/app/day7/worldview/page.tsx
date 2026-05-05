/**
 * Day 7 · 它眼中的世界（PRD §7 + §15.6）
 *
 * 仪式动效（PRD §7.5 / §9.9）：
 *   - 第 1–4 项：每项浮入间隔 1.5 秒
 *   - 第 5 项「不知道的」：前停顿 2.5 秒，背景轻微闪烁后浮入
 *   - 第 6 项「差点忘了的」（如果有）：前停顿 2 秒，金色微光从左到右扫过
 *   - 全部展示后等待 3 秒，破壁文案淡入
 *
 * 失败处理：3 次重试都失败 → 不显示档案，引导稍后再来。
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { MobileShell } from '@/components/ui/MobileShell';
import { Button } from '@/components/ui/Button';
import {
  completeTask,
  Day7FailureError,
  generateWorldview,
  getCompanionState,
  type WorldviewData,
} from '@/lib/api/client';

const ITEMS_BASE = [
  { key: 'most_important_person', label: '最重要的人' },
  { key: 'most_fun_thing', label: '最好玩的事' },
  { key: 'most_delicious_thing', label: '最好吃的' },
  { key: 'most_scary_thing', label: '最害怕的' },
  { key: 'unknown_thing', label: '不知道的', accent: 'amber' as const },
] as const;

type Stage =
  | { kind: 'loading' }
  | { kind: 'opening' } // 伙伴开场白阶段
  | { kind: 'reveal'; visibleCount: number; showSixth: boolean; sixthRevealed: boolean }
  | { kind: 'breakwall'; showSixth: boolean }
  | { kind: 'final'; showSixth: boolean }
  | { kind: 'error'; message: string };

export default function WorldviewPage() {
  const router = useRouter();
  const [worldview, setWorldview] = useState<WorldviewData | null>(null);
  const [companionName, setCompanionName] = useState('伙伴');
  const [stage, setStage] = useState<Stage>({ kind: 'loading' });
  const timersRef = useRef<NodeJS.Timeout[]>([]);

  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  };

  useEffect(() => {
    let cancelled = false;
    Promise.all([generateWorldview(), getCompanionState()])
      .then(([res, state]) => {
        if (cancelled) return;
        setWorldview(res.worldview);
        setCompanionName(state.companion?.display_name ?? '伙伴');
        setStage({ kind: 'opening' });
      })
      .catch((e) => {
        if (cancelled) return;
        const msg =
          e instanceof Day7FailureError
            ? e.message
            : '我有点累了，等会儿再来吧。';
        setStage({ kind: 'error', message: msg });
      });
    return () => {
      cancelled = true;
      clearTimers();
    };
  }, []);

  // 开场白 → reveal 启动（点击或 6s 自动）
  useEffect(() => {
    if (stage.kind !== 'opening') return;
    const t = setTimeout(() => {
      startReveal();
    }, 6000);
    timersRef.current.push(t);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage.kind]);

  const startReveal = () => {
    if (!worldview) return;
    const showSixth = !!worldview.almost_forgot_thing;
    setStage({ kind: 'reveal', visibleCount: 0, showSixth, sixthRevealed: false });

    clearTimers();

    // 第 1–4 项：每项 1.5s 间隔（开始时刻）
    for (let i = 1; i <= 4; i++) {
      const delay = i * 1500;
      const t = setTimeout(() => {
        setStage((s) =>
          s.kind === 'reveal' ? { ...s, visibleCount: i } : s,
        );
      }, delay);
      timersRef.current.push(t);
    }

    // 第 5 项：前停顿 2.5s（即第 4 项之后再加 2.5s）
    const fifthDelay = 4 * 1500 + 2500;
    const t5 = setTimeout(() => {
      setStage((s) => (s.kind === 'reveal' ? { ...s, visibleCount: 5 } : s));
    }, fifthDelay);
    timersRef.current.push(t5);

    // 第 6 项（条件性）：第 5 项之后再 2s + 金色扫过
    let breakwallDelay = fifthDelay + 3000;
    if (showSixth) {
      const t6 = setTimeout(() => {
        setStage((s) =>
          s.kind === 'reveal' ? { ...s, sixthRevealed: true, visibleCount: 6 } : s,
        );
      }, fifthDelay + 2000);
      timersRef.current.push(t6);
      breakwallDelay = fifthDelay + 2000 + 3000;
    }

    // 全部展示后 3s → 破壁文案
    const tBw = setTimeout(() => {
      setStage({ kind: 'breakwall', showSixth });
      // P1 fix: 看完 5(+1) 项档案即视为 Day 7 任务完成
      completeTask({ task_id: 'day7_worldview' }).catch(() => {
        // 标记失败不阻塞档案展示
      });
    }, breakwallDelay);
    timersRef.current.push(tBw);

    // 破壁文案显示后 8s → 给"生成毕业卡"按钮（final）
    const tFinal = setTimeout(() => {
      setStage({ kind: 'final', showSixth });
    }, breakwallDelay + 6500);
    timersRef.current.push(tFinal);
  };

  // —— Render ——

  if (stage.kind === 'loading') {
    return (
      <MobileShell>
        <div className="min-h-dvh flex flex-col items-center justify-center px-8">
          <p className="font-title text-h3 text-ink-2">让 {companionName} 把这一周的事…</p>
          <p className="font-title text-h3 text-ink-2 mt-1">在心里再想一遍。</p>
          <span className="block mt-6 w-12 h-12 rounded-full border-[3px] border-amber-light border-t-transparent animate-spin" />
        </div>
      </MobileShell>
    );
  }

  if (stage.kind === 'error') {
    return (
      <MobileShell>
        <div className="min-h-dvh flex flex-col items-center justify-center px-8 text-center">
          <p className="font-title text-h2 text-ink-1 mb-3">— {companionName}</p>
          <p className="font-title text-body text-ink-2 leading-relaxed mb-8 max-w-[280px]">
            「{stage.message}」
          </p>
          <Link href="/home">
            <Button size="lg">回到小家</Button>
          </Link>
        </div>
      </MobileShell>
    );
  }

  if (!worldview) return null;

  return (
    <MobileShell>
      <div className="min-h-dvh flex flex-col px-5 pt-8 pb-8">
        {/* 顶部 — 伙伴开场白固定文案（PRD §11.3 Day 7）*/}
        <header className="mb-5">
          <p className="font-title text-mini text-ink-3 mb-1">— {companionName}</p>
          <p className="font-title text-body text-ink-1 leading-[1.7]">
            「我已经在小家住满 7 天了。这一周你告诉了我好多事，
            <br />
            我也整理了好多记忆——我想给你看看，我现在眼中的世界是什么样的。」
          </p>
        </header>

        {/* 档案卡 */}
        <div className="bg-white border-[1.2px] border-ink-2 rounded-card px-5 py-5 mb-6 flex-1">
          <div className="flex items-center gap-2 mb-4">
            <span className="font-title text-h2 text-ink-1">它眼中的世界</span>
            <span className="flex-1 h-px bg-[rgba(95,94,90,0.25)]" />
            <span className="font-num text-mini text-ink-3 tracking-[0.16em]">DAY 7</span>
          </div>

          {/* opening 阶段的思考占位 — 避免空白卡片像坏掉了 */}
          {stage.kind === 'opening' && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <span className="block w-9 h-9 rounded-full border-[2.5px] border-amber-light border-t-transparent animate-spin" />
              <p className="font-title text-small text-ink-3">
                它在心里想<span className="inline-block animate-pulse">…</span>
              </p>
            </div>
          )}

          {/* 第 1–4 项 */}
          {ITEMS_BASE.slice(0, 4).map((it, idx) => {
            const visible =
              (stage.kind === 'reveal' && stage.visibleCount > idx) ||
              stage.kind === 'breakwall' ||
              stage.kind === 'final';
            return (
              <DossierRow
                key={it.key}
                label={it.label}
                value={(worldview as unknown as Record<string, string | null>)[it.key] ?? '—'}
                visible={visible}
                accent="default"
              />
            );
          })}

          {/* 第 5 项（不知道的）*/}
          <DossierRow
            label={ITEMS_BASE[4].label}
            value={worldview.unknown_thing ?? '—'}
            visible={
              (stage.kind === 'reveal' && stage.visibleCount >= 5) ||
              stage.kind === 'breakwall' ||
              stage.kind === 'final'
            }
            accent="amber"
            flicker={stage.kind === 'reveal' && stage.visibleCount >= 5 && !stage.sixthRevealed}
          />

          {/* 第 6 项（仅当 almost_forgot_thing 非空）*/}
          {worldview.almost_forgot_thing && (
            <DossierRow
              label="差点忘了的"
              value={worldview.almost_forgot_thing}
              visible={
                (stage.kind === 'reveal' && stage.sixthRevealed) ||
                stage.kind === 'breakwall' ||
                stage.kind === 'final'
              }
              accent="gold"
            />
          )}
        </div>

        {/* 破壁文案 */}
        {(stage.kind === 'breakwall' || stage.kind === 'final') && (
          <BreakwallText hasSixth={stage.showSixth} />
        )}

        {/* 操作 */}
        {stage.kind === 'final' && (
          <div className="mt-6">
            <Button size="lg" fullWidth onClick={() => router.push('/day7/graduation')}>
              生成毕业卡 →
            </Button>
          </div>
        )}

        {stage.kind === 'reveal' && (
          <p className="font-title text-mini text-ink-3 text-center mt-4">
            （正在浮现…）
          </p>
        )}
      </div>
    </MobileShell>
  );
}

function DossierRow({
  label,
  value,
  visible,
  accent,
  flicker,
}: {
  label: string;
  value: string;
  visible: boolean;
  accent: 'default' | 'amber' | 'gold';
  flicker?: boolean;
}) {
  const baseRowCls = 'grid items-baseline gap-3 py-3 transition-all duration-700 ease-out';
  const containerStyle: React.CSSProperties = {
    gridTemplateColumns: '90px 1fr',
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateY(0)' : 'translateY(8px)',
  };

  let labelCls = 'font-title text-small text-ink-3';
  let valueCls = 'font-title text-body text-ink-1 leading-[1.5]';
  let extraStyle: React.CSSProperties = {};

  if (accent === 'amber') {
    labelCls = 'font-title text-small text-amber font-medium';
    valueCls = 'font-title text-body text-amber-deep leading-[1.5] font-medium';
    extraStyle = { background: 'rgba(186, 117, 23, 0.06)', padding: '8px 12px', borderRadius: 6 };
  }
  if (accent === 'gold') {
    labelCls = 'font-title text-small text-amber-mid font-medium relative';
    valueCls = 'font-title text-body text-amber-deep leading-[1.5] font-medium';
    extraStyle = {
      background: 'rgba(239, 159, 39, 0.18)',
      boxShadow: 'inset 0 0 0 1.5px #EF9F27',
      padding: '10px 14px 10px 28px',
      borderRadius: 6,
      position: 'relative',
    };
  }

  return (
    <div className={baseRowCls} style={{ ...containerStyle, ...extraStyle }}>
      {accent === 'gold' && (
        <span
          className="absolute"
          style={{ left: 8, top: 12, fontSize: 14 }}
          aria-hidden
        >
          ⭐
        </span>
      )}
      <div className={labelCls}>{label}</div>
      <div className={valueCls} style={flicker ? { animation: 'flicker 1.2s ease' } : {}}>
        {value}
      </div>
      <style>{`
        @keyframes flicker {
          0%, 100% { opacity: 1 }
          20% { opacity: 0.4 }
          40% { opacity: 1 }
          60% { opacity: 0.6 }
        }
      `}</style>
    </div>
  );
}

function BreakwallText({ hasSixth }: { hasSixth: boolean }) {
  // PRD §7.6 两个版本
  const text = hasSixth
    ? `你刚刚看到的"我眼中的世界"——
是用你这 7 天告诉我的所有内容拼出来的。
但你也教过我——什么应该记住，什么可以忘掉。

真实世界里所有的 AI 都是这样长大的。
它们不只是接收数据，它们也在被人不停地纠正。

你刚刚做的事，工程师每天都在做：
告诉 AI 什么是对的，什么是错的，什么是重要的，什么不是。
你已经做过一次了。`
    : `你刚刚看到的"我眼中的世界"——
是用你这 7 天告诉我的所有内容拼出来的。

你拍过的每张照片、你说过的每句话，
都变成了我对世界的理解。

真实世界里所有的 AI——你用过的 ChatGPT、豆包、Kimi——
都是这样长大的。
区别只是它们的"主人"不是你一个人，
是几十亿个写过文字、拍过照片的人。`;

  return (
    <div
      className="bg-ink-1/5 border-l-2 border-amber rounded-r-card px-4 py-4"
      style={{ animation: 'fadeIn 1.5s ease' }}
    >
      <pre className="font-title text-body text-ink-1 leading-[1.8] whitespace-pre-wrap break-words m-0">
        {text}
      </pre>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px) }
          to { opacity: 1; transform: translateY(0) }
        }
      `}</style>
    </div>
  );
}
