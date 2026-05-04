/**
 * 等距房间 SVG 组件
 * 移植自 design/parts.jsx，PRD §9.5 房间设计规范。
 *
 * 投影：30° iso；ViewBox 600×600；3 块面板（后墙 / 左墙 / 地板）。
 * 后墙做了双 facet（左半 / 右半 #EFD4A0）增强纵深——这是
 * design 阶段的视觉推断（详见 design/Home Visual Design.html
 * 的 RationaleCard），PRD 仅规定单色后墙。
 */

import type { ReactNode } from 'react';

export interface PhotoStickerProps {
  x: number;
  y: number;
  rot?: number;
  label?: string;
  tone?: string; // 内层照片色块色（imageUrl 缺失时回退用）
  wall?: 'back' | 'left' | 'right';
  /** 真实贴图 URL（来自卡片 image_url）；缺失时画占位色块 */
  imageUrl?: string;
  /** 点击触发 — home 上用来打开查看浮层 */
  onClick?: () => void;
}

export interface FrameStickerProps {
  x: number;
  y: number;
  rot?: number;
  wall?: 'back' | 'left' | 'right';
}

export type FloorItemKind =
  | 'dumplings'
  | 'blocks'
  | 'plant'
  | 'ball'
  | 'book'
  | 'cake'
  | 'apple'
  | 'tv'
  | 'bed'
  | 'lamp'
  | 'rice_bowl'
  | 'noodle_bowl'
  | 'banana'
  | 'pizza'
  | 'doll'
  | 'car'
  | 'paint'
  | 'bag'
  | 'pencil'
  | 'bicycle';

export interface FloorItemProps {
  x: number;
  y: number;
  kind: FloorItemKind;
}

export interface CardStickerProps {
  x: number;
  y: number;
  rot?: number;
  wall?: 'back' | 'left' | 'right';
  /** 卡片贴图 URL */
  imageUrl?: string;
  /** 是否为文字降级卡片 */
  isFallback?: boolean;
  /** 点击触发 */
  onClick?: () => void;
}

export interface RoomProps {
  width?: number;
  height?: number;
  photos?: PhotoStickerProps[];
  /** V1.0：卡片贴纸（替换 PhotoSticker 渲染 cards） */
  cards?: CardStickerProps[];
  familyFrames?: FrameStickerProps[];
  items?: FloorItemProps[];
  /** 整体光线偏暖 / 偏冷（PRD §4.4 房间情绪映射） */
  mood?: 'neutral' | 'warm' | 'cool';
  children?: ReactNode;
}

