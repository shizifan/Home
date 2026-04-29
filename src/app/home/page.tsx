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
import { Button } from '@/components/ui/Button';
import { useCompanionStore } from '@/stores/companionStore';
import { useUIStore } from '@/stores/uiStore';
import { getTaskByDay } from '@/lib/tasks';
import { advanceDay, getCompanionState, type CompanionStateResponse } from '@/lib/api/client';
import type { CompanionPresetId } from '@/components/characters/types';

export default function HomePage() {
  const router = useRouter();
  const { companionId } = useCompanionStore();
  const { overlay, openOverlay, closeOverlay, setUnreadMemory } = useUIStore();
  const [state, setState] = useState<CompanionStateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState(false);

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
    if (!companionId) {
      router.replace('/onboarding/choose');
      return;
    }
    refresh();
  }, [companionId, router, refresh]);

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
  const layout = deriveRoomLayout({
    remembered: state.remembered_concepts ?? [],
    photos: state.photos,
  });

  return (
    <MobileShell>
      <TopHUD
        companionName={c.display_name}
        subtitle={c.current_day === 1 ? '刚搬进来' : '在等你'}
        day={c.current_day}
      />

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

      <BottomNav
        hasTaskBadge={!!task && !state.today_done}
        hasBrainRedDot={state.has_unread_memory}
        onTask={() => openOverlay('task')}
        onBrain={() => router.push('/memory')}
        onDiary={() => router.push('/parent')}
        onGear={() => router.push('/parent#settings')}
      />

      {overlay === 'task' && task && (
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
    <div className="mx-5 mb-3 px-4 py-3 bg-amber-light/30 border border-amber-light rounded-card flex items-center gap-3">
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
