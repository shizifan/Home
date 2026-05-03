/**
 * CardConfirm — 卡片确认页主体（V0.6.1 §4.6）
 *
 * 显示生成的卡片 + 静态问句 + 两个按钮：「不太对」/「就是这样」
 *
 * 双图测试期：两张图都展示，孩子主动点选其中一张作为入墙图。
 *
 * 等待行为（决议 B3：默认实装 5 分钟自动确认）：
 *   - 30s 无操作：伙伴气泡「看起来对吗？告诉我一声。」
 *   - 90s 无操作：伙伴再说「不点没关系，我等你。」
 *   - 5min 无操作：自动调 onConfirm({autoTimeout: true, chosenSource: null})
 */

'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import clsx from 'clsx';
import { Button } from '@/components/ui/Button';
import { FallbackTextCard } from './FallbackTextCard';
import type { ImageGenSource } from '@/lib/api/client';

interface Props {
  imageUrl: string | null;
  imageSource?: ImageGenSource | null;
  altImageUrl?: string | null;
  altImageSource?: ImageGenSource | null;
  isFallbackTextCard: boolean;
  /** 文字降级时使用的孩子原话 */
  fallbackDescription?: string;
  companionName: string;
  /** 提交确认；chosenSource 仅在双图测试期有值 */
  onConfirm: (args: { autoTimeout?: boolean; chosenSource: ImageGenSource | null }) => void;
  /** 「不太对」点击 */
  onReject: () => void;
  /** 是否在确认中（按钮禁用）*/
  submitting?: boolean;
}

const SOURCE_LABEL: Record<ImageGenSource, string> = {
  dashscope: '通义万相',
  minimax: 'MiniMax',
};

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
  imageSource,
  altImageUrl,
  altImageSource,
  isFallbackTextCard,
  fallbackDescription,
  companionName,
  onConfirm,
  onReject,
  submitting,
}: Props) {
  const hasBoth = !!imageUrl && !!altImageUrl;
  const hasSingle = !!imageUrl && !altImageUrl;
  const [hint, setHint] = useState<string | null>(null);
  const [picked, setPicked] = useState<ImageGenSource | null>(null);
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
      if (!submitting) onConfirm({ autoTimeout: true, chosenSource: null });
    }, AUTO_CONFIRM_MS);
    return () => {
      if (hint30Ref.current) clearTimeout(hint30Ref.current);
      if (hint90Ref.current) clearTimeout(hint90Ref.current);
      if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
    };
    // 仅 mount 时启动一次定时器
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 双图情景下，必须选一张才允许"就是这样"
  const confirmDisabled = submitting || (hasBoth && !picked);
  // 单图直接传 imageSource；双图传 picked；fallback / 单图 alt 不传
  const confirmChosenSource: ImageGenSource | null = hasBoth
    ? picked
    : hasSingle
      ? (imageSource ?? null)
      : null;

  const confirmLabel = hasBoth && !picked ? '先点一张' : '就是这样';

  return (
    <div className="flex flex-col gap-5 items-center" data-testid="card-confirm">
      {/* 卡片本身 */}
      <div className="flex justify-center pt-2 w-full">
        {isFallbackTextCard ? (
          <FallbackTextCard description={fallbackDescription ?? ''} large />
        ) : hasBoth ? (
          <div className="grid grid-cols-2 gap-3 w-full">
            <SelectableCardImage
              url={imageUrl!}
              source={imageSource ?? null}
              picked={picked === imageSource}
              onPick={() => imageSource && setPicked(imageSource)}
            />
            <SelectableCardImage
              url={altImageUrl!}
              source={altImageSource ?? null}
              picked={picked === altImageSource}
              onPick={() => altImageSource && setPicked(altImageSource)}
            />
          </div>
        ) : hasSingle ? (
          <CardImage url={imageUrl!} source={imageSource ?? null} large />
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
          disabled={confirmDisabled}
          onClick={() => onConfirm({ chosenSource: confirmChosenSource })}
        >
          {confirmLabel}
        </Button>
      </div>
    </div>
  );
}

function CardImage({
  url,
  source,
  large,
}: {
  url: string;
  source: ImageGenSource | null;
  large?: boolean;
}) {
  return (
    <figure className="flex flex-col items-center">
      <img
        src={url}
        alt={source ? `${SOURCE_LABEL[source]} 生成` : '卡片'}
        className={
          large
            ? 'w-[300px] h-[300px] rounded-[14px] object-cover bg-white shadow-paper border-[1.5px] border-[#D3D1C7]'
            : 'w-full aspect-square rounded-[12px] object-cover bg-white shadow-paper border-[1.5px] border-[#D3D1C7]'
        }
        style={large ? { transform: 'rotate(-2deg)' } : undefined}
      />
      {source && (
        <figcaption className="font-num text-mini text-ink-3 mt-2 tracking-[0.06em]">
          {SOURCE_LABEL[source]}
        </figcaption>
      )}
    </figure>
  );
}

function SelectableCardImage({
  url,
  source,
  picked,
  onPick,
}: {
  url: string;
  source: ImageGenSource | null;
  picked: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      data-testid={`card-pick-${source ?? 'unknown'}`}
      className={clsx(
        'flex flex-col items-center cursor-pointer rounded-[12px] p-1 bg-transparent border-0 transition',
        picked && 'ring-2 ring-amber-deep ring-offset-2 ring-offset-bg-base',
      )}
    >
      <span className="relative block w-full">
        <img
          src={url}
          alt={source ? `${SOURCE_LABEL[source]} 生成` : '卡片'}
          className="w-full aspect-square rounded-[12px] object-cover bg-white shadow-paper border-[1.5px] border-[#D3D1C7]"
        />
        {picked && (
          <span
            aria-hidden
            className="absolute top-2 right-2 inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-deep text-bg-base font-title text-body shadow-md"
          >
            ✓
          </span>
        )}
      </span>
      {source && (
        <span
          className={clsx(
            'font-num text-mini mt-2 tracking-[0.06em]',
            picked ? 'text-amber-deep' : 'text-ink-3',
          )}
        >
          {SOURCE_LABEL[source]}
        </span>
      )}
    </button>
  );
}
