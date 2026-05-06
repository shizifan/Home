/**
 * 主页·小家（PRD §20.2）
 * 状态从 /api/companion/state 拉取；任务卡浮层通过 /api/describe|text|choice|skip 提交。
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MobileShell } from '@/components/ui/MobileShell';
import { TopHUD } from '@/components/nav/TopHUD';
import { BottomNav } from '@/components/nav/BottomNav';
import { SpeechBubble } from '@/components/speech/SpeechBubble';
import { Room } from '@/components/room/Room';
import { deriveRoomLayout } from '@/lib/room/derivedLayout';
import { Companion } from '@/components/characters/Companion';
import { TaskOverlay } from '@/components/task/TaskOverlay';
import { ChatOverlay } from '@/components/chat/ChatOverlay';
import { CardViewModal, type CardViewData } from '@/components/card/CardViewModal';
import { Button } from '@/components/ui/Button';
import { useCompanionStore, useCompanionStoreHydrated } from '@/stores/companionStore';
import { useUIStore } from '@/stores/uiStore';
import { getTaskByDay } from '@/lib/tasks';
import {
  advanceDay,
  deleteCard,
  getCompanionState,
  type CompanionStateResponse,
} from '@/lib/api/client';
import type { CompanionPresetId } from '@/components/characters/types';

export default function HomePage() {
  const router = useRouter();
  const hydrated = useCompanionStoreHydrated();
  const { companionId } = useCompanionStore();
  const { overlay, openOverlay, closeOverlay, setUnreadMemory } = useUIStore();
  const [state, setState] = useState<CompanionStateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState(false);
  const [viewingCard, setViewingCard] = useState<CardViewData | null>(null);

  const refresh = useCallback(async () => {
    try {
      const s = await getCompanionState();
      setState(s);
      setUnreadMemory(s.has_unread_memory);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [setUnreadMemory]);

  useEffect(() => {
    if (!hydrated) return;
    if (!companionId) {
      router.replace('/onboarding/choose');
      return;
    }
    refresh();
  }, [hydrated, companionId, router, refresh]);

  // 防止"完成任务后回 home 又看到任务浮层"——overlay 状态没主动关闭时由这里兜底
  useEffect(() => {
    if (state?.today_done && overlay === 'task') {
      closeOverlay();
    }
  }, [state?.today_done, overlay, closeOverlay]);

  const handleAdvance = async () => {
    if (advancing) return;
    setAdvancing(true);
    try {
      await advanceDay();
      await refresh();
    } catch (e) {
      alert((e as Error)?.message ?? '出了点问题');
    } finally {
      setAdvancing(false);
    }
  };

  if (loading) {
    return (
      <MobileShell>
        <div className="min-h-dvh flex items-center justify-center">
          <p className="font-title text-h3 text-ink-3">加载中…</p>
        </div>
      </MobileShell>
    );
  }
  if (!state?.companion) {
    return null;
  }

  const c = state.companion;
  // 任务定义以本地 TaskDef 为准（含 theme 等完整字段）；
  // state.today_task 只用来确认 server 端是否认为今天有任务。
  const task = state.today_task ? getTaskByDay(c.current_day) ?? null : null;
  const presetId = c.preset_id as CompanionPresetId;

  // 派生房间布局（PRD §4.4）
  // V0.6.1：优先用 cards（已确认的纸片插画），向后兼容 V0.5 的 photos
  const wallStickers =
    state.cards && state.cards.length > 0
      ? state.cards.map((card) => ({
          id: card.id,
          url: card.image_url ?? '',
          day: card.day,
          onClick: () =>
            setViewingCard({
              id: card.id,
              imageUrl: card.image_url,
              isFallbackTextCard: card.is_fallback_text_card,
              day: card.day,
              description: card.description,
            }),
        }))
      : state.photos;
  const layout = deriveRoomLayout({
    remembered: state.remembered_concepts ?? [],
    photos: wallStickers,
  });

  return (
    <MobileShell>
      <TopHUD
        companionName={c.display_name}
        subtitle={c.current_day === 1 ? '刚搬进来' : '在等你'}
        day={c.current_day}
      />

      {state.today_done && (
        <DayDoneBar
          companionName={c.display_name}
          currentDay={c.current_day}
          canAdvance={!!state.can_advance}
          canViewWorldview={!!state.can_view_worldview}
          advancing={advancing}
          onAdvance={handleAdvance}
          onViewWorldview={() => router.push('/day7/worldview')}
        />
      )}

      <div className="h-[380px] flex justify-center items-center relative">
        <Room
          width={360}
          height={380}
          photos={layout.photos}
          familyFrames={layout.frames}
          items={layout.items}
          mood={layout.mood}
        >
          <g transform="translate(280,360) scale(0.85)">
            <Companion presetId={presetId} pose="stand" size={150} />
          </g>
        </Room>
      </div>

      {/*
        主页 greeting 优先级（PRD §5.5 / §8.9 / §16.3）：
          missed_day_greeting > session_resume_greeting > 关键节点提示 > last_companion_line
      */}
      <SpeechBubble
        text={`「${
          state.missed_day_greeting ??
          state.session_resume_greeting ??
          (state.has_pending_clarifications ? '我有点东西想问你......' : null) ??
          state.last_companion_line ??
          '......'
        }」`}
        by={c.display_name}
        onTap={() => openOverlay('chat')}
      />

      {/* PRD §8.9 Day 1 完成后引导孩子第一次打开记忆面板 */}
      {state.should_hint_brain_panel && (
        <div className="px-5 mt-3">
          <button
            onClick={() => router.push('/memory')}
            className="w-full bg-[rgba(240,153,123,0.18)] border-[1.5px] border-m-remember rounded-card px-5 py-3 active:scale-[0.99] cursor-pointer text-left"
          >
            <p className="font-title text-h3 text-ink-1 mb-1">想看看我都记住了什么吗？</p>
            <p className="font-title text-small text-ink-3">钻进它的脑袋瞧一眼 →</p>
          </button>
        </div>
      )}

      {/* PRD §8.9 关键节点提示：当 has_pending_clarifications=true 给一个进面板的入口 */}
      {!state.should_hint_brain_panel && state.has_pending_clarifications && (
        <div className="px-5 mt-3">
          <button
            onClick={() => router.push('/memory')}
            className="w-full bg-[rgba(175,169,236,0.18)] border-[1.5px] border-m-uncertain rounded-card px-4 py-2.5 active:scale-[0.99] cursor-pointer text-left flex items-center justify-between"
          >
            <span className="font-title text-small text-ink-1">它有几件事想问你 →</span>
            <span className="text-amber-DEFAULT" aria-hidden>●</span>
          </button>
        </div>
      )}

      {/* 毕业后出现 "出门探索" 按钮（PRD §11.6） */}
      {c.graduated && (
        <div className="px-5 mt-3">
          <button
            onClick={() => router.push('/station')}
            className="w-full bg-amber-light/40 border-[1.5px] border-amber-DEFAULT rounded-card px-5 py-3 flex items-center justify-between active:scale-[0.99] cursor-pointer"
          >
            <span className="font-title text-h3 text-amber-deep">🚪 出门探索</span>
            <span className="font-title text-small text-amber-mid">驿站 →</span>
          </button>
        </div>
      )}

      {/* 给 BottomNav (absolute h-84) 让出空间，否则最后一段内容会被盖住 */}
      <div className="h-[100px]" aria-hidden />

      <BottomNav
        hasTaskBadge={!!task && !state.today_done}
        hasBrainRedDot={state.has_unread_memory}
        showInventory={!!c.has_played_plaza}
        onTask={() => openOverlay('task')}
        onBrain={() => router.push('/memory')}
        onInventory={() => router.push('/inventory')}
        onDiary={() => router.push('/parent')}
        onGear={() => router.push('/parent#settings')}
      />

      {overlay === 'task' && task && !state.today_done && (
        <TaskOverlay
          task={task}
          companionId={c.id}
          companionName={c.display_name}
          onClose={() => {
            closeOverlay();
            refresh();
          }}
        />
      )}

      {overlay === 'chat' && <ChatOverlay onClose={closeOverlay} />}

      {viewingCard && (
        <CardViewModal
          card={viewingCard}
          onClose={() => setViewingCard(null)}
          onDelete={async (cardId) => {
            await deleteCard(cardId);
            await refresh();
          }}
        />
      )}
    </MobileShell>
  );
}

