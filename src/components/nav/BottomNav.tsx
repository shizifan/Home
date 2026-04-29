/**
 * 主页底部 4 Tab 导航（PRD §10.2）
 * 顺序：今日任务 / 它的脑袋（红点）/ 日记 / 设置
 */

'use client';

import clsx from 'clsx';

export type NavTab = 'task' | 'brain' | 'diary' | 'gear';

interface Props {
  active?: NavTab;
  hasTaskBadge?: boolean;
  hasBrainRedDot?: boolean;
  onTask?: () => void;
  onBrain?: () => void;
  onDiary?: () => void;
  onGear?: () => void;
}

export function BottomNav({
  active,
  hasTaskBadge,
  hasBrainRedDot,
  onTask,
  onBrain,
  onDiary,
  onGear,
}: Props) {
  return (
    <nav
      className={clsx(
        'absolute left-0 right-0 bottom-0 h-[84px] pb-[18px]',
        'bg-[#FFF8EA] border-t border-[rgba(95,94,90,0.15)]',
        'grid grid-cols-4',
      )}
      aria-label="底部导航"
    >
      <NavBtn icon="task" label="今日任务" active={active === 'task'} badge={hasTaskBadge ? 1 : 0} onClick={onTask} />
      <NavBtn icon="brain" label="它的脑袋" active={active === 'brain'} reddot={hasBrainRedDot} onClick={onBrain} />
      <NavBtn icon="diary" label="日记" active={active === 'diary'} onClick={onDiary} />
      <NavBtn icon="gear" label="设置" active={active === 'gear'} onClick={onGear} />
    </nav>
  );
}

interface NavBtnProps {
  icon: NavTab;
  label: string;
  active?: boolean;
  badge?: number;
  reddot?: boolean;
  onClick?: () => void;
}

function NavBtn({ icon, label, active, badge, reddot, onClick }: NavBtnProps) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1 pt-2 pb-1 relative cursor-pointer bg-transparent border-0"
    >
      <span className="relative inline-block w-[30px] h-[30px]">
        <NavIcon kind={icon} />
        {reddot && (
          <span className="absolute top-0 -right-0.5 w-[9px] h-[9px] bg-red-dot rounded-full border-[1.5px] border-[#FFF8EA]" />
        )}
        {badge ? (
          <span className="absolute -top-0.5 -right-1 w-4 h-4 bg-amber-light text-amber-deep rounded-full text-[10px] font-bold font-num flex items-center justify-center">
            {badge}
          </span>
        ) : null}
      </span>
      <span className={clsx('font-title text-mini', active ? 'text-ink-1 font-medium' : 'text-ink-2')}>{label}</span>
    </button>
  );
}

function NavIcon({ kind }: { kind: NavTab }) {
  if (kind === 'task') {
    return (
      <svg viewBox="0 0 30 30" width="30" height="30" aria-hidden>
        <rect x="6" y="5" width="18" height="20" rx="3" fill="#FAC775" stroke="#5F5E5A" strokeWidth="1.5" />
        <path d="M10 12 L13 15 L20 9" stroke="#5F5E5A" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        <line x1="10" y1="19" x2="20" y2="19" stroke="#5F5E5A" strokeWidth="1.2" />
      </svg>
    );
  }
  if (kind === 'brain') {
    return (
      <svg viewBox="0 0 30 30" width="30" height="30" aria-hidden>
        <path
          d="M15 5 Q8 5 7 12 Q4 14 5 18 Q5 22 9 22 Q9 26 14 26 Q15 26 15 24 L15 5 Z"
          fill="#F0997B"
          stroke="#5F5E5A"
          strokeWidth="1.5"
        />
        <path
          d="M15 5 Q22 5 23 12 Q26 14 25 18 Q25 22 21 22 Q21 26 16 26 Q15 26 15 24 L15 5 Z"
          fill="#F0997B"
          stroke="#5F5E5A"
          strokeWidth="1.5"
        />
        <path d="M11 12 Q13 14 11 16 M19 12 Q17 14 19 16" stroke="#5F5E5A" strokeWidth="1" fill="none" />
      </svg>
    );
  }
  if (kind === 'diary') {
    return (
      <svg viewBox="0 0 30 30" width="30" height="30" aria-hidden>
        <rect x="7" y="5" width="16" height="20" rx="2" fill="#9FE1CB" stroke="#5F5E5A" strokeWidth="1.5" />
        <line x1="11" y1="11" x2="19" y2="11" stroke="#5F5E5A" strokeWidth="1.2" />
        <line x1="11" y1="15" x2="19" y2="15" stroke="#5F5E5A" strokeWidth="1.2" />
        <line x1="11" y1="19" x2="17" y2="19" stroke="#5F5E5A" strokeWidth="1.2" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 30 30" width="30" height="30" aria-hidden>
      <circle cx="15" cy="15" r="4" fill="none" stroke="#5F5E5A" strokeWidth="1.5" />
      <circle cx="15" cy="15" r="9" fill="none" stroke="#5F5E5A" strokeWidth="1.5" strokeDasharray="2 3" />
    </svg>
  );
}
