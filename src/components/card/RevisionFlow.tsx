/**
 * RevisionFlow — 卡片修订流程（V0.6.1 §4.6.4）
 *
 * 步骤：
 *   1. 显示原卡片缩略 + 伙伴问"哪里不对？"
 *   2. 三个常见原因选项（颜色不对 / 缺了什么 / 整体不对）
 *   3. 选完后弹出语音录制（嵌入 VoiceRecorder）让孩子补充
 *   4. 孩子说完 → 提交 → 父级走 /api/describe/revise
 *
 * 简化策略：
 *   - 原因 + 语音补充必须都有（语音不能跳）
 *   - 不实装独立的"直接说" footer（孩子先选原因再说）
 *
 * 第 2 次 / 第 3 次重做后伙伴台词由父级控制。
 */

'use client';

import { useState } from 'react';
import clsx from 'clsx';
import { VoiceRecorder } from '@/components/voice/VoiceRecorder';
import { Button } from '@/components/ui/Button';

export type RevisionType = 'color' | 'missing' | 'complete_redo';

interface Props {
  /** 原卡片缩略图（缩到 40%）*/
  oldImageUrl: string | null;
  companionName: string;
  /** 当前修订次数（1=第1次，控制伙伴台词）*/
  attemptNumber: 1 | 2 | 3;
  onSubmit: (type: RevisionType, blob: Blob, durationMs: number) => Promise<void>;
  onPermissionDenied?: () => void;
}

const REVISION_OPTIONS: Array<{ type: RevisionType; label: string; bg: string }> = [
  { type: 'color', label: '颜色不对', bg: '#AFA9EC' },
  { type: 'missing', label: '缺了什么东西', bg: '#F0997B' },
  { type: 'complete_redo', label: '整体不对，重新来', bg: '#85B7EB' },
];

const ATTEMPT_LINES: Record<1 | 2 | 3, string> = {
  1: '哪里不对？告诉我，我重新画。',
  2: '我尽力了，再试一次。',
  3: '哪里不对？告诉我，我再试。',
};

export function RevisionFlow({
  oldImageUrl,
  companionName,
  attemptNumber,
  onSubmit,
  onPermissionDenied,
}: Props) {
  const [picked, setPicked] = useState<RevisionType | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleVoiceComplete = async (blob: Blob, durationMs: number) => {
    if (!picked || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(picked, blob, durationMs);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-5" data-testid="revision-flow">
      {/* 旧卡片缩略 */}
      <div className="flex justify-center">
        {oldImageUrl ? (
          <img
            src={oldImageUrl}
            alt="旧卡片"
            className="w-[120px] h-[120px] rounded-[10px] object-cover bg-white border border-[#D3D1C7] opacity-70"
            style={{ transform: 'rotate(-2deg)' }}
          />
        ) : (
          <div className="w-[120px] h-[120px] rounded-[10px] bg-white border border-[#D3D1C7] flex items-center justify-center text-ink-3 font-title text-mini">
            旧卡片
          </div>
        )}
      </div>

      {/* 伙伴问句 */}
      <div className="bg-white border border-[#D3D1C7] rounded-[12px] px-4 py-3">
        <p className="font-title text-mini text-ink-3 mb-1">{companionName}：</p>
        <p className="font-title text-body text-ink-1 leading-[1.6]">
          「{ATTEMPT_LINES[attemptNumber]}」
        </p>
      </div>

      {/* 三个原因选项 */}
      <div className="flex flex-col gap-2">
        <p className="font-title text-small text-ink-3">三个常见的问题：</p>
        {REVISION_OPTIONS.map((opt) => (
          <button
            key={opt.type}
            type="button"
            disabled={submitting}
            onClick={() => setPicked(opt.type)}
            className={clsx(
              'rounded-[8px] px-4 py-3 font-title text-body text-ink-1 text-left cursor-pointer transition border-[1.5px]',
              picked === opt.type
                ? 'border-ink-1 shadow-[0_2px_0_#5F5E5A]'
                : 'border-transparent',
            )}
            style={{ background: `${opt.bg}1F` }}  // 8% opacity
          >
            {picked === opt.type ? '☑ ' : '□ '}
            {opt.label}
          </button>
        ))}
      </div>

      {/* 选完原因后展示语音补充 */}
      {picked && (
        <div className="flex flex-col items-center gap-3 mt-2">
          <p className="font-title text-small text-ink-2">
            {picked === 'color' && '说一下应该是什么颜色：'}
            {picked === 'missing' && '说一下缺了什么：'}
            {picked === 'complete_redo' && '重新说一下你想要的样子：'}
          </p>
          <VoiceRecorder
            onComplete={handleVoiceComplete}
            onPermissionDenied={onPermissionDenied}
            disabled={submitting}
          />
          {submitting && (
            <p className="font-title text-mini text-ink-3 mt-2">{companionName}正在重画…</p>
          )}
        </div>
      )}

      {/* 没选原因时的引导 */}
      {!picked && (
        <Button variant="ghost" disabled fullWidth>
          先选一个原因
        </Button>
      )}
    </div>
  );
}
