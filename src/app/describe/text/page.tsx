/**
 * /describe/text — 文字模式描述（V0.6.1 §12.2）
 *
 * 文字模式没有"中转页"——直接从输入框提交到 generating 流程。
 */

'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { MobileShell } from '@/components/ui/MobileShell';
import { Button } from '@/components/ui/Button';
import { Companion } from '@/components/characters/Companion';
import { useCompanionStore, useCompanionStoreHydrated } from '@/stores/companionStore';
import { useDescribeStore } from '@/stores/describeStore';
import { getCompanionState } from '@/lib/api/client';
import { getTaskByDay } from '@/lib/tasks';
import type { CompanionPresetId } from '@/components/characters/types';

const CHAR_LIMIT = 300;

export default function Page() {
  return (
    <Suspense fallback={null}>
      <TextPageInner />
    </Suspense>
  );
}

function TextPageInner() {
  const router = useRouter();
  const search = useSearchParams();
  const taskId = search.get('task_id');

  const hydrated = useCompanionStoreHydrated();
  const { companionId, setInputPreference } = useCompanionStore();
  const { startTask, setFinalText, reset, setStage } = useDescribeStore();

  const [companionPreset, setCompanionPreset] = useState<CompanionPresetId | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskQuestion, setTaskQuestion] = useState('');
  const [text, setText] = useState('');

  useEffect(() => {
    if (!hydrated) return;
    if (!companionId || !taskId) {
      router.replace('/home');
      return;
    }
    (async () => {
      const s = await getCompanionState();
      if (!s.companion) {
        router.replace('/onboarding/choose');
        return;
      }
      const task = getTaskByDay(s.companion.current_day);
      if (!task || task.id !== taskId) {
        router.replace('/home');
        return;
      }
      setCompanionPreset(s.companion.preset_id as CompanionPresetId);
      setTaskTitle(task.title);
      setTaskQuestion(task.description);
      startTask({
        taskId,
        taskTitle: task.title,
        taskQuestion: task.description,
        inputMethod: 'text',
      });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, companionId, taskId, router]);

  const trimmed = text.trim();
  const canSubmit = trimmed.length > 0;

  const handleSubmit = () => {
    if (!canSubmit) return;
    setFinalText(trimmed);
    setInputPreference('text');
    setStage('generating');
    router.push('/describe/generating');
  };

  const switchToVoice = () => {
    setInputPreference('voice');
    if (taskId) router.push(`/describe/voice?task_id=${taskId}`);
  };

  const handleSkip = () => {
    reset();
    router.push('/home');
  };

  if (!companionPreset) {
    return (
      <MobileShell>
        <div className="min-h-dvh flex items-center justify-center">
          <p className="font-title text-h3 text-ink-3">加载中…</p>
        </div>
      </MobileShell>
    );
  }

  return (
    <MobileShell showStatusBar={false}>
      <div className="min-h-dvh flex flex-col px-7 pt-6 pb-8">
        <button
          onClick={handleSkip}
          className="self-start font-title text-small text-ink-3 cursor-pointer bg-transparent border-0"
        >
          ← 返回
        </button>

        <div className="mt-4">
          <p className="font-num text-mini text-ink-3 tracking-[0.16em]">
            {taskTitle}
          </p>
          <h1 className="font-title text-h2 text-ink-1 mt-2">{taskQuestion}</h1>
        </div>

        <div className="flex flex-col items-center mt-4">
          <Companion presetId={companionPreset} pose="stand" size={120} />
          <p className="font-title text-body text-ink-2 text-center mt-2">
            「跟我说说那是什么样子？」
          </p>
        </div>

        <div className="mt-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, CHAR_LIMIT))}
            placeholder="说点什么吧…"
            rows={6}
            className="w-full min-h-[150px] bg-white border-[1.5px] border-[rgba(95,94,90,0.25)] rounded-[12px] p-3.5 font-title text-h3 text-ink-1 leading-[1.6] outline-none focus:border-ink-2 resize-none"
          />
          <div className="flex justify-end mt-1">
            <span className="font-num text-mini text-ink-3">{text.length} / {CHAR_LIMIT}</span>
          </div>
        </div>

        <div className="flex gap-3 mt-auto">
          <Button variant="ghost" size="md" onClick={switchToVoice}>
            🎤 改用说话
          </Button>
          <Button size="md" fullWidth onClick={handleSubmit} disabled={!canSubmit}>
            生成卡片 ▷
          </Button>
        </div>
      </div>
    </MobileShell>
  );
}
