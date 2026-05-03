/**
 * VoiceRecorder — 按住录音组件（V0.6.1 §4.3.1 + §11.1）
 *
 * 交互：
 *   - 按住按钮开始录音（Pointer / Touch / Mouse 三套事件兼容）
 *   - 松开自动停止
 *   - 录音中：按钮放大 110%，外圈声波动画（跟随音量）
 *   - 接近 60 秒上限时显示"还可以说 5 秒"
 *   - 到达上限自动停止并触发 onComplete
 *   - 太短（< 1 秒）触发 onTooShort，不上传
 *   - 触觉反馈：按下时 navigator.vibrate(50)
 *
 * 测试钩子：
 *   - data-testid="voice-recorder"
 *   - 当 NEXT_PUBLIC_TEST_HELPERS=1 时挂载 window.__testHelpers.simulateRecording()
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';

import { convertBlobToWav } from '@/lib/asr/wavConvert';

interface Props {
  /** 最长录音时长（秒，默认 60）*/
  maxDurationSec?: number;
  /** 最短有效时长（秒，默认 1）*/
  minDurationSec?: number;
  /** 录音完成回调 — 父级负责上传 */
  onComplete: (blob: Blob, durationMs: number) => void;
  /** 太短时回调 */
  onTooShort?: () => void;
  /** 麦克风权限被拒回调 */
  onPermissionDenied?: () => void;
  /** 是否禁用（外部控制，比如已经在等待 ASR 时）*/
  disabled?: boolean;
}

type RecState = 'idle' | 'recording' | 'finishing';

const TICK_MS = 100;

