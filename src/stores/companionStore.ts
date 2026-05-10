/**
 * companionStore — 前端只存"路由判断需要的最少状态"
 *
 * 真数据从 /api/companion/state 取（serverside MySQL）。
 * 这里仅保留：introCompleted（是否看过引导）+ companionId（是否已创建过伙伴）。
 */

import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

import { localJSONStorage } from '@/lib/storage/local';

/** V0.6.1：输入偏好与麦克风权限 */
export type InputPreference = 'voice' | 'text';
export type MicPermission = 'granted' | 'denied' | 'prompt';

interface CompanionState {
  introCompleted: boolean;
  companionId: string | null;
  /** 是否已经跳过过任务一次（PRD §13.2 首次跳过提示）*/
  hasSkippedOnce: boolean;
  /** V0.6.1：上次描述任务的输入方式（下次自动落到对应路由）*/
  inputPreference: InputPreference;
  /** V0.6.1：麦克风权限状态。'prompt' = 还没问过 */
  micPermission: MicPermission;
  /** V0.6.1：是否已经看过权限引导预告（避免重复弹）*/
  micPermissionPreShown: boolean;

  /** P7：减少动效（晕动症友好；PRD §19.11.7）*/
  reduceMotion: boolean;

  setCompanionId: (id: string) => void;
  markIntroCompleted: () => void;
  /** "设置 → 重看引导" 入口：仅清 introCompleted，其他状态保留（PRD §17.3）*/
  resetIntro: () => void;
  markSkippedOnce: () => void;
  setInputPreference: (p: InputPreference) => void;
  setMicPermission: (p: MicPermission) => void;
  markMicPermissionPreShown: () => void;
  setReduceMotion: (v: boolean) => void;
  reset: () => void;
}

export const useCompanionStore = create<CompanionState>()(
  persist(
    (set) => ({
      introCompleted: false,
      companionId: null,
      hasSkippedOnce: false,
      inputPreference: 'voice',
      micPermission: 'prompt',
      micPermissionPreShown: false,
      reduceMotion: false,

      setCompanionId: (id) => set({ companionId: id }),
      markIntroCompleted: () => set({ introCompleted: true }),
      resetIntro: () => set({ introCompleted: false }),
      markSkippedOnce: () => set({ hasSkippedOnce: true }),
      setInputPreference: (p) => set({ inputPreference: p }),
      setMicPermission: (p) => set({ micPermission: p }),
      markMicPermissionPreShown: () => set({ micPermissionPreShown: true }),
      setReduceMotion: (v) => set({ reduceMotion: v }),
      reset: () =>
        set({
          introCompleted: false,
          companionId: null,
          hasSkippedOnce: false,
          inputPreference: 'voice',
          micPermission: 'prompt',
          micPermissionPreShown: false,
          reduceMotion: false,
        }),
    }),
    {
      name: 'companion',
      storage: createJSONStorage(() => localJSONStorage),
    },
  ),
);

/**
 * 水合等待 hook — 等 Zustand persist 从 localStorage 读完，
 * 并且额外等一次 React re-render，确保 useCompanionStore() 返回的快照已同步到 store 最新值。
 *
 * Zustand persist.hasHydrated() 可能在 useState initializer 时就返回 true，
 * 但当时 React 内部订阅的 selector 仍是 store 默认值 — 所以必须再 schedule 一次 render。
 */
export function useCompanionStoreHydrated(): boolean {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const advance = () => {
      if (!cancelled) setTick((t) => Math.max(t, 2));
    };
    if (useCompanionStore.persist.hasHydrated()) {
      // 已水合：先 tick=1（触发 re-render 让 store 快照同步），再 tick=2（hydrated）
      setTick(1);
      const id = setTimeout(advance, 0);
      return () => {
        cancelled = true;
        clearTimeout(id);
      };
    }
    const unsub = useCompanionStore.persist.onFinishHydration(advance);
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);
  return tick >= 2;
}
