/**
 * ChatOverlay — 半屏聊天历史弹层
 * 触发：主页对话气泡点击 → useUIStore.openOverlay('chat')
 * 高度：88% 视口（PRD 默认）
 * 关闭：手柄 / 遮罩 / Esc
 */

'use client';

import { useEffect, useState } from 'react';
import { ChatList } from './ChatList';
import { getTimeline, type TimelineResponse } from '@/lib/api/client';

interface Props {
  onClose: () => void;
}

export function ChatOverlay({ onClose }: Props) {
  const [data, setData] = useState<TimelineResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    getTimeline()
      .then(setData)
      .catch((e) => setError((e as Error)?.message ?? '加载失败'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="absolute inset-0 z-40">
      {/* 遮罩 */}
      <div
        className="absolute inset-0 bg-black/35"
        onClick={onClose}
        aria-hidden
      />

      {/* sheet */}
      <div
        className="absolute left-0 right-0 bottom-0 bg-bg-base rounded-t-sheet shadow-sheet flex flex-col overflow-hidden"
        style={{ height: '88dvh' }}
        role="dialog"
        aria-label="对话历史"
      >
        {/* 关闭手柄 */}
        <div className="flex justify-center pt-2.5 pb-1.5 shrink-0">
          <button
            onClick={onClose}
            className="bg-transparent border-0 p-2 cursor-pointer"
            aria-label="关闭"
          >
            <span className="block w-11 h-[5px] bg-[rgba(95,94,90,0.35)] rounded-full" />
          </button>
        </div>

        {/* 标题 */}
        <header className="px-5 pb-3 shrink-0 border-b border-[rgba(95,94,90,0.12)]">
          <h2 className="font-title text-h2 text-ink-1">
            和{data?.companion_display_name ?? '它'}的对话
          </h2>
        </header>

        {/* body */}
        {loading && (
          <div className="flex-1 flex items-center justify-center">
            <p className="font-title text-h3 text-ink-3">整理对话…</p>
          </div>
        )}
        {error && !loading && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <p className="font-title text-body text-ink-2">暂时拉不到对话历史</p>
            <button
              onClick={load}
              className="font-title text-small text-amber underline cursor-pointer bg-transparent border-0"
            >
              再试一次
            </button>
          </div>
        )}
        {!loading && !error && data && (
          <ChatList
            items={data.items}
            companionName={data.companion_display_name}
          />
        )}
      </div>
    </div>
  );
}