export function Room({
  width = 600,
  height = 600,
  photos = [],
  cards = [],
  familyFrames = [],
  items = [],
  mood = 'neutral',
  children,
}: RoomProps) {
  const moodOverlay =
    mood === 'warm'
      ? 'rgba(250, 199, 117, 0.16)'
      : mood === 'cool'
        ? 'rgba(133, 183, 235, 0.16)'
        : 'transparent';

  return (
    <svg
      viewBox="0 0 600 600"
      width={width}
      height={height}
      style={{ display: 'block' }}
      aria-hidden
    >
      {/* 房间脚下软影 */}
      <ellipse cx="300" cy="555" rx="240" ry="14" fill="rgba(95,94,90,0.10)" />

      {/* 后墙 — 双 facet */}
      <polygon
        points="120,200 480,200 480,380 300,440 120,380"
        fill="var(--bg-back-wall)"
        stroke="var(--edge-warm)"
        strokeWidth="0.5"
      />
      <polygon
        points="120,200 300,140 480,200 480,380 300,440 120,380"
        fill="var(--bg-back-wall)"
      />
      <polygon points="120,200 300,140 300,440 120,380" fill="var(--bg-back-wall)" />
      <polygon points="300,140 480,200 480,380 300,440" fill="#EFD4A0" />

      {/* 左墙 */}
      <polygon
        points="60,260 120,200 120,380 60,440"
        fill="var(--bg-left-wall)"
        stroke="var(--edge-warm)"
        strokeWidth="0.5"
      />
      {/* 右墙（视觉过渡用） */}
      <polygon points="480,200 540,260 540,440 480,380" fill="#DFB880" />

      {/* 地板 */}
      <polygon
        points="60,440 300,560 540,440 300,440 120,380 480,380"
        fill="var(--bg-floor)"
        stroke="var(--edge-warm)"
        strokeWidth="0.5"
      />
      <polygon points="120,380 480,380 540,440 300,560 60,440" fill="var(--bg-floor)" />
      <polyline
        points="120,380 60,440"
        stroke="var(--edge-warm)"
        strokeWidth="1"
        fill="none"
        opacity="0.5"
      />
      <polyline
        points="480,380 540,440"
        stroke="var(--edge-warm)"
        strokeWidth="1"
        fill="none"
        opacity="0.5"
      />
      <polyline
        points="120,380 480,380"
        stroke="var(--edge-warm)"
        strokeWidth="1"
        fill="none"
        opacity="0.4"
      />

      {/* 地板纹理 */}
      {[0.2, 0.4, 0.6, 0.8].map((t) => {
        const x1 = 120 + (300 - 120) * t;
        const y1 = 380 + (560 - 380) * t * 0.667;
        const x2 = 480 - (480 - 300) * t;
        const y2 = 380 + (560 - 380) * t * 0.667;
        return (
          <line
            key={t}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="var(--edge-warm)"
            strokeWidth="0.4"
            opacity="0.25"
          />
        );
      })}

      {/* 元素 */}
      {photos.map((p, i) => (
        <PhotoSticker key={`p-${i}`} {...p} />
      ))}
      {cards?.map((c, i) => (
        <CardSticker key={`c-${i}`} {...c} />
      ))}
      {familyFrames.map((f, i) => (
        <FrameSticker key={`f-${i}`} {...f} />
      ))}
      {items.map((it, i) => (
        <FloorItem key={`i-${i}`} {...it} />
      ))}

      {children}

      {/* 情绪叠层（warm / cool） */}
      {mood !== 'neutral' && (
        <rect x="0" y="0" width="600" height="600" fill={moodOverlay} pointerEvents="none" />
      )}
    </svg>
  );
}

/** V1.0 卡片贴纸（CardSticker, Plan_02 §7.2）
 *
 * 40×50px（含 4px 白边），内层插画 32×32px。
 * 右下角 6px ✏️ 图标暗示"是描述生成的"。
 */
export function CardSticker({
  x,
  y,
  rot = -4,
  wall = 'back',
  imageUrl,
  isFallback,
  onClick,
}: CardStickerProps) {
  const skew = wall === 'left' ? -18 : wall === 'right' ? 18 : 0;
  const clipId = `cs-clip-${Math.round(x)}-${Math.round(y)}`;
  return (
    <g
      transform={`translate(${x},${y}) rotate(${rot}) skewY(${skew})`}
      onClick={onClick}
      style={onClick ? { cursor: 'pointer' } : undefined}
      role={onClick ? 'button' : undefined}
    >
      {/* 白边卡片 */}
      <rect x="-20" y="-25" width="40" height="50" fill="#FFF" stroke="#5F5E5A" strokeWidth="0.8" rx="2" />
      {imageUrl ? (
        <>
          <defs>
            <clipPath id={clipId}>
              <rect x="-16" y="-21" width="32" height="32" rx="1" />
            </clipPath>
          </defs>
          <image
            href={imageUrl}
            x="-16"
            y="-21"
            width="32"
            height="32"
            preserveAspectRatio="xMidYMid slice"
            clipPath={`url(#${clipId})`}
          />
        </>
      ) : (
        <rect x="-16" y="-21" width="32" height="32" fill={isFallback ? '#FEF9E7' : '#F5DEB3'} rx="1" />
      )}
      {/* ✏️ 右下角标识 */}
      <text
        x="12"
        y="19"
        fontSize="6"
        fill="#5F5E5A"
        opacity="0.6"
        textAnchor="middle"
        fontFamily="sans-serif"
        aria-hidden
      >
        ✏️
      </text>
    </g>
  );
}

