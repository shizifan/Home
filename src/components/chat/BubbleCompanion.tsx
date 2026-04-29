/**
 * 伙伴气泡（左侧）
 * - 同一连续伙伴气泡组只在最后一个气泡上方显示一次伙伴名（不显示头像，按计划 §5.3）
 * - source = 'fallback' 时虚线描边 + 小注 "（它有点累）"
 * - source = 'preset_open_day1' 时灰底（"初次见面"）
 */

import clsx from 'clsx';

interface Props {
  content: string;
  source: string;
  companionName: string;
  /** 是否是这一组连续伙伴气泡的最后一条（决定是否显示名签）*/
  isGroupTail?: boolean;
}

export function BubbleCompanion({ content, source, companionName, isGroupTail }: Props) {
  const isPreset = source.startsWith('preset_open');
  const isFallback = source === 'fallback';

  return (
    <div className="flex flex-col items-start max-w-[78%] mb-1.5">
      <div
        className={clsx(
          'rounded-2xl rounded-tl-md px-4 py-2.5',
          'border-[1.2px]',
          isPreset && 'bg-[#FFF8EA] border-[#5F5E5A]',
          !isPreset && !isFallback && 'bg-white border-[#5F5E5A]',
          isFallback && 'bg-white border-[#888780] border-dashed',
        )}
      >
        <p
          className={clsx(
            'font-title text-body leading-[1.55]',
            isFallback ? 'text-ink-2' : 'text-ink-1',
          )}
        >
          {content}
        </p>
        {isFallback && (
          <p className="font-title text-mini text-ink-3 mt-1">（它有点累）</p>
        )}
      </div>
      {isGroupTail && (
        <span className="font-title text-mini text-ink-3 mt-1 ml-2">{companionName}</span>
      )}
    </div>
  );
}
