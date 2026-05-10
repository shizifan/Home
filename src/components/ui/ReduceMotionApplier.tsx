/**
 * 把 companionStore.reduceMotion 应用到 <html class="reduce-motion">
 * 全局 CSS 规则会拦截所有动画时长（globals.css）。
 *
 * 单纯订阅 store + 改 className，无 UI。
 */

'use client';

import { useEffect } from 'react';
import { useCompanionStore } from '@/stores/companionStore';

export function ReduceMotionApplier() {
  const reduceMotion = useCompanionStore((s) => s.reduceMotion);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.classList.toggle('reduce-motion', reduceMotion);
  }, [reduceMotion]);

  return null;
}