/** 墙上贴纸（PRD §9.6 照片贴纸） */
export function PhotoSticker({
  x,
  y,
  rot = -4,
  label = '',
  tone = '#E8C896',
  wall = 'back',
  imageUrl,
  onClick,
}: PhotoStickerProps) {
  const skew = wall === 'left' ? -18 : wall === 'right' ? 18 : 0;
  // 给每张贴纸生成一个稳定 clipPath id，避免 SVG <image> 画到边框外
  const clipId = `ps-clip-${Math.round(x)}-${Math.round(y)}`;
  return (
    <g
      transform={`translate(${x},${y}) rotate(${rot}) skewY(${skew})`}
      onClick={onClick}
      style={onClick ? { cursor: 'pointer' } : undefined}
      role={onClick ? 'button' : undefined}
    >
      <rect x="-22" y="-26" width="44" height="52" fill="#FFF" stroke="#5F5E5A" strokeWidth="0.8" />
      {imageUrl ? (
        <>
          <defs>
            <clipPath id={clipId}>
              <rect x="-18" y="-22" width="36" height="36" />
            </clipPath>
          </defs>
          <image
            href={imageUrl}
            x="-18"
            y="-22"
            width="36"
            height="36"
            preserveAspectRatio="xMidYMid slice"
            clipPath={`url(#${clipId})`}
          />
        </>
      ) : (
        <>
          <rect x="-18" y="-22" width="36" height="36" fill={tone} />
          <line x1="-18" y1="-14" x2="18" y2="-14" stroke="rgba(95,94,90,0.25)" strokeWidth="0.6" />
          <line x1="-18" y1="-6" x2="18" y2="-6" stroke="rgba(95,94,90,0.25)" strokeWidth="0.6" />
          <line x1="-18" y1="2" x2="18" y2="2" stroke="rgba(95,94,90,0.25)" strokeWidth="0.6" />
          <line x1="-18" y1="10" x2="18" y2="10" stroke="rgba(95,94,90,0.25)" strokeWidth="0.6" />
        </>
      )}
      {label && (
        <text x="0" y="22" textAnchor="middle" fontSize="6" fill="#5F5E5A" fontFamily="var(--f-num)">
          {label}
        </text>
      )}
    </g>
  );
}

/** 家人占位相框（PRD §9.6 简笔人像） */
export function FrameSticker({ x, y, rot = -2, wall = 'back' }: FrameStickerProps) {
  const skew = wall === 'left' ? -18 : wall === 'right' ? 18 : 0;
  return (
    <g transform={`translate(${x},${y}) rotate(${rot}) skewY(${skew})`}>
      <rect x="-18" y="-24" width="36" height="48" fill="#fff" stroke="#5F5E5A" strokeWidth="0.8" />
      <rect x="-14" y="-20" width="28" height="40" fill="#FAC775" />
      <circle cx="0" cy="-7" r="5" fill="#A8773D" />
      <path d="M-7 0 L7 0 L5 12 L-5 12 Z" fill="#9B6B45" />
    </g>
  );
}

/**
 * 地板物品图标
 * MVP 阶段先实现 design/parts.jsx 已有的 3 类（饺子 / 积木 / 绿植），
 * 其余 PRD §9.6 列出的 ~30 类作为 P0-1.5 的后续任务。
 */
