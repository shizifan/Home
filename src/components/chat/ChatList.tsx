/**
 * ChatList — 时间线渲染
 *   - 跨日插 DayBreak
 *   - 跨 30 分钟插时间戳
 *   - 同一伙伴连续多条只在最后一条显示名签
 *   - 拍照气泡点击触发 PhotoLightbox
 */

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { BubbleCompanion } from './BubbleCompanion';
import { BubbleChild } from './BubbleChild';
import { DayBreak } from './DayBreak';
import { PhotoLightbox } from './PhotoLightbox';
import { formatHHmm, shouldShowTimestamp } from './timeFormat';
import type { TimelineItem } from '@/lib/api/client';

interface Props {
  items: TimelineItem[];
  companionName: string;
}

export function ChatList({ items, companionName }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // 进入 / 数据变化 → 自动滚到底
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [items]);

  // 标记每个 companion 气泡是不是它那一组的尾部（用于显示名签）
  const groupTailFlags = useMemo(() => computeGroupTails(items), [items]);

  // 时间戳：跨 30 分钟显示一次
  const tsFlags = useMemo(() => computeTimestampFlags(items), [items]);

  if (items.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center px-8">
        <p className="font-title text-h3 text-ink-3 text-center leading-relaxed">
          你和{companionName}还没说过话呢。
          <br />
          回到小家说点什么吧。
        </p>
      </div>
    );
  }

  return (
    <>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
        {items.map((item, idx) => {
          const tsBefore = tsFlags[idx];
          return (
            <div key={`${item.kind}-${'id' in item ? item.id : idx}`}>
              {tsBefore && 'at' in item && (
                <div className="flex justify-center my-2">
                  <span className="font-num text-mini text-ink-3">
                    {formatHHmm(item.at)}
                  </span>
                </div>
              )}
              {renderItem(item, {
                companionName,
                isGroupTail: groupTailFlags[idx],
                onPhotoClick: (url) => setLightboxUrl(url),
              })}
            </div>
          );
        })}
        {/* 底部留白 */}
        <div className="h-2" />
      </div>
      {lightboxUrl && (
        <PhotoLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
      )}
    </>
  );
}

function renderItem(
  item: TimelineItem,
  ctx: {
    companionName: string;
    isGroupTail: boolean;
    onPhotoClick: (url: string) => void;
  },
) {
  if (item.kind === 'day_break')
    return <DayBreak day={item.day} title={item.title} />;
  if (item.kind === 'companion')
    return (
      <BubbleCompanion
        content={item.content}
        source={item.source}
        companionName={ctx.companionName}
        isGroupTail={ctx.isGroupTail}
      />
    );
  if (item.kind === 'child_photo')
    return (
      <BubbleChild
        kind="photo"
        photoUrl={item.photo_url}
        tags={item.tags}
        userText={item.user_text}
        onPhotoClick={() => ctx.onPhotoClick(item.photo_url)}
      />
    );
  if (item.kind === 'child_text')
    return <BubbleChild kind="text" text={item.text} />;
  if (item.kind === 'child_skip') return <BubbleChild kind="skip" />;
  return null;
}

/**
 * 标记每个 companion item 是不是"连续 companion 块"的最后一个 →
 * 用来决定是否显示伙伴名签。
 */
function computeGroupTails(items: TimelineItem[]): boolean[] {
  const out = items.map(() => false);
  for (let i = 0; i < items.length; i++) {
    if (items[i].kind !== 'companion') continue;
    const next = items[i + 1];
    if (!next || next.kind !== 'companion') {
      out[i] = true;
    }
  }
  return out;
}

/**
 * 标记每个有 `at` 的 item 是否要在它前面插入时间戳（跨 30 分钟）
 */
function computeTimestampFlags(items: TimelineItem[]): boolean[] {
  const out = items.map(() => false);
  let lastAt: string | null = null;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (!('at' in it)) continue; // day_break 不计
    if (shouldShowTimestamp(lastAt, it.at)) {
      out[i] = true;
    }
    lastAt = it.at;
  }
  return out;
}