function DayDoneBar({
  companionName,
  currentDay,
  canAdvance,
  canViewWorldview,
  advancing,
  onAdvance,
  onViewWorldview,
}: {
  companionName: string;
  currentDay: number;
  canAdvance: boolean;
  canViewWorldview: boolean;
  advancing: boolean;
  onAdvance: () => void;
  onViewWorldview: () => void;
}) {
  return (
    <div className="mx-5 mt-2 mb-2 px-4 py-3 bg-amber-light/30 border border-amber-light rounded-card flex items-center gap-3">
      <span className="font-num text-mini text-amber-deep tracking-[0.16em]">
        ✓ 今天的事做完啦
      </span>
      <span className="flex-1" />
      {canAdvance && (
        <button
          onClick={onAdvance}
          disabled={advancing}
          className="font-title text-small bg-ink-1 text-bg-base rounded-full px-4 py-1.5 cursor-pointer border-0 disabled:opacity-60"
        >
          {advancing ? '正在迎接…' : `去 Day ${currentDay + 1} →`}
        </button>
      )}
      {canViewWorldview && (
        <button
          onClick={onViewWorldview}
          className="font-title text-small bg-ink-1 text-bg-base rounded-full px-4 py-1.5 cursor-pointer border-0"
        >
          看{companionName}眼中的世界 →
        </button>
      )}
    </div>
  );
}
