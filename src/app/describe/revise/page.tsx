/**
 * /describe/revise — 卡片修订页（V0.6.1 §4.6.4-5）
 *
 * 三阶段，与初次描述对齐：
 *   1. reason   — 选原因 + 录语音补充
 *   2. confirm  — 确认 ASR 文字（编辑/重说）
 *   3. submit   — "伙伴在画" 等待画面（同 /describe/generating）
 *
 * 完成后跳 /describe/confirm-card；中途可点返回回到 confirm-card。
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { MobileShell } from '@/components/ui/MobileShell';
import { RevisionFlow, type RevisionType } from '@/components/card/RevisionFlow';
import { TranscriptionConfirm } from '@/components/voice/TranscriptionConfirm';
import { GeneratingScreen } from '@/components/card/GeneratingScreen';
import { useDescribeStore } from '@/stores/describeStore';
import { useCompanionStore, useCompanionStoreHydrated } from '@/stores/companionStore';
import { reviseDescribe, uploadVoice, getCompanionState, VoiceUploadError } from '@/lib/api/client';
import type { CompanionPresetId } from '@/components/characters/types';

type Stage = 'reason' | 'confirm' | 'submit';

export default function Page() {
  const router = useRouter();
  const hydrated = useCompanionStoreHydrated();
  const { companionId } = useCompanionStore();
  const { cardId, imageUrl, attempt, setCardResult } = useDescribeStore();

  const [companionName, setCompanionName] = useState('伙伴');
  const [companionPreset, setCompanionPreset] = useState<CompanionPresetId | null>(null);
  const [stage, setStage] = useState<Stage>('reason');
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // 阶段间携带的数据
  const [pickedType, setPickedType] = useState<RevisionType | null>(null);
  const [transcription, setTranscription] = useState('');

  // 防止 submit 阶段双触发
  const submittedRef = useRef(false);

  useEffect(() => {
    if (!hydrated) return;
    if (!cardId) {
      router.replace('/home');
      return;
    }
    (async () => {
      const s = await getCompanionState();
      if (s.companion) {
        setCompanionName(s.companion.display_name);
        setCompanionPreset(s.companion.preset_id as CompanionPresetId);
      }
    })();
  }, [hydrated, cardId, router]);

  // 阶段 1 → 阶段 2：跑 ASR
  const handleVoiceCaptured = async (
    type: RevisionType,
    blob: Blob,
    _durationMs: number,
  ) => {
    if (!companionId) return;
    void _durationMs;
    setError(null);
    try {
      const voiceRes = await uploadVoice({ companionId, blob });
      setPickedType(type);
      setTranscription(voiceRes.transcription);
      setStage('confirm');
    } catch (e) {
      const err = e as VoiceUploadError;
      if (err.reason === 'asr_empty' || err.reason === 'asr_unavailable') {
        setError(err.message);
      } else {
        setError((e as Error)?.message ?? '出了点问题，再试一次');
      }
    }
  };

  // 阶段 2 → 阶段 3：进入"伙伴在画"
  const handleConfirmText = (finalText: string) => {
    setTranscription(finalText);
    submittedRef.current = false;
    setSubmitError(null);
    setStage('submit');
  };

  // 阶段 2：重说 → 回阶段 1
  const handleRedo = () => {
    setTranscription('');
    setStage('reason');
  };

  // 阶段 3：mount 时调 reviseDescribe
  useEffect(() => {
    if (stage !== 'submit') return;
    if (submittedRef.current) return;
    if (!cardId || !pickedType) return;
    submittedRef.current = true;
    (async () => {
      try {
        const r = await reviseDescribe({
          card_id: cardId,
          revision_type: pickedType,
          revision_text: transcription,
        });
        setCardResult({
          cardId: r.card_id,
          imageUrl: r.image_url,
          imageSource: r.image_source,
          altImageUrl: r.alt_image_url,
          altImageSource: r.alt_image_source,
          isFallbackTextCard: r.is_fallback_text_card,
          companionReply: r.is_exhausted
            ? '我可能画不出来你说的样子，但我都记住了。下次再试？'
            : r.attempt === 3
              ? '我尽力了，再试一次。'
              : '你看这次对吗？',
          attempt: Math.min(r.attempt, 4) as 1 | 2 | 3 | 4,
        });
        router.replace('/describe/confirm-card');
      } catch (e) {
        setSubmitError((e as Error)?.message ?? '出了点问题');
        submittedRef.current = false;
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  if (!cardId) return null;

  // attemptNumber 给 RevisionFlow 用，控制伙伴台词；clamp 到 1/2/3
  const promptAttempt = (Math.min(attempt, 3) as 1 | 2 | 3);

  if (stage === 'submit') {
    return (
      <MobileShell showStatusBar={false}>
        <GeneratingScreen
          companionPreset={companionPreset}
          error={submitError}
          onBack={() => {
            setSubmitError(null);
            setStage('confirm');
          }}
          onHome={() => router.replace('/describe/confirm-card')}
        />
      </MobileShell>
    );
  }

  return (
    <MobileShell showStatusBar={false}>
      <div className="min-h-dvh flex flex-col px-7 pt-6 pb-8">
        <button
          onClick={() => {
            if (stage === 'confirm') {
              setStage('reason');
            } else {
              router.replace('/describe/confirm-card');
            }
          }}
          className="self-start font-title text-small text-ink-3 cursor-pointer bg-transparent border-0"
        >
          ← 返回
        </button>

        <div className="mt-4 flex-1">
          {stage === 'reason' && (
            <>
              <RevisionFlow
                oldImageUrl={imageUrl}
                companionName={companionName}
                attemptNumber={promptAttempt}
                onSubmit={handleVoiceCaptured}
              />
              {error && (
                <p className="font-title text-small text-[#E24B4A] mt-3 text-center">{error}</p>
              )}
            </>
          )}

          {stage === 'confirm' && (
            <TranscriptionConfirm
              initialText={transcription}
              onConfirm={handleConfirmText}
              onRedo={handleRedo}
            />
          )}
        </div>
      </div>
    </MobileShell>
  );
}
