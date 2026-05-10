/**
 * GeneratingScreen — "伙伴在画" 等待画面（V0.6.1 §4.6.1）
 *
 * 纯展示组件：思考圈动画 + 滚动文案 + 错误态。
 * submit / revise 两条流程都用这个。
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import { Companion } from '@/components/characters/Companion';
import { Button } from '@/components/ui/Button';
import type { CompanionPresetId } from '@/components/characters/types';
// 引 JSON 数据：companions.json 不带 'server-only'，可在 client 用
import companionsJson from '@prompts/shared/companions.json';

interface CompanionMetaLite {
  preset_id: string;
  wait_lines?: string[];
}
const COMPANIONS_LIST = (companionsJson as { companions: CompanionMetaLite[] }).companions;

const HINT_TIMES = [0, 3000, 6000, 12000];
// 通用回退（任何伙伴 wait_lines 缺失或不足）
const GENERIC_HINTS = [
  '让我想想你说的样子......',
  '我在用心画......',
  '快好了，再等等......',
  '马上就好......',
];

function pickWaitLine(presetId: CompanionPresetId | null, idx: number): string {
  if (!presetId) return GENERIC_HINTS[Math.min(idx, GENERIC_HINTS.length - 1)];
  const meta = COMPANIONS_LIST.find((c) => c.preset_id === presetId);
  const lines = meta?.wait_lines;
  if (!lines || lines.length === 0) {
    return GENERIC_HINTS[Math.min(idx, GENERIC_HINTS.length - 1)];
  }
  return lines[Math.min(idx, lines.length - 1)];
}

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
    const timers = HINT_TIMES.slice(1).map((at, i) =>
      setTimeout(() => setHintIdx(i + 1), at),
    );
    return () => timers.forEach(clearTimeout);
  }, [error]);

  const hint = useMemo(
    () => pickWaitLine(companionPreset, hintIdx),
    [companionPreset, hintIdx],
  );

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
