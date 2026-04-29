/**
 * companionStore — 前端只存"路由判断需要的最少状态"
 *
 * 真数据从 /api/companion/state 取（serverside MySQL）。
 * 这里仅保留：introCompleted（是否看过引导）+ companionId（是否已创建过伙伴）。
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

import { localJSONStorage } from '@/lib/storage/local';

interface CompanionState {
  introCompleted: boolean;
  companionId: string | null;
  /** 是否已经跳过过任务一次（PRD §13.2 首次跳过提示）*/
  hasSkippedOnce: boolean;

  setCompanionId: (id: string) => void;
  markIntroCompleted: () => void;
  markSkippedOnce: () => void;
  reset: () => void;
}

export const useCompanionStore = create<CompanionState>()(
  persist(
    (set) => ({
      introCompleted: false,
      companionId: null,
      hasSkippedOnce: false,

      setCompanionId: (id) => set({ companionId: id }),
      markIntroCompleted: () => set({ introCompleted: true }),
      markSkippedOnce: () => set({ hasSkippedOnce: true }),
      reset: () =>
        set({
          introCompleted: false,
          companionId: null,
          hasSkippedOnce: false,
        }),
    }),
    {
      name: 'companion',
      storage: createJSONStorage(() => localJSONStorage),
    },
  ),
);
