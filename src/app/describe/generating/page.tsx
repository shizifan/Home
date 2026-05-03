/**
 * /describe/generating — 生成中等待页（V0.6.1 §4.6.1）
 *
 * mount 时触发 /api/describe/submit。
 * 防重入：用 ref 守门，避免 React StrictMode 双 mount 触发两次提交。
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { MobileShell } from '@/components/ui/MobileShell';
import { GeneratingScreen } from '@/components/card/GeneratingScreen';
import { useCompanionStore, useCompanionStoreHydrated } from '@/stores/companionStore';
import { useDescribeStore } from '@/stores/describeStore';
import { getCompanionState, submitDescribe } from '@/lib/api/client';
import type { CompanionPresetId } from '@/components/characters/types';

export default function Page() {
  const router = useRouter();
  const hydrated = useCompanionStoreHydrated();
  const { companionId } = useCompanionStore();
  const {
    taskId,
    finalText,
    inputMethod,
    voiceAudioUrl,
    asrTranscription,
    setCardResult,
    reset,
  } = useDescribeStore();

  const [companionPreset, setCompanionPreset] = useState<CompanionPresetId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const submittedRef = useRef(false);

  useEffect(() => {
    (async () => {
      const s = await getCompanionState();
      if (s.companion) setCompanionPreset(s.companion.preset_id as CompanionPresetId);
    })();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (submittedRef.current) return;
    if (!companionId || !taskId || !finalText) {
      router.replace('/home');
      return;
    }
    submittedRef.current = true;
    (async () => {
      try {
        const r = await submitDescribe({
          companion_id: companionId,
          task_id: taskId,
          description_text: finalText,
          input_method: inputMethod,
          voice_audio_url: voiceAudioUrl ?? undefined,
          asr_transcription: asrTranscription || undefined,
          edited_text: finalText !== asrTranscription ? finalText : undefined,
        });
        setCardResult({
          cardId: r.card_id,
          imageUrl: r.image_url,
          imageSource: r.image_source,
          altImageUrl: r.alt_image_url,
          altImageSource: r.alt_image_source,
          isFallbackTextCard: r.is_fallback_text_card,
          companionReply: r.companion_response,
          attempt: 1,
        });
        router.replace('/describe/confirm-card');
      } catch (e) {
        setError((e as Error)?.message ?? '出了点问题');
        submittedRef.current = false;
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, companionId, taskId]);

  return (
    <MobileShell showStatusBar={false}>
      <GeneratingScreen
        companionPreset={companionPreset}
        error={error}
        onBack={() => router.replace('/describe/confirm-text')}
        onHome={() => {
          reset();
          router.push('/home');
        }}
      />
    </MobileShell>
  );
}
