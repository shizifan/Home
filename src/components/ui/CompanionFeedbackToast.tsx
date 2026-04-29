/**
 * 伙伴反馈 Toast — 纠正动作完成后从底部浮出展示伙伴台词
 * 自动 3.5 秒后消失，可点击立即关闭。
 */

'use client';

import { useEffect } from 'react';

export function CompanionFeedbackToast({
  text,
  companionName,
  onClose,
  durationMs = 3500,
}: {
  text: string;
  companionName: string;
  onClose: () => void;
  durationMs?: number;
}) {
  useEffect(() => {
    const t = setTimeout(onClose, durationMs);
    return () => clearTimeout(t);
  }, [onClose, durationMs]);

  return (
    <div className="absolute left-0 right-0 bottom-[88px] z-50 px-5 pointer-events-none">
      <button
        onClick={onClose}
        className="block mx-auto bg-white border-[1.2px] border-ink-2 rounded-[14px] px-4 py-3 shadow-paper pointer-events-auto cursor-pointer text-left max-w-[320px] w-full"
        style={{ animation: 'slideUp 0.3s ease' }}
        aria-label="收起反馈"
      >
        <p className="font-title text-mini text-ink-3 mb-1">— {companionName}</p>
        <p className="font-title text-body text-ink-1 leading-[1.5]">「{text}」</p>
      </button>
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
