/**
 * /describe/confirm-text — ASR 中转确认页（V0.6.1 §4.3.4）
 *
 * 必须主动确认（决议 B4），不做自动跳过。
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { MobileShell } from '@/components/ui/MobileShell';
import { TranscriptionConfirm } from '@/components/voice/TranscriptionConfirm';
import { useDescribeStore } from '@/stores/describeStore';

export default function Page() {
  const router = useRouter();
  const { taskId, asrTranscription, setFinalText, setStage, reset } = useDescribeStore();

  useEffect(() => {
    if (!taskId || !asrTranscription) {
      // 状态丢失 → 回 home
      router.replace('/home');
    }
  }, [taskId, asrTranscription, router]);

  const handleRedo = () => {
    if (taskId) router.push(`/describe/voice?task_id=${taskId}`);
  };

  const handleConfirm = (finalText: string) => {
    setFinalText(finalText);
    setStage('generating');
    router.push('/describe/generating');
  };

  if (!asrTranscription) return null;

  return (
    <MobileShell showStatusBar={false}>
      <div className="min-h-dvh flex flex-col px-7 pt-6 pb-8">
        <button
          onClick={() => {
            reset();
            router.push('/home');
          }}
          className="self-start font-title text-small text-ink-3 cursor-pointer bg-transparent border-0"
        >
          ← 返回
        </button>

        <div className="mt-6 flex-1">
          <TranscriptionConfirm
            initialText={asrTranscription}
            onConfirm={handleConfirm}
            onRedo={handleRedo}
          />
        </div>
      </div>
    </MobileShell>
  );
}
