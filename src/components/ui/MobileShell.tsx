/**
 * 移动端壳：状态栏 + 安全区
 * 设计基准：iPhone 13 / 14 (390×844)。在桌面上居中限宽 430px 模拟手机。
 */

import type { ReactNode } from 'react';

interface MobileShellProps {
  children: ReactNode;
  /** 是否渲染顶部 9:41 状态栏。引导/启动页一般不渲染。 */
  showStatusBar?: boolean;
}

export function MobileShell({ children, showStatusBar = true }: MobileShellProps) {
  return (
    <div className="min-h-dvh bg-bg-base flex justify-center">
      <div className="viewport-lock w-full max-w-[430px] min-h-dvh bg-bg-base relative overflow-hidden">
        {showStatusBar && <IOSStatusBar />}
        {children}
      </div>
    </div>
  );
}

function IOSStatusBar() {
  return (
    <div className="h-11 flex items-center justify-between px-6 font-num font-semibold text-sub text-ink-1">
      <span>9:41</span>
      <span className="flex items-center gap-1">
        {/* 信号 */}
        <span className="flex items-end gap-[2px]" aria-hidden>
          {[3, 5, 7, 9].map((h) => (
            <span key={h} className="bg-ink-1" style={{ width: 3, height: h }} />
          ))}
        </span>
        {/* WiFi */}
        <svg width="14" height="10" viewBox="0 0 14 10" aria-hidden>
          <path d="M7 9 a1 1 0 100-2 1 1 0 000 2z M3 5 Q7 1 11 5 M1 3 Q7 -3 13 3" stroke="#2C2C2A" strokeWidth="1.2" fill="none" strokeLinecap="round" />
        </svg>
        {/* 电池 */}
        <span className="relative inline-block w-4 h-[10px] border-[1.5px] border-ink-1 rounded-[2px]">
          <span className="absolute inset-[1px] bg-ink-1" style={{ width: '70%' }} />
          <span className="absolute -right-[3px] top-[3px] w-[2px] h-1 bg-ink-1 rounded-r-[1px]" />
        </span>
      </span>
    </div>
  );
}
