/**
 * FallbackTextCard — 文字降级卡片（V0.6.1 §4.4.5）
 *
 * 风格审核 / 内容审核 / 重做次数耗尽时使用。
 * 视觉上保持纸片样式（白边 + 微旋转）但内容是孩子原始描述文字。
 * 文案："这次它脑子有点乱，画不出来。但你说的它都记住了。"
 */

'use client';

interface Props {
  description: string;
  /** 微旋转角度（默认 -2deg）*/
  rotate?: number;
  /** 容器宽度（默认 280px）*/
  width?: number;
  /** 是否大尺寸（卡片确认页用，墙上贴纸用小尺寸）*/
  large?: boolean;
}

export function FallbackTextCard({ description, rotate = -2, width, large }: Props) {
  const w = width ?? (large ? 280 : 80);
  const h = large ? Math.round(w * 1.25) : Math.round(w * 1.25);

  return (
    <div
      className="relative inline-block"
      style={{
        transform: `rotate(${rotate}deg)`,
        width: w,
      }}
    >
      <div
        className="bg-white shadow-paper border-[1.5px] border-[#D3D1C7] rounded-[8px] flex flex-col items-center justify-center px-3 py-3"
        style={{ width: w, height: h }}
      >
        {large ? (
          <>
            <span className="font-title text-mini text-ink-3 mb-2">📝</span>
            <p className="font-title text-body text-ink-1 leading-[1.7] text-center whitespace-pre-wrap break-words overflow-hidden">
              {description}
            </p>
          </>
        ) : (
          <p className="font-title text-mini text-ink-1 leading-[1.4] text-center whitespace-pre-wrap break-words line-clamp-4">
            {description.slice(0, 40)}
          </p>
        )}
      </div>
    </div>
  );
}
