/**
 * CardViewModal — 点击墙上贴纸后的查看 / 删除浮层
 *
 * - 大图（fallback 时显示文字卡）
 * - Day 标 + 孩子当时说的原话
 * - [关闭] [删除] 两个按钮；点删除会再出一层确认
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { FallbackTextCard } from './FallbackTextCard';

export interface CardViewData {
  id: string;
  imageUrl: string | null;
  isFallbackTextCard: boolean;
  day: number;
  description: string;
}

interface Props {
  card: CardViewData;
  onClose: () => void;
  onDelete: (cardId: string) => Promise<void>;
}

export function CardViewModal({ card, onClose, onDelete }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    setError(null);
    try {
      await onDelete(card.id);
      onClose();
    } catch (e) {
      setError((e as Error)?.message ?? '删除失败');
      setDeleting(false);
      setConfirming(false);
    }
  };

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center px-6"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-black/45"
        onClick={!deleting && !confirming ? onClose : undefined}
        aria-hidden
      />

      <div className="relative w-full max-w-[360px] bg-bg-base rounded-[16px] border-[1.5px] border-ink-2 shadow-paper px-5 pt-4 pb-5">
        <div className="flex items-center justify-between mb-3">
          <span className="font-num text-mini text-ink-3 tracking-[0.16em]">
            DAY {card.day}
          </span>
          <button
            onClick={onClose}
            disabled={deleting}
            aria-label="关闭"
            className="bg-transparent border-0 cursor-pointer text-ink-3 font-title text-h3 leading-none px-2 disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        <div className="flex justify-center mb-4">
          {card.isFallbackTextCard || !card.imageUrl ? (
            <FallbackTextCard description={card.description || '（图未生成）'} large />
          ) : (
            <img
              src={card.imageUrl}
              alt="卡片"
              className="w-[280px] h-[280px] rounded-[12px] object-cover bg-white shadow-paper border-[1.5px] border-[#D3D1C7]"
              style={{ transform: 'rotate(-1.5deg)' }}
            />
          )}
        </div>

        {card.description && (
          <div className="bg-white border border-[#D3D1C7] rounded-[10px] px-3 py-3 mb-4 max-h-[140px] overflow-y-auto">
            <p className="font-title text-mini text-ink-3 mb-1">你说过：</p>
            <p className="font-title text-body text-ink-1 leading-[1.55] whitespace-pre-wrap">
              「{card.description}」
            </p>
          </div>
        )}

        {error && (
          <p className="font-title text-small text-[#E24B4A] mb-2 text-center">{error}</p>
        )}

        {confirming ? (
          <>
            <p className="font-title text-small text-ink-2 text-center mb-3 leading-relaxed">
              撕下来就放不回去了，确定吗？
            </p>
            <div className="flex gap-3">
              <Button
                variant="ghost"
                fullWidth
                disabled={deleting}
                onClick={() => setConfirming(false)}
              >
                再想想
              </Button>
              <Button
                fullWidth
                disabled={deleting}
                onClick={handleDelete}
                className="!bg-[#E24B4A] !text-white"
              >
                {deleting ? '撕中…' : '撕下来'}
              </Button>
            </div>
          </>
        ) : (
          <div className="flex gap-3">
            <Button variant="ghost" fullWidth onClick={() => setConfirming(true)}>
              撕下来
            </Button>
            <Button variant="amber" fullWidth onClick={onClose}>
              好
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
