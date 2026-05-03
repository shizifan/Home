/**
 * 主页·小家（PRD §10.2）
 * P2：状态从 /api/companion/state 拉取；任务卡浮层通过 /api/photo|text|skip 提交。
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
  const task = state.today_task ?? getTaskByDay(c.current_day) ?? null;
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

      <SpeechBubble
        text={`「${state.last_companion_line ?? '......'}」`}
        by={c.display_name}
        onTap={() => openOverlay('chat')}
      />

      {/* 给 BottomNav (absolute h-84) 让出空间，否则最后一段内容会被盖住 */}
      <div className="h-[100px]" aria-hidden />

      <BottomNav
        hasTaskBadge={!!task && !state.today_done}
        hasBrainRedDot={state.has_unread_memory}
        onTask={() => openOverlay('task')}
        onBrain={() => router.push('/memory')}
        onDiary={() => router.push('/parent')}
        onGear={() => router.push('/parent#settings')}
      />

      {overlay === 'task' && task && !state.today_done && (
        <TaskOverlay
          task={{
            id: task.id,
            day: c.current_day as 1 | 2 | 3 | 4 | 5 | 6 | 7,
            kind: task.kind as 'photo' | 'text' | 'photo_text' | 'choice' | 'memory_review',
            title: task.title,
            description: task.description,
          }}
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
