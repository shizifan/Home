/**
 * 伙伴对话气泡（PRD 设计推断：尖角矩形 + 1.2px 描边，与纸片描边语言一致）
 * 来源：design/Home Visual Design.html RationaleCard。
 *
 * P2-Chat：onTap 可选；指定后整气泡变可点（tabIndex + role=button + active 反馈）。
 */

import clsx from 'clsx';
import type { KeyboardEvent } from 'react';

interface Props {
  text: string;
  by?: string;
  /** 显示三角小尾巴的位置 */
  tail?: 'top-left' | 'top-center' | 'none';
  /** 点击展开聊天历史 */
  onTap?: () => void;
}

export function SpeechBubble({ text, by, tail = 'top-left', onTap }: Props) {
  const tappable = !!onTap;

  const handleKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!onTap) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onTap();
    }
  };

  return (
    <div className="relative mx-5 mb-3">
      <div
        onClick={onTap}
        onKeyDown={handleKey}
        role={tappable ? 'button' : undefined}
        tabIndex={tappable ? 0 : undefined}
        aria-label={tappable ? '查看对话历史' : undefined}
        className={clsx(
          'bg-white border-[1.2px] border-ink-2 rounded-[14px] px-[18px] py-3.5',
          tappable && 'cursor-pointer transition active:scale-[0.99] active:bg-[#FFF8EA]',
        )}
      >
        <p className="font-title text-body text-ink-1 leading-[1.5]">{text}</p>
        {by && <p className="font-title text-mini text-ink-3 mt-1.5">— {by}</p>}
      </div>
      {tail === 'top-left' && (
        <svg
          width="20"
          height="14"
          className="absolute -top-[10px] left-7 pointer-events-none"
          aria-hidden
        >
          <path d="M0 14 L10 0 L20 14 Z" fill="#FFFFFF" stroke="#5F5E5A" strokeWidth="1.2" />
          <path d="M2 14 L18 14" stroke="#FFFFFF" strokeWidth="2" />
        </svg>
      )}
    </div>
  );
}
