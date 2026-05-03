/**
 * /describe/voice — 语音描述主入口（V0.6.1 §4.2.1）
 *
 * 进入路径：TaskOverlay 点「说一说」→ 这里
 *
 * 行为：
 *   1. 校验 task_id 有效 + companion 存在
 *   2. 麦克风权限：未问过 → 弹 preheat → 用户点「明白了」→ 触发 getUserMedia
 *   3. 已 granted → 直接显示 VoiceRecorder
 *   4. denied → 弹 denied dialog → 跳 /describe/text
 *   5. 录完音：自动调 /api/voice/upload → 跳 /describe/confirm-text
 */

'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { MobileShell } from '@/components/ui/MobileShell';
import { Button } from '@/components/ui/Button';
import { VoiceRecorder } from '@/components/voice/VoiceRecorder';
import { MicPermissionDialog } from '@/components/voice/MicPermissionDialog';
import { Companion } from '@/components/characters/Companion';
import { useCompanionStore, useCompanionStoreHydrated } from '@/stores/companionStore';
import { useDescribeStore } from '@/stores/describeStore';
import { getCompanionState, uploadVoice, VoiceUploadError } from '@/lib/api/client';
import { getTaskByDay } from '@/lib/tasks';
import type { CompanionPresetId } from '@/components/characters/types';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <VoicePageInner />
    </Suspense>
  );
}

function VoicePageInner() {
  const router = useRouter();
  const search = useSearchParams();
  const taskId = search.get('task_id');

  const hydrated = useCompanionStoreHydrated();
  const {
    companionId,
    micPermission,
    micPermissionPreShown,
    setMicPermission,
    markMicPermissionPreShown,
    setInputPreference,
  } = useCompanionStore();
  const { startTask, setVoiceResult, setStage, reset } = useDescribeStore();

  const [companionPreset, setCompanionPreset] = useState<CompanionPresetId | null>(null);
  const [companionDisplayName, setCompanionDisplayName] = useState('伙伴');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskQuestion, setTaskQuestion] = useState('');
  const [showPreheat, setShowPreheat] = useState(false);
  const [showDenied, setShowDenied] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 初始化：拉 state + 校验 task
  useEffect(() => {
    if (!hydrated) return;
    if (!companionId || !taskId) {
      router.replace('/home');
      return;
    }
    (async () => {
      try {
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
        setCompanionDisplayName(s.companion.display_name);
        setTaskTitle(task.title);
        setTaskQuestion(task.description);
        startTask({
          taskId,
          taskTitle: task.title,
          taskQuestion: task.description,
          inputMethod: 'voice',
        });

        // 第一次触发：弹 preheat 预告
        if (!micPermissionPreShown && micPermission === 'prompt') {
          setShowPreheat(true);
        }
      } catch (e) {
        setError((e as Error)?.message ?? '出了点问题');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, companionId, taskId, router]);

  const handleVoiceComplete = async (blob: Blob, _durationMs: number) => {
    if (!companionId) return;
    setUploading(true);
    setError(null);
    setStage('transcribing');
    void _durationMs;
    try {
      const r = await uploadVoice({ companionId, blob });
      setVoiceResult({ voiceAudioUrl: r.voice_audio_url, transcription: r.transcription });
      setMicPermission('granted');
      setInputPreference('voice');
      router.push('/describe/confirm-text');
    } catch (e) {
      const err = e as VoiceUploadError;
      if (err.reason === 'asr_empty') {
        setError(err.message);
      } else if (err.reason === 'asr_unavailable') {
        setError(err.message);
      } else if (err.reason === 'asr_safety_block') {
        setError(err.message);
      } else if (err.reason === 'audio_too_large') {
        setError('录音太长了');
      } else {
        setError('网络好像有点慢，要不先打字试试？');
      }
      setStage('recording');
      setUploading(false);
    }
  };

  const handlePermissionDenied = () => {
    setMicPermission('denied');
    setShowDenied(true);
  };

  const switchToText = () => {
    setInputPreference('text');
    if (taskId) router.push(`/describe/text?task_id=${taskId}`);
    else router.push('/home');
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

        <div className="flex-1 flex flex-col items-center justify-center gap-6">
          <Companion presetId={companionPreset} pose="stand" size={140} />
          <p className="font-title text-body text-ink-2 text-center">
            「跟我说说那是什么样子？」
          </p>

          <VoiceRecorder
            onComplete={handleVoiceComplete}
            onPermissionDenied={handlePermissionDenied}
            disabled={uploading}
          />

          {error && (
            <p className="font-title text-small text-[#E24B4A] text-center">{error}</p>
          )}
        </div>

        <div className="flex gap-3 justify-between mt-4">
          <Button variant="ghost" size="sm" onClick={switchToText} disabled={uploading}>
            ⌨️ 用打字代替
          </Button>
          <Button variant="ghost" size="sm" onClick={handleSkip} disabled={uploading}>
            跳过
          </Button>
        </div>
      </div>

      {showPreheat && (
        <MicPermissionDialog
          mode="preheat"
          companionName={companionDisplayName}
          onAcknowledge={() => {
            markMicPermissionPreShown();
            setShowPreheat(false);
          }}
        />
      )}

      {showDenied && (
        <MicPermissionDialog
          mode="denied"
          companionName={companionDisplayName}
          onAcknowledge={() => setShowDenied(false)}
          onUseTyping={switchToText}
        />
      )}
    </MobileShell>
  );
}
