/**
 * LocalStorage 持久化垫片
 * P1 阶段无 Supabase 时的过渡存储。Zustand persist middleware 用它做 storage adapter。
 *
 * 切真 Supabase 后：把 store 的 storage 换成 server-driven，
 * 仍保留这层做"未登录态草稿"用（如 Auth 完成前的引导进度）。
 */

import type { StateStorage } from 'zustand/middleware';

const PREFIX = 'home:';

export const localJSONStorage: StateStorage = {
  getItem: (name) => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(PREFIX + name);
  },
  setItem: (name, value) => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(PREFIX + name, value);
  },
  removeItem: (name) => {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(PREFIX + name);
  },
};

export function clearAllLocal() {
  if (typeof window === 'undefined') return;
  Object.keys(window.localStorage)
    .filter((k) => k.startsWith(PREFIX))
    .forEach((k) => window.localStorage.removeItem(k));
}