export function FloorItem({ x, y, kind }: FloorItemProps) {
  const stroke = '#5F5E5A';
  if (kind === 'dumplings')
    return (
      <g transform={`translate(${x},${y})`}>
        <ellipse cx="0" cy="4" rx="20" ry="6" fill="rgba(0,0,0,0.08)" />
        <path d="M-18 -2 Q0 -14 18 -2 L16 4 Q0 8 -16 4 Z" fill="#F5DEB3" stroke={stroke} strokeWidth="1" />
        <ellipse cx="-9" cy="-4" rx="5" ry="4" fill="#FFF" stroke={stroke} strokeWidth="0.8" />
        <ellipse cx="0" cy="-7" rx="5" ry="4" fill="#FFF" stroke={stroke} strokeWidth="0.8" />
        <ellipse cx="9" cy="-4" rx="5" ry="4" fill="#FFF" stroke={stroke} strokeWidth="0.8" />
        <path d="M-12 -5 L-6 -3 M-3 -8 L3 -6 M6 -5 L12 -3" stroke={stroke} strokeWidth="0.6" fill="none" />
      </g>
    );
  if (kind === 'blocks')
    return (
      <g transform={`translate(${x},${y})`}>
        <ellipse cx="0" cy="6" rx="18" ry="5" fill="rgba(0,0,0,0.08)" />
        <rect x="-12" y="-2" width="12" height="10" fill="#D4537E" stroke={stroke} strokeWidth="1" />
        <rect x="0" y="-2" width="12" height="10" fill="#85B7EB" stroke={stroke} strokeWidth="1" />
        <rect x="-6" y="-12" width="12" height="10" fill="#FAC775" stroke={stroke} strokeWidth="1" />
        <circle cx="-6" cy="3" r="1.5" fill="#fff" />
        <circle cx="6" cy="3" r="1.5" fill="#fff" />
        <circle cx="0" cy="-7" r="1.5" fill="#fff" />
      </g>
    );
  if (kind === 'plant')
    return (
      <g transform={`translate(${x},${y})`}>
        <ellipse cx="0" cy="14" rx="14" ry="4" fill="rgba(0,0,0,0.08)" />
        <path d="M-9 14 L9 14 L7 4 L-7 4 Z" fill="#A8773D" stroke={stroke} strokeWidth="1" />
        <path d="M0 4 Q-12 -4 -8 -16 Q0 -10 0 4 Z" fill="#1D9E75" stroke={stroke} strokeWidth="1" />
        <path d="M0 4 Q12 -2 10 -14 Q2 -8 0 4 Z" fill="#97C459" stroke={stroke} strokeWidth="1" />
      </g>
    );
  if (kind === 'apple')
    return (
      <g transform={`translate(${x},${y})`}>
        <ellipse cx="0" cy="6" rx="10" ry="3" fill="rgba(0,0,0,0.08)" />
        <path d="M-8 0 Q-8 -10 0 -10 Q8 -10 8 0 Q8 7 0 8 Q-8 7 -8 0 Z" fill="#D4537E" stroke={stroke} strokeWidth="1" />
        <path d="M0 -10 Q1 -14 5 -14" stroke="#3B6D11" strokeWidth="1.5" fill="none" />
      </g>
    );
  if (kind === 'cake')
    return (
      <g transform={`translate(${x},${y})`}>
        <ellipse cx="0" cy="6" rx="14" ry="3" fill="rgba(0,0,0,0.08)" />
        <rect x="-12" y="-2" width="24" height="8" fill="#F4C0D1" stroke={stroke} strokeWidth="1" />
        <rect x="-12" y="-8" width="24" height="6" fill="#FFFFFF" stroke={stroke} strokeWidth="1" />
        <rect x="-1" y="-14" width="2" height="6" fill="#FAC775" stroke={stroke} strokeWidth="0.8" />
        <path d="M0 -16 L1 -14 L-1 -14 Z" fill="#FF9933" />
      </g>
    );
  if (kind === 'book')
    return (
      <g transform={`translate(${x},${y})`}>
        <ellipse cx="0" cy="6" rx="12" ry="3" fill="rgba(0,0,0,0.08)" />
        <rect x="-10" y="-8" width="20" height="14" fill="#85B7EB" stroke={stroke} strokeWidth="1" />
        <line x1="0" y1="-8" x2="0" y2="6" stroke={stroke} strokeWidth="0.8" />
        <line x1="-7" y1="-3" x2="-3" y2="-3" stroke="#FFFFFF" strokeWidth="0.6" />
        <line x1="3" y1="-3" x2="7" y2="-3" stroke="#FFFFFF" strokeWidth="0.6" />
      </g>
    );
  if (kind === 'ball')
    return (
      <g transform={`translate(${x},${y})`}>
        <ellipse cx="0" cy="6" rx="9" ry="2" fill="rgba(0,0,0,0.08)" />
        <circle cx="0" cy="0" r="9" fill="#FAC775" stroke={stroke} strokeWidth="1" />
        <path d="M-9 0 Q-3 -3 3 0 Q9 3 9 0" stroke={stroke} strokeWidth="0.7" fill="none" />
      </g>
    );
  if (kind === 'rice_bowl' || kind === 'noodle_bowl')
    return (
      <g transform={`translate(${x},${y})`}>
        <ellipse cx="0" cy="6" rx="14" ry="3" fill="rgba(0,0,0,0.08)" />
        <path d="M-12 -2 Q0 -10 12 -2 L10 4 Q0 6 -10 4 Z" fill="#FFFFFF" stroke={stroke} strokeWidth="1" />
        <ellipse cx="0" cy="-2" rx="11" ry="3" fill={kind === 'rice_bowl' ? '#FFFFFF' : '#FAC775'} stroke={stroke} strokeWidth="0.6" />
      </g>
    );
  if (kind === 'banana')
    return (
      <g transform={`translate(${x},${y})`}>
        <ellipse cx="0" cy="6" rx="12" ry="3" fill="rgba(0,0,0,0.08)" />
        <path d="M-12 -2 Q0 -8 12 0 Q12 4 8 4 Q0 -4 -12 2 Z" fill="#FAC775" stroke={stroke} strokeWidth="1" />
      </g>
    );
  if (kind === 'pizza')
    return (
      <g transform={`translate(${x},${y})`}>
        <ellipse cx="0" cy="6" rx="13" ry="3" fill="rgba(0,0,0,0.08)" />
        <path d="M-12 -2 L12 -2 L0 8 Z" fill="#FAC775" stroke={stroke} strokeWidth="1" />
        <circle cx="-3" cy="0" r="1.5" fill="#D4537E" />
        <circle cx="3" cy="0" r="1.5" fill="#D4537E" />
        <circle cx="0" cy="3" r="1.2" fill="#D4537E" />
      </g>
    );
  if (kind === 'doll')
    return (
      <g transform={`translate(${x},${y})`}>
        <ellipse cx="0" cy="10" rx="9" ry="2.5" fill="rgba(0,0,0,0.08)" />
        <circle cx="0" cy="-6" r="6" fill="#F4C0D1" stroke={stroke} strokeWidth="1" />
        <rect x="-5" y="-1" width="10" height="11" fill="#D4537E" stroke={stroke} strokeWidth="1" />
        <circle cx="-2" cy="-7" r="1" fill="#2C2C2A" />
        <circle cx="2" cy="-7" r="1" fill="#2C2C2A" />
      </g>
    );
  if (kind === 'car')
    return (
      <g transform={`translate(${x},${y})`}>
        <ellipse cx="0" cy="6" rx="14" ry="3" fill="rgba(0,0,0,0.08)" />
        <rect x="-12" y="-3" width="24" height="7" fill="#85B7EB" stroke={stroke} strokeWidth="1" rx="2" />
        <rect x="-8" y="-7" width="16" height="5" fill="#9FE1CB" stroke={stroke} strokeWidth="1" rx="1" />
        <circle cx="-7" cy="5" r="2" fill="#2C2C2A" />
        <circle cx="7" cy="5" r="2" fill="#2C2C2A" />
      </g>
    );
  if (kind === 'paint')
    return (
      <g transform={`translate(${x},${y})`}>
        <ellipse cx="0" cy="6" rx="9" ry="2" fill="rgba(0,0,0,0.08)" />
        <rect x="-2" y="-12" width="4" height="14" fill="#A8773D" stroke={stroke} strokeWidth="0.8" />
        <path d="M-3 -12 L3 -12 L4 -16 L-4 -16 Z" fill="#D4537E" stroke={stroke} strokeWidth="0.8" />
      </g>
    );
  if (kind === 'bag')
    return (
      <g transform={`translate(${x},${y})`}>
        <ellipse cx="0" cy="8" rx="10" ry="2.5" fill="rgba(0,0,0,0.08)" />
        <rect x="-9" y="-6" width="18" height="14" rx="2" fill="#1D9E75" stroke={stroke} strokeWidth="1" />
        <path d="M-5 -6 Q-5 -12 0 -12 Q5 -12 5 -6" stroke={stroke} strokeWidth="1" fill="none" />
      </g>
    );
  if (kind === 'pencil')
    return (
      <g transform={`translate(${x},${y})`}>
        <ellipse cx="0" cy="6" rx="11" ry="2" fill="rgba(0,0,0,0.08)" />
        <rect x="-10" y="0" width="18" height="3" fill="#FAC775" stroke={stroke} strokeWidth="0.8" />
        <path d="M8 0 L13 1.5 L8 3 Z" fill="#A8773D" stroke={stroke} strokeWidth="0.8" />
      </g>
    );
  if (kind === 'bicycle')
    return (
      <g transform={`translate(${x},${y})`}>
        <ellipse cx="0" cy="8" rx="14" ry="2.5" fill="rgba(0,0,0,0.08)" />
        <circle cx="-7" cy="2" r="5" fill="none" stroke={stroke} strokeWidth="1.2" />
        <circle cx="7" cy="2" r="5" fill="none" stroke={stroke} strokeWidth="1.2" />
        <path d="M-7 2 L0 -5 L7 2" stroke="#85B7EB" strokeWidth="1.5" fill="none" />
        <line x1="-2" y1="-5" x2="2" y2="-5" stroke="#85B7EB" strokeWidth="1.5" />
      </g>
    );
  if (kind === 'tv')
    return (
      <g transform={`translate(${x},${y})`}>
        <ellipse cx="0" cy="8" rx="14" ry="2.5" fill="rgba(0,0,0,0.08)" />
        <rect x="-12" y="-8" width="24" height="14" fill="#2C2C2A" stroke={stroke} strokeWidth="1" rx="1" />
        <rect x="-10" y="-6" width="20" height="10" fill="#85B7EB" />
        <rect x="-3" y="6" width="6" height="2" fill="#5F5E5A" />
      </g>
    );
  if (kind === 'bed')
    return (
      <g transform={`translate(${x},${y})`}>
        <ellipse cx="0" cy="8" rx="18" ry="3" fill="rgba(0,0,0,0.08)" />
        <rect x="-16" y="-2" width="32" height="8" fill="#85B7EB" stroke={stroke} strokeWidth="1" />
        <rect x="-16" y="-6" width="32" height="4" fill="#FFFFFF" stroke={stroke} strokeWidth="1" />
        <rect x="-14" y="-9" width="8" height="3" fill="#FFFFFF" stroke={stroke} strokeWidth="0.8" />
      </g>
    );
  if (kind === 'lamp')
    return (
      <g transform={`translate(${x},${y})`}>
        <ellipse cx="0" cy="8" rx="9" ry="2" fill="rgba(0,0,0,0.08)" />
        <rect x="-1" y="-2" width="2" height="10" fill="#A8773D" stroke={stroke} strokeWidth="0.6" />
        <path d="M-7 -2 L7 -2 L5 -10 L-5 -10 Z" fill="#FAC775" stroke={stroke} strokeWidth="1" />
      </g>
    );
  return null;
}
