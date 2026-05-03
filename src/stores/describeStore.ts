/**
 * describeStore — 描述任务跨页面会话状态（V0.6.1）
 *
 * 不持久化（刷新即丢）。只在描述任务的 6 个页面间传递状态。
 * 任务完成或用户主动退出时调用 reset()。
 */

import { create } from 'zustand';

import type { ImageGenSource } from '@/lib/api/client';

export type DescribeStage =
  | 'idle'
  | 'recording'        // /describe/voice
  | 'transcribing'     // /describe/voice 录完→ASR 中
  | 'confirming-text'  // /describe/confirm-text
  | 'generating'       // /describe/generating
  | 'confirming-card'  // /describe/confirm-card
  | 'revising';        // /describe/revise

interface DescribeState {
  // 当前任务
  taskId: string | null;
  taskTitle: string | null;
  taskQuestion: string | null;
  /** 任务可附带的文字附言（Day 2/3）— V0.6.1 §3 */
  textCompanion: string;

  // ASR 阶段
  voiceAudioUrl: string | null;
  asrTranscription: string;
  /** 孩子在中转页编辑后的文字（如果没编辑就等于 asrTranscription）*/
  finalText: string;
  inputMethod: 'voice' | 'text';

  // 卡片阶段
  cardId: string | null;
  imageUrl: string | null;
  imageSource: ImageGenSource | null;
  altImageUrl: string | null;
  altImageSource: ImageGenSource | null;
  isFallbackTextCard: boolean;
  companionReply: string;
  attempt: 1 | 2 | 3 | 4;

  stage: DescribeStage;

  // setters
  startTask: (args: { taskId: string; taskTitle: string; taskQuestion: string; inputMethod: 'voice' | 'text' }) => void;
  setVoiceResult: (args: { voiceAudioUrl: string; transcription: string }) => void;
  setFinalText: (text: string) => void;
  setTextCompanion: (text: string) => void;
  setStage: (stage: DescribeStage) => void;
  setCardResult: (args: {
    cardId: string;
    imageUrl: string | null;
    imageSource?: ImageGenSource | null;
    altImageUrl?: string | null;
    altImageSource?: ImageGenSource | null;
    isFallbackTextCard: boolean;
    companionReply: string;
    attempt: 1 | 2 | 3 | 4;
  }) => void;
  reset: () => void;
}

const INITIAL: Omit<DescribeState, 'startTask' | 'setVoiceResult' | 'setFinalText' | 'setTextCompanion' | 'setStage' | 'setCardResult' | 'reset'> = {
  taskId: null,
  taskTitle: null,
  taskQuestion: null,
  textCompanion: '',
  voiceAudioUrl: null,
  asrTranscription: '',
  finalText: '',
  inputMethod: 'voice',
  cardId: null,
  imageUrl: null,
  imageSource: null,
  altImageUrl: null,
  altImageSource: null,
  isFallbackTextCard: false,
  companionReply: '',
  attempt: 1,
  stage: 'idle',
};

export const useDescribeStore = create<DescribeState>((set) => ({
  ...INITIAL,

  startTask: ({ taskId, taskTitle, taskQuestion, inputMethod }) =>
    set({
      ...INITIAL,
      taskId,
      taskTitle,
      taskQuestion,
      inputMethod,
      stage: inputMethod === 'voice' ? 'recording' : 'confirming-text',
    }),

  setVoiceResult: ({ voiceAudioUrl, transcription }) =>
    set({
      voiceAudioUrl,
      asrTranscription: transcription,
      finalText: transcription,
      stage: 'confirming-text',
    }),

  setFinalText: (text) => set({ finalText: text }),
  setTextCompanion: (text) => set({ textCompanion: text }),
  setStage: (stage) => set({ stage }),

  setCardResult: ({ cardId, imageUrl, imageSource, altImageUrl, altImageSource, isFallbackTextCard, companionReply, attempt }) =>
    set({
      cardId,
      imageUrl,
      imageSource: imageSource ?? null,
      altImageUrl: altImageUrl ?? null,
      altImageSource: altImageSource ?? null,
      isFallbackTextCard,
      companionReply,
      attempt,
      stage: 'confirming-card',
    }),

  reset: () => set(INITIAL),
}));
