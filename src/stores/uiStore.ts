/**
 * uiStore — 浮层与导航状态
 * 不持久化：刷新即重置。
 */

import { create } from 'zustand';

export type Overlay = 'task' | 'memory' | 'chat' | 'skip-warning' | null;

interface UIState {
  overlay: Overlay;
  hasUnreadMemory: boolean;

  openOverlay: (o: Exclude<Overlay, null>) => void;
  closeOverlay: () => void;
  setUnreadMemory: (v: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  overlay: null,
  hasUnreadMemory: false,

  openOverlay: (o) => set({ overlay: o }),
  closeOverlay: () => set({ overlay: null }),
  setUnreadMemory: (v) => set({ hasUnreadMemory: v }),
}));
