/**
 * 孩子气泡（右侧）
 * 4 个子类：
 *   - photo：80×80 缩略图 + ≤3 个 vision tag chip + 可选 user_text
 *   - text：纯文字（>3 行折叠）
 *   - skip：灰色斜体 "（今天先过）"
 */

'use client';

import { useState } from 'react';
import clsx from 'clsx';

interface PhotoBubbleProps {
  kind: 'photo';
  photoUrl: string;
  tags?: string[];
  userText?: string;
  onPhotoClick?: () => void;
}

interface TextBubbleProps {
  kind: 'text';
  text: string;
}

interface SkipBubbleProps {
  kind: 'skip';
}

type Props = PhotoBubbleProps | TextBubbleProps | SkipBubbleProps;

export function BubbleChild(props: Props) {
  if (props.kind === 'skip') return <SkipBubble />;
  if (props.kind === 'photo') return <PhotoBubble {...props} />;
  return <TextBubble {...props} />;
}

function SkipBubble() {
  return (
    <div className="flex justify-end mb-1.5">
      <span className="font-title text-small italic text-ink-3 px-3 py-1">
        （今天先过）
      </span>
    </div>
  );
}

function TextBubble({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  // 简易判断：超过 60 字或包含 ≥3 个换行就允许折叠
  const lines = text.split('\n');
  const isLong = text.length > 60 || lines.length > 3;
  const display = !expanded && isLong ? clip(text, 60) : text;

  return (
    <div className="flex justify-end max-w-[78%] mb-1.5 ml-auto">
      <div className="bg-amber-light rounded-2xl rounded-tr-md px-4 py-2.5 border border-[#A8773D]">
        <p className="font-title text-body text-amber-deep leading-[1.55] whitespace-pre-wrap break-words">
          {display}
          {!expanded && isLong && '…'}
        </p>
        {isLong && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="font-title text-mini text-amber underline mt-1 cursor-pointer bg-transparent border-0 p-0"
          >
            {expanded ? '收起' : '展开'}
          </button>
        )}
      </div>
    </div>
  );
}

function PhotoBubble({ photoUrl, tags, userText, onPhotoClick }: PhotoBubbleProps) {
  return (
    <div className="flex justify-end max-w-[78%] mb-1.5 ml-auto">
      <div
        className={clsx(
          'bg-amber-light rounded-2xl rounded-tr-md p-2 border border-[#A8773D]',
          'flex flex-col items-end gap-1.5',
        )}
      >
        <button
          onClick={onPhotoClick}
          className="block bg-transparent border-0 p-0 cursor-pointer"
          aria-label="查看大图"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoUrl}
            alt="拍的照片"
            loading="lazy"
            className="w-20 h-20 rounded-md object-cover bg-white/30"
          />
        </button>
        {tags && tags.length > 0 && (
          <div className="flex flex-wrap gap-1 justify-end max-w-[80px]">
            {tags.slice(0, 3).map((t) => (
              <span
                key={t}
                className="font-title text-[10px] bg-white text-ink-2 rounded-full px-1.5 py-0.5 border border-[rgba(95,94,90,0.2)] leading-tight"
              >
                {t}
              </span>
            ))}
          </div>
        )}
        {userText && (
          <p className="font-title text-small text-amber-deep leading-tight max-w-[180px] text-right">
            {userText}
          </p>
        )}
      </div>
    </div>
  );
}

function clip(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max);
}
