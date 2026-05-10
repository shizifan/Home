/**
 * /describe/confirm-card — 卡片确认页（V0.6.1 §4.6.2-3）
 *
 * 编排：
 *   1. CardConfirm 展示卡片 + 静态问句 + 选图（双图）+ 两个按钮
 *   2. 点"就是这样"→ 并行启动 confirmDescribe + 入墙动画 600ms
 *   3. 两端都完成 → router.replace('/home')
 *
 * 5 分钟自动确认（决议 B3）由 CardConfirm 组件内部处理。
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { MobileShell } from '@/components/ui/MobileShell';
import { CardConfirm } from '@/components/card/CardConfirm';
import { StickToWallTransition } from '@/components/card/StickToWallTransition';
import { useDescribeStore } from '@/stores/describeStore';
import {
  confirmDescribe,
  getCompanionState,
  reportTelemetry,
} from '@/lib/api/client';
import type { ImageGenSource } from '@/lib/api/client';

export default function Page() {
  const router = useRouter();
  const {
    cardId,
    imageUrl,
    imageSource,
    altImageUrl,
    altImageSource,
    isFallbackTextCard,
    companionReply,
    finalText,
    startedAtMs,
    inputMethod,
    reset,
  } = useDescribeStore();

  const [companionName, setCompanionName] = useState('伙伴');
  const [submitting, setSubmitting] = useState(false);
  /** 入墙动画期间被选中的图（双图情境下）*/
  const [stickingImage, setStickingImage] = useState<string | null>(null);
  const [animationDone, setAnimationDone] = useState(false);
  const [apiDone, setApiDone] = useState(false);

  useEffect(() => {
    if (!cardId) {
      router.replace('/home');
      return;
    }
    (async () => {
      const s = await getCompanionState();
      if (s.companion) setCompanionName(s.companion.display_name);
    })();

    // P7 §28.4 端到端时长埋点：从 startTask → 看到卡片确认页
    if (startedAtMs !== null) {
      const ms = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAtMs;
      reportTelemetry(
        'describe_first_card',
        ms,
        `describe/${inputMethod}`,
      );
    }
  }, [cardId, router, startedAtMs, inputMethod]);

  // 当动画 + API 都完成后 → 跳 home
  useEffect(() => {
    if (animationDone && apiDone) {
      // P7 §28.4 端到端总时长（从 startTask 到孩子点 "就是这样" 完成）
      if (startedAtMs !== null) {
        const ms = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAtMs;
        reportTelemetry('describe_e2e', ms, `describe/${inputMethod}`);
      }
      reset();
      router.replace('/home');
    }
  }, [animationDone, apiDone, reset, router, startedAtMs, inputMethod]);

  const handleConfirm = async ({
    autoTimeout,
    chosenSource,
  }: {
    autoTimeout?: boolean;
    chosenSource: ImageGenSource | null;
  }) => {
    if (!cardId || submitting) return;
    setSubmitting(true);

    // 选定的入墙图：用户选了的、或者已有的 image_url、或者 alt_image_url
    let toStick: string | null = null;
    if (chosenSource === imageSource) toStick = imageUrl;
    else if (chosenSource === altImageSource) toStick = altImageUrl;
    else toStick = imageUrl ?? altImageUrl ?? null;

    // fallback 卡片不放动画，直接结束
    if (isFallbackTextCard || !toStick) {
      try {
        await confirmDescribe({
          card_id: cardId,
          auto_timeout: autoTimeout,
          chosen_source: chosenSource ?? undefined,
        });
        reset();
        router.replace('/home');
      } catch (e) {
        console.error(e);
        setSubmitting(false);
      }
      return;
    }

    // 触发动画 + 后端并行
    setStickingImage(toStick);

    void (async () => {
      try {
        await confirmDescribe({
          card_id: cardId,
          auto_timeout: autoTimeout,
          chosen_source: chosenSource ?? undefined,
        });
      } catch (e) {
        console.error(e);
      } finally {
        setApiDone(true);
      }
    })();
  };

  const handleReject = () => {
    router.push('/describe/revise');
  };

  if (!cardId) return null;

  return (
    <MobileShell showStatusBar={false}>
      <div className="min-h-dvh flex flex-col px-7 pt-6 pb-8">
        <button
          onClick={() => {
            reset();
            router.push('/home');
          }}
          className="self-start font-title text-small text-ink-3 cursor-pointer bg-transparent border-0"
        >
          ← 返回
        </button>

        <div className="mt-4 flex-1">
          <CardConfirm
            imageUrl={imageUrl}
            imageSource={imageSource}
            altImageUrl={altImageUrl}
            altImageSource={altImageSource}
            isFallbackTextCard={isFallbackTextCard}
            fallbackDescription={finalText}
            companionName={companionName}
            onConfirm={handleConfirm}
            onReject={handleReject}
            submitting={submitting}
          />
        </div>
      </div>

      {stickingImage && (
        <StickToWallTransition
          imageUrl={stickingImage}
          companionName={companionName}
          companionLine={companionReply}
          onDone={() => setAnimationDone(true)}
        />
      )}
    </MobileShell>
  );
}
