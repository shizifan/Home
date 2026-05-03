/**
 * GeneratingScreen — "伙伴在画" 等待画面（V0.6.1 §4.6.1）
 *
 * 纯展示组件：思考圈动画 + 滚动文案 + 错误态。
 * submit / revise 两条流程都用这个。
 */

'use client';

import { useEffect, useState } from 'react';
import { Companion } from '@/components/characters/Companion';
import { Button } from '@/components/ui/Button';
import type { CompanionPresetId } from '@/components/characters/types';

const HINTS_BY_TIME = [
  { at: 0, text: '让我想想你说的样子……' },
  { at: 3000, text: '我在用心画……' },
  { at: 6000, text: '快好了，再等等……' },
  { at: 12000, text: '马上就好……' },
];

interface Props {
  companionPreset: CompanionPresetId | null;
  /** 错误信息：非空时切到错误态 */
  error?: string | null;
  /** 错误态时的"返回修改"按钮（可选）*/
  onBack?: () => void;
  /** 错误态时的"回小家"按钮 */
  onHome?: () => void;
}

export function GeneratingScreen({ companionPreset, error, onBack, onHome }: Props) {
  const [hintIdx, setHintIdx] = useState(0);

  useEffect(() => {
    if (error) return;
    const timers = HINTS_BY_TIME.slice(1).map((h, i) =>
      setTimeout(() => setHintIdx(i + 1), h.at),
    );
    return () => timers.forEach(clearTimeout);
  }, [error]);

  const hint = HINTS_BY_TIME[hintIdx]?.text ?? '快好了……';

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-7 pt-6 pb-8 gap-6">
      {companionPreset && (
        <div className="relative">
          <Companion presetId={companionPreset} pose="sit" size={140} />
          <span className="absolute -top-2 -right-4 inline-block w-9 h-9 rounded-full border-[3px] border-amber-light border-t-transparent animate-spin" />
        </div>
      )}

      {error ? (
        <div className="text-center max-w-[320px]">
          <p className="font-title text-h3 text-ink-1 mb-2">出了点问题</p>
          <p className="font-title text-small text-ink-3 mb-4 leading-relaxed">{error}</p>
          <div className="flex gap-3 justify-center">
            {onBack && (
              <Button variant="ghost" onClick={onBack}>
                返回修改
              </Button>
            )}
            {onHome && <Button onClick={onHome}>回小家</Button>}
          </div>
        </div>
      ) : (
        <p className="font-title text-h3 text-ink-2 text-center" aria-live="polite">
          {hint}
        </p>
      )}
    </div>
  );
}
