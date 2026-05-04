/**
 * Day 7 世界观档案逐项展示动效组件
 *
 * PRD §9.5 / Plan_04 §1.4：
 *   - 第 1–4 项：每项间隔 1.5 秒，从下浮入
 *   - 第 5 项「不知道的」：前停顿 2.5 秒，背景轻微闪烁后浮入
 *   - 第 6 项「差点忘了的」（如果有）：前停顿 2 秒，金色微光
 *   - 全部展示后触发 onStageChange('allRevealed')
 */

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { WorldviewData } from '@/lib/api/client';

export type ArchiveStage = 'opening' | 'revealing' | 'allRevealed';

interface ArchiveRevealProps {
  worldview: WorldviewData;
  companionName: string;
  skipCount?: number;
  onStageChange?: (stage: ArchiveStage) => void;
}

export default function ArchiveReveal({
  worldview,
  companionName,
  skipCount = 0,
  onStageChange,
}: ArchiveRevealProps) {
  const timersRef = useRef<NodeJS.Timeout[]>([]);
  const [visibleCount, setVisibleCount] = useState(0);
  const [sixthRevealed, setSixthRevealed] = useState(false);
  const [started, setStarted] = useState(false);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  const startReveal = useCallback(() => {
    if (started) return;
    setStarted(true);
    clearTimers();

    const showSixth = !!worldview.almost_forgot_thing;
    const isSparse = skipCount >= 6;

    // 第 1–4 项：每项 1.5s 间隔
    for (let i = 1; i <= 4; i++) {
      const delay = i * 1500;
      const t = setTimeout(() => setVisibleCount(i), delay);
      timersRef.current.push(t);
    }

    // 第 5 项：前停顿 2.5s（第 4 项之后）
    const fifthDelay = 4 * 1500 + 2500;
    const t5 = setTimeout(() => setVisibleCount(5), fifthDelay);
    timersRef.current.push(t5);

    // 第 6 项（条件性）：第 5 项之后再 2s
    let allDoneDelay = fifthDelay + 3000;
    if (showSixth && !isSparse) {
      const t6 = setTimeout(() => {
        setSixthRevealed(true);
        setVisibleCount(6);
      }, fifthDelay + 2000);
      timersRef.current.push(t6);
      allDoneDelay = fifthDelay + 2000 + 3000;
    }

    // 全部展示后通知父组件
    const tDone = setTimeout(() => {
      onStageChange?.('allRevealed');
    }, allDoneDelay);
    timersRef.current.push(tDone);
  }, [started, worldview.almost_forgot_thing, skipCount, clearTimers, onStageChange]);

  // 6s 自动开始
  useEffect(() => {
    const t = setTimeout(startReveal, 6000);
    timersRef.current.push(t);
    return clearTimers;
  }, [startReveal, clearTimers]);

  const showSixth = !!worldview.almost_forgot_thing;
  const isSparse = skipCount >= 6;

  return (
    <div className="bg-white border-[1.2px] border-ink-2 rounded-card px-5 py-5 mb-6 flex-1">
      <div className="flex items-center gap-2 mb-4">
        <span className="font-title text-h2 text-ink-1">它眼中的世界</span>
        <span className="flex-1 h-px bg-[rgba(95,94,90,0.25)]" />
        <span className="font-num text-mini text-ink-3 tracking-[0.16em]">DAY 7</span>
      </div>

      {/* 思考占位 */}
      {!started && (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <span className="block w-9 h-9 rounded-full border-[2.5px] border-amber-light border-t-transparent animate-spin" />
          <p className="font-title text-small text-ink-3">
            它在心里想<span className="inline-block animate-pulse">…</span>
          </p>
        </div>
      )}

      {/* 第 1–4 项 */}
      {ITEMS_BASE.slice(0, 4).map((it, idx) => (
        <DossierRow
          key={it.key}
          label={it.label}
          value={(worldview as unknown as Record<string, string | null>)[it.key] ?? '—'}
          visible={visibleCount > idx}
          accent="default"
        />
      ))}

      {/* 第 5 项（不知道的）*/}
      <DossierRow
        label={ITEMS_BASE[4].label}
        value={
          isSparse
            ? '其实……我对你的事知道得不太多。这是你给我的全部。'
            : (worldview.unknown_thing ?? '—')
        }
        visible={visibleCount >= 5}
        accent="amber"
        flicker={visibleCount >= 5 && !sixthRevealed && !isSparse}
      />

      {/* 第 6 项（仅当 almost_forgot_thing 非空 且非 sparse 模式）*/}
      {showSixth && !isSparse && (
        <DossierRow
          label="差点忘了的"
          value={worldview.almost_forgot_thing!}
          visible={sixthRevealed}
          accent="gold"
        />
      )}

      {started && visibleCount < (showSixth && !isSparse ? 6 : 5) && (
        <p className="font-title text-mini text-ink-3 text-center mt-4">
          （正在浮现…）
        </p>
      )}
    </div>
  );
}

const ITEMS_BASE = [
  { key: 'most_important_person', label: '最重要的人' },
  { key: 'most_fun_thing', label: '最好玩的事' },
  { key: 'most_delicious_thing', label: '最好吃的' },
  { key: 'most_scary_thing', label: '最害怕的' },
  { key: 'unknown_thing', label: '不知道的', accent: 'amber' as const },
] as const;

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
  const containerStyle: React.CSSProperties = {
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateY(0)' : 'translateY(8px)',
  };

  let extraStyle: React.CSSProperties = {};
  let labelCls = 'font-title text-small text-ink-3';
  let valueCls = 'font-title text-body text-ink-1 leading-[1.5]';

  if (accent === 'amber') {
    labelCls = 'font-title text-small text-amber font-medium';
    valueCls = 'font-title text-body text-amber-deep leading-[1.5] font-medium';
    extraStyle = { background: 'rgba(186, 117, 23, 0.06)', padding: '8px 12px', borderRadius: 6 };
  }
  if (accent === 'gold') {
    labelCls = 'font-title text-small text-amber-mid font-medium';
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
    <div
      className="grid items-baseline gap-3 py-3 transition-all duration-700 ease-out"
      style={{ gridTemplateColumns: '90px 1fr', ...containerStyle, ...extraStyle }}
    >
      {accent === 'gold' && (
        <span className="absolute" style={{ left: 8, top: 12, fontSize: 14 }} aria-hidden>
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
