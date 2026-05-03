/**
 * ChatOverlay — 半屏聊天 + 开放问答
 * 触发：主页对话气泡点击 → useUIStore.openOverlay('chat')
 * 高度：88% 视口（PRD 默认）
 *
 * 行为：
 *   - 初始拉 timeline
 *   - 输入框 Free Chat 提问 → POST /api/chat/ask
 *   - 乐观 UI：发送时把 child 气泡先插入；拿到回复再插 companion
 *   - 失败：保留乐观 child 气泡 + 红色错误原文 + 再试一次
 *   - 成功后静默 refresh timeline，把乐观气泡换成真实记录
 */

'use client';

import { useEffect, useState } from 'react';
import { ChatList } from './ChatList';
import { ChatComposer } from './ChatComposer';
import {
  askChat,
  getTimeline,
  type TimelineItem,
  type TimelineResponse,
} from '@/lib/api/client';

interface Props {
  onClose: () => void;
}

interface OptimisticChild {
  kind: 'child_text';
  id: string;
  text: string;
  day: number;
  at: string;
  /** 仅前端用：失败状态 + 原始错误（用来重试 / 展示） */
  _failed?: { error: string; question: string };
}

interface OptimisticCompanion {
  kind: 'companion';
  id: string;
  content: string;
  source: string;
  day: number;
  at: string;
}

type OptimisticItem = OptimisticChild | OptimisticCompanion;

export function ChatOverlay({ onClose }: Props) {
  const [data, setData] = useState<TimelineResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [optimistic, setOptimistic] = useState<OptimisticItem[]>([]);

  const load = (silent = false) => {
    if (!silent) setLoading(true);
    if (!silent) setLoadError(null);
    return getTimeline()
      .then((t) => {
        setData(t);
        // 拉到真值后清掉**已成功**的乐观气泡（保留失败的让用户看到）
        setOptimistic((prev) => prev.filter((o) => 'kind' in o && o.kind === 'child_text' && (o as OptimisticChild)._failed));
      })
      .catch((e) => {
        if (!silent) setLoadError((e as Error)?.message ?? '加载失败');
      })
      .finally(() => {
        if (!silent) setLoading(false);
      });
  };

  useEffect(() => {
    void load(false);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const today = (() => {
    // 给乐观气泡推断一个 day。优先用 timeline 最后一项的 day；否则 1。
    const items = data?.items ?? [];
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      if ('day' in it && typeof it.day === 'number') return it.day;
    }
    return 1;
  })();

  const handleSend = async (question: string, retryOfId?: string) => {
    if (pending) return;
    const childId = retryOfId ?? `pending-${Date.now()}`;
    const at = new Date().toISOString();

    // 1. 乐观插入 child 气泡（重试时复用原 id 避免列表抖动）
    setOptimistic((prev) => {
      const without = retryOfId ? prev.filter((p) => p.id !== retryOfId) : prev;
      return [
        ...without,
        {
          kind: 'child_text',
          id: childId,
          text: question,
          day: today,
          at,
        } as OptimisticChild,
      ];
    });
    setPending(true);

    try {
      const res = await askChat(question);
      // 2. 成功 → 把伙伴回复也插入乐观列表，立即可见
      setOptimistic((prev) => [
        ...prev,
        {
          kind: 'companion',
          id: `pending-r-${Date.now()}`,
          content: res.reply,
          source: res.source,
          day: today,
          at: new Date().toISOString(),
        } as OptimisticCompanion,
      ]);
      // 3. 静默刷新拿真实 id；成功的乐观气泡会在 load() 中被清掉
      void load(true);
    } catch (e) {
      const errMsg = (e as Error)?.message ?? '出了点问题';
      // 把对应的 child 气泡标记为失败 + 留下错误信息
      setOptimistic((prev) =>
        prev.map((o) =>
          o.id === childId && o.kind === 'child_text'
            ? { ...o, _failed: { error: errMsg, question } }
            : o,
        ),
      );
    } finally {
      setPending(false);
    }
  };

  // 合并真实 timeline + 乐观项目（按时间）
  const items: TimelineItem[] = data
    ? [...data.items, ...optimistic.map(stripFailed)]
    : [];
  const failedMap = new Map<string, OptimisticChild>();
  for (const o of optimistic) {
    if (o.kind === 'child_text' && o._failed) failedMap.set(o.id, o);
  }

  return (
    <div className="absolute inset-0 z-40">
      <div
        className="absolute inset-0 bg-black/35"
        onClick={onClose}
        aria-hidden
      />
      <div
        className="absolute left-0 right-0 bottom-0 bg-bg-base rounded-t-sheet shadow-sheet flex flex-col overflow-hidden"
        style={{ height: '88dvh' }}
        role="dialog"
        aria-label="对话历史"
      >
        <div className="flex justify-center pt-2.5 pb-1.5 shrink-0">
          <button
            onClick={onClose}
            className="bg-transparent border-0 p-2 cursor-pointer"
            aria-label="关闭"
          >
            <span className="block w-11 h-[5px] bg-[rgba(95,94,90,0.35)] rounded-full" />
          </button>
        </div>

        <header className="px-5 pb-3 shrink-0 border-b border-[rgba(95,94,90,0.12)]">
          <h2 className="font-title text-h2 text-ink-1">
            和{data?.companion_display_name ?? '它'}的对话
          </h2>
        </header>

        {loading && (
          <div className="flex-1 flex items-center justify-center">
            <p className="font-title text-h3 text-ink-3">整理对话…</p>
          </div>
        )}
        {loadError && !loading && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <p className="font-title text-body text-ink-2">暂时拉不到对话历史</p>
            <button
              onClick={() => load(false)}
              className="font-title text-small text-amber underline cursor-pointer bg-transparent border-0"
            >
              再试一次
            </button>
          </div>
        )}
        {!loading && !loadError && data && (
          <>
            <div className="flex-1 flex flex-col overflow-hidden">
              <ChatList
                items={items}
                companionName={data.companion_display_name}
              />
              {/* 失败提示条 — 当前只显示最近一条失败 */}
              {failedMap.size > 0 && (
                <FailedBanner
                  failed={[...failedMap.values()].pop()!}
                  pending={pending}
                  onRetry={(item) => void handleSend(item._failed!.question, item.id)}
                  onDismiss={(id) =>
                    setOptimistic((prev) => prev.filter((o) => o.id !== id))
                  }
                />
              )}
            </div>
            <ChatComposer pending={pending} onSend={handleSend} />
          </>
        )}
      </div>
    </div>
  );
}