export function VoiceRecorder({
  maxDurationSec = 60,
  minDurationSec = 1,
  onComplete,
  onTooShort,
  onPermissionDenied,
  disabled,
}: Props) {
  const [state, setState] = useState<RecState>('idle');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [volume, setVolume] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const startedAtRef = useRef<number>(0);
  const tickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rafRef = useRef<number | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const stopAll = () => {
    if (tickTimerRef.current) {
      clearInterval(tickTimerRef.current);
      tickTimerRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch { /* ignore */ }
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
  };

  useEffect(() => {
    return () => stopAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startRecording = async () => {
    if (state !== 'idle' || disabled) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // 选 mime 类型：webm 优先，iOS Safari 退到 mp4
      const mimeCandidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
      const mime = mimeCandidates.find((m) => MediaRecorder.isTypeSupported?.(m)) ?? '';
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        const durationMs = Date.now() - startedAtRef.current;
        const rawBlob = new Blob(chunksRef.current, { type: mime || 'audio/webm' });
        chunksRef.current = [];

        // 太短保护
        if (durationMs < minDurationSec * 1000) {
          setState('idle');
          setElapsedMs(0);
          onTooShort?.();
          return;
        }

        // 转 16k mono PCM WAV — DashScope Paraformer 要求
        let finalBlob: Blob = rawBlob;
        try {
          finalBlob = await convertBlobToWav(rawBlob);
        } catch (e) {
          console.error('[VoiceRecorder] convertBlobToWav failed:', e);
          // 转换失败仍然把原始 blob 上传，让后端兜底（可能仍然识别不了，前端会展示错误提示）
        }
        setElapsedMs(0);
        // 保持 'finishing' 状态直到父级通过 disabled 切换告知 ASR 已结束（成功跳页或失败重置）
        onComplete(finalBlob, durationMs);
      };

      // 音量分析（声波动画用）
      try {
        const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        src.connect(analyser);
        audioContextRef.current = ctx;
        analyserRef.current = analyser;
        const data = new Uint8Array(analyser.frequencyBinCount);
        const tickVolume = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(data);
          let sum = 0;
          for (const v of data) sum += v;
          setVolume(Math.min(1, sum / data.length / 128));
          rafRef.current = requestAnimationFrame(tickVolume);
        };
        rafRef.current = requestAnimationFrame(tickVolume);
      } catch {
        /* 音量分析失败不影响录音 */
      }

      recorder.start(250);
      startedAtRef.current = Date.now();
      setState('recording');
      setElapsedMs(0);

      // 触觉反馈
      if ('vibrate' in navigator) {
        try { navigator.vibrate(50); } catch { /* ignore */ }
      }

      // 倒计时
      tickTimerRef.current = setInterval(() => {
        const elapsed = Date.now() - startedAtRef.current;
        setElapsedMs(elapsed);
        if (elapsed >= maxDurationSec * 1000) {
          stopRecording();
        }
      }, TICK_MS);
    } catch (err) {
      const name = (err as Error)?.name;
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        onPermissionDenied?.();
      } else {
        console.error('[VoiceRecorder] start failed:', err);
      }
      stopAll();
    }
  };

  const stopRecording = () => {
    if (state !== 'recording') return;
    setState('finishing');
    if (tickTimerRef.current) {
      clearInterval(tickTimerRef.current);
      tickTimerRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
  };

  // 父级 disabled 从 true→false（ASR 失败需要重录）时把 finishing 重置回 idle
  // 注意：必须用 ref 记前一次 disabled 才能识别"边沿"——直接判 `!disabled` 会在
  // 刚进 finishing（父级还没来得及 setUploading(true)）那一刻就把状态重置回 idle，
  // 用户就看不到「正在识别…」提示。
  const prevDisabledRef = useRef(disabled);
  useEffect(() => {
    if (prevDisabledRef.current && !disabled && state === 'finishing') {
      setState('idle');
    }
    prevDisabledRef.current = disabled;
  }, [disabled, state]);

  // 测试钩子
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_TEST_HELPERS !== '1') return;
    const w = window as unknown as {
      __testHelpers?: { simulateRecording: (blob: Blob, durationMs?: number) => void };
    };
    w.__testHelpers = {
      simulateRecording: (blob, durationMs = 3000) => {
        onComplete(blob, durationMs);
      },
    };
    return () => {
      delete w.__testHelpers;
    };
  }, [onComplete]);

  const remainingSec = Math.max(0, maxDurationSec - Math.floor(elapsedMs / 1000));
  const showLast5 = state === 'recording' && remainingSec <= 5 && remainingSec > 0;
  const isRecording = state === 'recording';

  return (
    <div className="flex flex-col items-center gap-3" data-testid="voice-recorder">
      <div className="relative">
        {/* 声波外圈（仅录音中）*/}
        {isRecording && (
          <span
            className="absolute inset-0 rounded-full bg-amber-light/40 transition-transform duration-100"
            style={{ transform: `scale(${1 + volume * 0.6})` }}
            aria-hidden
          />
        )}
        <button
          type="button"
          disabled={disabled || state === 'finishing'}
          aria-label={isRecording ? '正在录音，松开停止' : '按住说话'}
          onPointerDown={(e) => {
            e.preventDefault();
            startRecording();
          }}
          onPointerUp={(e) => {
            e.preventDefault();
            stopRecording();
          }}
          onPointerCancel={() => stopRecording()}
          onPointerLeave={() => {
            if (isRecording) stopRecording();
          }}
          className={clsx(
            'relative w-[120px] h-[120px] rounded-full border-[1.5px] border-white shadow-paper',
            'flex items-center justify-center transition-transform duration-150',
            'cursor-pointer select-none touch-none',
            isRecording ? 'bg-[#F0997B] scale-110' : 'bg-amber-light',
            disabled && 'opacity-50 cursor-not-allowed',
          )}
        >
          <MicIcon active={isRecording} />
        </button>
      </div>

      {state === 'idle' && (
        <p className="font-title text-small text-ink-2">按住说话</p>
      )}
      {isRecording && (
        <div className="text-center">
          <p className="font-num text-small text-ink-1">
            {formatTime(elapsedMs)}
          </p>
          {showLast5 && (
            <p className="font-title text-mini text-[#E24B4A] mt-1">
              还可以说 {remainingSec} 秒…
            </p>
          )}
        </div>
      )}
      {state === 'finishing' && (
        <p className="font-title text-small text-ink-3 flex items-center gap-2">
          <Spinner />
          正在识别…
        </p>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="w-4 h-4 animate-spin text-ink-3"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.25" />
      <path
        d="M21 12 a9 9 0 0 1 -9 9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MicIcon({ active }: { active: boolean }) {
  const stroke = active ? '#E24B4A' : '#FFFFFF';
  return (
    <svg width="44" height="44" viewBox="0 0 24 24" aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" fill="none" stroke={stroke} strokeWidth="1.8" />
      <path d="M5 11 V12 a7 7 0 0 0 14 0 V11" fill="none" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
      <line x1="12" y1="19" x2="12" y2="22" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
      <line x1="9" y1="22" x2="15" y2="22" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
