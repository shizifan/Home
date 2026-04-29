/**
 * 7 个未交付立绘的占位符
 * 仅 MVP P0 占位用，使用 PRD §9.2 角色色板的 main/sec/line + 圆形剪影。
 *
 * P0-1.4 待真稿：由设计师按 design/parts.jsx 中小青龙的 paper-mario 规格
 * 输出剩余 7 个伙伴的站坐躺三视图。完成后用 import 替换此组件即可。
 */

import { COMPANION_PALETTE, type CompanionPresetId, type CompanionVisualProps } from './types';

export function CompanionPlaceholder({
  presetId,
  pose = 'stand',
  size = 200,
}: CompanionVisualProps & { presetId: CompanionPresetId }) {
  const palette = COMPANION_PALETTE[presetId];
  const w = size;
  const h = size * 1.33;

  // 三种姿态用相同圆形剪影 + 微调比例
  const bodyScale = pose === 'lie' ? 1.15 : 1;
  const verticalShift = pose === 'sit' ? 20 : pose === 'lie' ? 60 : 0;

  return (
    <svg
      viewBox="0 0 200 267"
      width={w}
      height={h}
      style={{ display: 'block', overflow: 'visible' }}
      aria-hidden
      data-placeholder
    >
      <defs>
        <filter id={`ph-shadow-${presetId}`} x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="3" stdDeviation="2" floodColor="#000" floodOpacity="0.12" />
        </filter>
      </defs>
      <g
        filter={`url(#ph-shadow-${presetId})`}
        transform={`translate(0, ${verticalShift}) scale(${bodyScale})`}
      >
        {/* 脚 */}
        {pose !== 'lie' && (
          <>
            <ellipse cx="75" cy="220" rx="14" ry="8" fill={palette.sec} stroke="#FFFFFF" strokeWidth="3" />
            <ellipse cx="125" cy="220" rx="14" ry="8" fill={palette.sec} stroke="#FFFFFF" strokeWidth="3" />
          </>
        )}
        {/* 身体 */}
        <ellipse
          cx="100"
          cy="170"
          rx="60"
          ry="50"
          fill={palette.main}
          stroke="#FFFFFF"
          strokeWidth="4"
          paintOrder="stroke"
        />
        {/* 头 */}
        <circle
          cx="100"
          cy="80"
          r="55"
          fill={palette.main}
          stroke="#FFFFFF"
          strokeWidth="4"
          paintOrder="stroke"
        />
        {/* 腹部高光 */}
        <ellipse cx="100" cy="180" rx="35" ry="22" fill={palette.belly ?? palette.sec} opacity={0.5} />
        {/* 眼 */}
        {pose === 'lie' ? (
          <>
            <path d="M75 75 Q83 80 91 75" stroke={palette.line} strokeWidth="2" fill="none" strokeLinecap="round" />
            <path d="M109 75 Q117 80 125 75" stroke={palette.line} strokeWidth="2" fill="none" strokeLinecap="round" />
          </>
        ) : (
          <>
            <ellipse cx="80" cy="75" rx="5" ry="6" fill="#2C2C2A" />
            <ellipse cx="120" cy="75" rx="5" ry="6" fill="#2C2C2A" />
            <circle cx="81.5" cy="73" r="1.4" fill="#fff" />
            <circle cx="121.5" cy="73" r="1.4" fill="#fff" />
          </>
        )}
        {/* 嘴 */}
        <path d="M92 95 Q100 100 108 95" stroke={palette.line} strokeWidth="1.5" fill="none" strokeLinecap="round" />
      </g>
    </svg>
  );
}