function stripFailed(o: OptimisticItem): TimelineItem {
  if (o.kind === 'child_text') {
    return {
      kind: 'child_text',
      id: o.id,
      text: o.text,
      day: o.day,
      at: o.at,
    };
  }
  return {
    kind: 'companion',
    id: o.id,
    content: o.content,
    source: o.source,
    day: o.day,
    at: o.at,
  };
}

function FailedBanner({
  failed,
  pending,
  onRetry,
  onDismiss,
}: {
  failed: OptimisticChild;
  pending: boolean;
  onRetry: (item: OptimisticChild) => void;
  onDismiss: (id: string) => void;
}) {
  return (
    <div className="shrink-0 mx-4 mb-2 px-3 py-2.5 rounded-[10px] border border-[#E24B4A]/40 bg-[#E24B4A]/10">
      <p className="font-title text-mini text-[#9b1f1e] mb-1.5 leading-snug break-all">
        {failed._failed?.error}
      </p>
      <div className="flex gap-3">
        <button
          onClick={() => onRetry(failed)}
          disabled={pending}
          className="font-title text-small text-[#9b1f1e] underline bg-transparent border-0 cursor-pointer disabled:opacity-50"
        >
          再试一次
        </button>
        <button
          onClick={() => onDismiss(failed.id)}
          disabled={pending}
          className="font-title text-small text-ink-3 bg-transparent border-0 cursor-pointer disabled:opacity-50"
        >
          先放下
        </button>
      </div>
    </div>
  );
}
