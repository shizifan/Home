/**
 * CardConfirm — 卡片确认页主体（V1.0 简化）
 *
 * 显示生成的卡片 + 静态问句 + 两个按钮：「不太对」/「就是这样」
 *
 * V1.0 变更：
 *   - 移除双图测试期选择器（单图模式）
 *   - 卡片右下角加 ✏️ 标识（暗示是描述生成的）
 *   - onConfirm 不再需要 chosenSource 参数
 *
 * 等待行为：
 *   - 30s 无操作：伙伴气泡「看起来对吗？告诉我一声。」
 *   - 90s 无操作：伙伴再说「不点没关系，我等你。」
 *   - 5min 无操作：自动调 onConfirm({autoTimeout: true})
 */

'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { FallbackTextCard } from './FallbackTextCard';

interface Props {
  imageUrl: string | null;
  isFallbackTextCard: boolean;
  /** 文字降级时使用的孩子原话 */
  fallbackDescription?: string;
  companionName: string;
  /** 提交确认 */
  onConfirm: (args: { autoTimeout?: boolean }) => void;
  /** 「不太对」点击 */
  onReject: () => void;
  /** 是否在确认中（按钮禁用）*/
  submitting?: boolean;
}

const ASKING_LINES = [
  '你说的地方大概是这样的，对吗？',
  '我画对了吗？',
  '看看像不像？',
];

const PROMPT_30S = '看起来对吗？告诉我一声。';
const PROMPT_90S = '不点没关系，我等你。';
const AUTO_CONFIRM_MS = 5 * 60 * 1000;
const PROMPT_30_MS = 30 * 1000;
const PROMPT_90_MS = 90 * 1000;

export function CardConfirm({
  imageUrl,
  isFallbackTextCard,
  fallbackDescription,
  companionName,
  onConfirm,
  onReject,
  submitting,
}: Props) {
  const [hint, setHint] = useState<string | null>(null);
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hint30Ref = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hint90Ref = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 每次 mount 随机问句
  const askingLine = useMemo(
    () => ASKING_LINES[Math.floor(Math.random() * ASKING_LINES.length)],
    [],
  );

  useEffect(() => {
    hint30Ref.current = setTimeout(() => setHint(PROMPT_30S), PROMPT_30_MS);
    hint90Ref.current = setTimeout(() => setHint(PROMPT_90S), PROMPT_90_MS);
    autoTimerRef.current = setTimeout(() => {
      if (!submitting) onConfirm({ autoTimeout: true });
    }, AUTO_CONFIRM_MS);
    return () => {
      if (hint30Ref.current) clearTimeout(hint30Ref.current);
      if (hint90Ref.current) clearTimeout(hint90Ref.current);
      if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-5 items-center" data-testid="card-confirm">
      {/* 卡片本身 */}
      <div className="flex justify-center pt-2 w-full">
        {isFallbackTextCard ? (
          <FallbackTextCard description={fallbackDescription ?? ''} large />
        ) : imageUrl ? (
          <CardImage url={imageUrl} large />
        ) : (
          <FallbackTextCard description={fallbackDescription ?? '（生成失败）'} large />
        )}
      </div>

      {/* 伙伴问句（静态变体）*/}
      <div className="bg-white border border-[#D3D1C7] rounded-[12px] px-4 py-3 w-full">
        <p className="font-title text-mini text-ink-3 mb-1">{companionName}：</p>
        <p className="font-title text-body text-ink-1 leading-[1.6]">「{askingLine}」</p>
      </div>

      {/* 等待提示（30s/90s 后出现）*/}
      {hint && (
        <p className="font-title text-mini text-ink-3 italic">{hint}</p>
      )}

      {/* 文字降级时显示安抚文案 */}
      {isFallbackTextCard && (
        <p className="font-title text-mini text-ink-3 text-center px-4">
          这次它脑子有点乱，画不出来。但你说的它都记住了。
        </p>
      )}

      {/* 两个按钮 */}
      <div className="flex gap-3 w-full">
        <Button
          variant="ghost"
          size="lg"
          fullWidth
          disabled={submitting || isFallbackTextCard}
          onClick={onReject}
        >
          不太对
        </Button>
        <Button
          variant="amber"
          size="lg"
          fullWidth
          disabled={submitting}
          onClick={() => onConfirm({})}
        >
          就是这样
        </Button>
      </div>
    </div>
  );
}

function CardImage({ url, large }: { url: string; large?: boolean }) {
  return (
    <figure className="flex flex-col items-center relative">
      <img
        src={url}
        alt="卡片"
        className={
          large
            ? 'w-[300px] h-[300px] rounded-[14px] object-cover bg-white shadow-paper border-[1.5px] border-[#D3D1C7]'
            : 'w-full aspect-square rounded-[12px] object-cover bg-white shadow-paper border-[1.5px] border-[#D3D1C7]'
        }
        style={large ? { transform: 'rotate(-2deg)' } : undefined}
      />
      {/* V1.0: 右下角 ✏️ 标识 — 暗示"是描述生成的" */}
      <span
        aria-hidden
        className="absolute bottom-1.5 right-1.5 text-[10px] leading-none opacity-60"
        title="这是我根据你的描述画的"
      >
        ✏️
      </span>
    </figure>
  );
}
