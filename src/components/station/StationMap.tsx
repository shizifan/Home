/**
 * 驿站地图（PRD §11.4 / §20.8）
 * 三个场景按解锁顺序展示，未解锁的灰 + 锁图标。
 */

'use client';

import clsx from 'clsx';
import type { StationStatusResponse } from '@/lib/api/client';

type Slot = 'visit' | 'school' | 'plaza';

const SLOTS: Array<{
  id: Slot;
  label: string;
  subtitle: string;
  icon: string;
  unlock_hint: string;
}> = [
  { id: 'visit', label: '朋友家', subtitle: '一对一', icon: '🏠', unlock_hint: '完成 7 天主流程' },
  { id: 'school', label: '学校', subtitle: '一对多', icon: '📚', unlock_hint: '先去 2 次朋友家' },
  { id: 'plaza', label: '小区广场', subtitle: '角色扮演', icon: '🎭', unlock_hint: '先去 1 次学校' },
];

interface Props {
  status: StationStatusResponse;
  onPick: (slot: Slot) => void;
}

export function StationMap({ status, onPick }: Props) {
  const limitText = status.today_used
    ? `今天已经出过门啦`
    : `今天还可以出门 ${status.today_limit} 次`;

  return (
    <div className="flex flex-col items-center gap-6 py-8">
      <h1 className="font-title text-h2 text-ink-1">伙伴驿站地图</h1>

      <div className="grid grid-cols-3 gap-3 w-full px-4">
        {SLOTS.map((s) => {
          const unlocked = status.unlocked[s.id];
          const used = status.today_used;
          const disabled = !unlocked || used;
          return (
            <button
              key={s.id}
              onClick={() => unlocked && !used && onPick(s.id)}
              disabled={disabled}
              aria-label={s.label}
              aria-disabled={disabled}
              className={clsx(
                'flex flex-col items-center justify-center gap-2 aspect-square rounded-card border-[1.5px] transition px-2 py-3',
                unlocked
                  ? 'bg-white border-ink-2 active:scale-[0.98]'
                  : 'bg-[rgba(95,94,90,0.06)] border-[rgba(95,94,90,0.18)]',
                used && unlocked && 'opacity-50',
              )}
            >
              <div className="relative text-[32px] leading-none">
                <span aria-hidden>{s.icon}</span>
                {!unlocked && (
                  <span
                    aria-hidden
                    className="absolute -bottom-1 -right-1 text-[14px]"
                  >
                    🔒
                  </span>
                )}
              </div>
              <div className="text-center">
                <p
                  className={clsx(
                    'font-title text-h3',
                    unlocked ? 'text-ink-1' : 'text-ink-3',
                  )}
                >
                  {s.label}
                </p>
                <p className="font-title text-mini text-ink-3 mt-0.5">
                  {unlocked ? s.subtitle : s.unlock_hint}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      <p
        className={clsx(
          'font-title text-small',
          status.today_used ? 'text-ink-3' : 'text-amber-mid',
        )}
      >
        {limitText}
      </p>
    </div>
  );
}
