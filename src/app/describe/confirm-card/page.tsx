/**
 * /describe/confirm-card — 卡片确认页（V1.0 简化）
 *
 * V1.0 变更：
 *   - 移除双图选择器（单图模式）
 *   - 卡片右下角 ✏️ 标识在 CardConfirm 内部渲染
 *
 * 编排：
 *   1. CardConfirm 展示卡片 + 静态问句 + 两个按钮
 *   2. 点"就是这样"→ 并行启动 confirmDescribe + 入墙动画 600ms
 *   3. 两端都完成 → router.replace('/home')
 *
 * 5 分钟自动确认由 CardConfirm 组件内部处理。
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { MobileShell } from '@/components/ui/MobileShell';
import { CardConfirm } from '@/components/card/CardConfirm';
import { StickToWallTransition } from '@/components/card/StickToWallTransition';
import { useDescribeStore } from '@/stores/describeStore';
import { confirmDescribe, getCompanionState } from '@/lib/api/client';

export default function Page() {
  const router = useRouter();
  const {
    cardId,
    imageUrl,
    isFallbackTextCard,
    companionReply,
    finalText,
    reset,
  } = useDescribeStore();

  const [companionName, setCompanionName] = useState('伙伴');
  const [submitting, setSubmitting] = useState(false);
  /** 入墙动画期间被选中的图 */
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
  }, [cardId, router]);

  // 当动画 + API 都完成后 → 跳 home
  useEffect(() => {
    if (animationDone && apiDone) {
      reset();
      router.replace('/home');
    }
  }, [animationDone, apiDone, reset, router]);

  const handleConfirm = async ({
    autoTimeout,
  }: {
    autoTimeout?: boolean;
  }) => {
    if (!cardId || submitting) return;
    setSubmitting(true);

    const toStick = imageUrl;

    // fallback 卡片不放动画，直接结束
    if (isFallbackTextCard || !toStick) {
      try {
        await confirmDescribe({
          card_id: cardId,
          auto_timeout: autoTimeout,
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
