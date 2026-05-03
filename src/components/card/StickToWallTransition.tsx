/**
 * StickToWallTransition — 「贴到墙上」入墙动画（PRD §4.6.3）
 *
 * 600ms 总时长：
 *   0–100ms：背景内容淡出
 *   100–600ms：被选中的卡片从屏幕中央 transform 到顶部偏左 + 缩到约 30%
 *   400–600ms：伙伴气泡浮出（确认台词）
 *
 * D2 决议：目标位置先硬编码常量。后续根据 home 真实墙面位置反推。
 */

'use client';

import { useEffect, useState } from 'react';

interface Props {
  imageUrl: string;
  companionName: string;
  /** 伙伴入墙确认台词（来自 Pass2 reply）*/
  companionLine: string;
  /** 动画播完触发；外部据此决定是否真正跳页 */
  onDone: () => void;
}

const TOTAL_MS = 600;
const BUBBLE_DELAY_MS = 400;

export function StickToWallTransition({
  imageUrl,
  companionName,
  companionLine,
  onDone,
}: Props) {
  const [phase, setPhase] = useState<'pre' | 'flying' | 'done'>('pre');
  const [bubble, setBubble] = useState(false);

  useEffect(() => {
    // next tick 触发 transform 起飞，让浏览器先 commit "起始" transform
    const t0 = requestAnimationFrame(() => setPhase('flying'));
    const t1 = setTimeout(() => setBubble(true), BUBBLE_DELAY_MS);
    const t2 = setTimeout(() => {
      setPhase('done');
      onDone();
    }, TOTAL_MS);
    return () => {
      cancelAnimationFrame(t0);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [onDone]);

  // 起始：屏幕中央偏上、原大小、轻微倾斜
  // 终态：右上角壁纸位（按 mobile 360x dvh 估算），缩到 28%、再倾斜一点
  const transform =
    phase === 'pre'
      ? 'translate(-50%, -50%) rotate(-2deg) scale(1)'
      : 'translate(-50%, -50%) translate(-26vw, -28vh) rotate(-6deg) scale(0.28)';

  return (
    <div
      data-testid="stick-to-wall"
      className="fixed inset-0 z-50 pointer-events-none"
      aria-hidden
    >
      {/* 背景遮罩淡出 */}
      <div
        className="absolute inset-0 bg-bg-base transition-opacity duration-[100ms]"
        style={{ opacity: phase === 'pre' ? 0 : 0.92 }}
      />

      {/* 飞行的卡片 */}
      <img
        src={imageUrl}
        alt=""
        className="absolute top-1/2 left-1/2 w-[300px] h-[300px] rounded-[14px] object-cover bg-white shadow-paper border-[1.5px] border-[#D3D1C7]"
        style={{
          transform,
          transition: `transform ${TOTAL_MS - 100}ms cubic-bezier(0.5, 0.05, 0.4, 1)`,
          transitionDelay: '60ms',
          willChange: 'transform',
        }}
      />

      {/* 伙伴气泡 */}
      {bubble && companionLine && (
        <div
          className="absolute left-1/2 bottom-[28vh] -translate-x-1/2 max-w-[320px] px-5"
          style={{
            opacity: 0,
            animation: 'stick-bubble-in 200ms ease-out forwards',
          }}
        >
          <div className="bg-white border border-[#D3D1C7] rounded-[14px] px-4 py-3 shadow-paper">
            <p className="font-title text-mini text-ink-3 mb-1">{companionName}：</p>
            <p className="font-title text-body text-ink-1 leading-[1.5]">「{companionLine}」</p>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes stick-bubble-in {
          from { opacity: 0; transform: translate(-50%, 8px); }
          to   { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>
    </div>
  );
}
