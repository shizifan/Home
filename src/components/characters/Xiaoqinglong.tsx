/**
 * 小青龙立绘 — Paper Mario 风格扁平剪纸
 * 移植自 design/parts.jsx，PRD §9.4 角色设计规范。
 *
 * 特征：浅米灰主体 + 深灰角 + 圆头大、四肢短、长尾巴。
 * 单层色块 + 2px 米白纸边 + 内部 1.2px 棕灰细线。
 */

import type { CompanionVisualProps, Pose } from './types';

const PE = {
  stroke: '#FFFFFF',
  strokeWidth: 4,
  strokeLinejoin: 'round' as const,
  strokeLinecap: 'round' as const,
};
const PEinner = {
  stroke: '#5F5E5A',
  strokeWidth: 1.2,
  fill: 'none',
  strokeLinejoin: 'round' as const,
};

const MAIN = '#D3D1C7';
const SEC = '#888780';
const HORN = '#6B6A66';
const BELLY = '#E8E6DD';

export function Xiaoqinglong({ pose = 'stand', size = 200 }: CompanionVisualProps) {
  const w = size;
  const h = size * 1.33;
  return (
    <svg
      viewBox="0 0 200 267"
      width={w}
      height={h}
      style={{ display: 'block', overflow: 'visible' }}
      aria-hidden
    >
      <defs>
        <filter id="paperShadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="3" stdDeviation="2" floodColor="#000" floodOpacity="0.12" />
        </filter>
      </defs>
      {pose === 'stand' && <Stand />}
      {pose === 'sit' && <Sit />}
      {pose === 'lie' && <Lie />}
    </svg>
  );
}

function Stand() {
  return (
    <g filter="url(#paperShadow)">
      {/* 尾巴（身后） */}
      <path
        d="M138 175 Q170 165 175 130 Q175 110 160 105 Q150 108 152 122 Q156 150 138 168 Z"
        fill={MAIN}
        {...PE}
        paintOrder="stroke"
      />
      {/* 后腿 */}
      <path
        d="M68 200 Q60 220 64 250 Q68 258 80 257 Q88 254 86 240 L84 215 Z"
        fill={SEC}
        {...PE}
        paintOrder="stroke"
      />
      <path
        d="M120 200 Q116 222 122 250 Q128 258 140 257 Q148 254 144 240 L140 215 Z"
        fill={SEC}
        {...PE}
        paintOrder="stroke"
      />
      {/* 身体 */}
      <path
        d="M55 170 Q50 130 78 110 Q120 100 145 120 Q155 155 145 195 Q120 215 88 213 Q60 205 55 170 Z"
        fill={MAIN}
        {...PE}
        paintOrder="stroke"
      />
      <path d="M82 165 Q100 150 125 165 Q128 195 105 200 Q82 198 82 165 Z" fill={BELLY} />
      {/* 前臂 */}
      <path
        d="M76 170 Q66 178 70 195 Q78 200 84 192 Q86 180 82 170 Z"
        fill={MAIN}
        {...PE}
        paintOrder="stroke"
      />
      {/* 头 */}
      <path
        d="M48 80 Q40 30 95 22 Q150 28 152 75 Q150 115 100 120 Q52 118 48 80 Z"
        fill={MAIN}
        {...PE}
        paintOrder="stroke"
      />
      {/* 角 */}
      <path d="M82 26 Q78 6 88 4 Q96 8 92 28 Z" fill={HORN} {...PE} paintOrder="stroke" />
      <path d="M118 24 Q114 4 124 2 Q132 6 128 28 Z" fill={HORN} {...PE} paintOrder="stroke" />
      {/* 颊毛 */}
      <path d="M55 90 Q60 100 70 100" {...PEinner} />
      {/* 眼 */}
      <ellipse cx="78" cy="72" rx="4.5" ry="5.5" fill="#2C2C2A" />
      <ellipse cx="118" cy="72" rx="4.5" ry="5.5" fill="#2C2C2A" />
      <circle cx="79.5" cy="70" r="1.2" fill="#fff" />
      <circle cx="119.5" cy="70" r="1.2" fill="#fff" />
      {/* 嘴 */}
      <path d="M92 92 Q100 96 108 92" {...PEinner} strokeWidth={1.5} />
      <path d="M88 85 Q100 88 112 85" {...PEinner} strokeWidth={0.8} opacity={0.5} />
    </g>
  );
}

function Sit() {
  return (
    <g filter="url(#paperShadow)">
      <path
        d="M40 220 Q15 215 18 185 Q28 170 45 180 Q55 200 45 218 Z"
        fill={MAIN}
        {...PE}
        paintOrder="stroke"
      />
      <path
        d="M70 220 Q60 245 80 252 Q105 252 100 230 L92 215 Z"
        fill={SEC}
        {...PE}
        paintOrder="stroke"
      />
      <path
        d="M110 220 Q108 245 130 252 Q150 250 145 228 L130 215 Z"
        fill={SEC}
        {...PE}
        paintOrder="stroke"
      />
      <path
        d="M50 180 Q42 140 80 125 Q130 122 150 150 Q160 195 130 215 Q90 222 60 215 Q48 200 50 180 Z"
        fill={MAIN}
        {...PE}
        paintOrder="stroke"
      />
      <path d="M75 175 Q100 165 130 180 Q130 205 105 210 Q80 208 75 175 Z" fill={BELLY} />
      <path
        d="M52 90 Q44 38 100 32 Q156 38 156 88 Q152 130 100 132 Q56 128 52 90 Z"
        fill={MAIN}
        {...PE}
        paintOrder="stroke"
      />
      <path d="M82 36 Q78 14 90 12 Q98 16 94 38 Z" fill={HORN} {...PE} paintOrder="stroke" />
      <path d="M120 34 Q116 12 128 10 Q136 14 132 38 Z" fill={HORN} {...PE} paintOrder="stroke" />
      <ellipse cx="80" cy="82" rx="4.5" ry="5.5" fill="#2C2C2A" />
      <ellipse cx="120" cy="82" rx="4.5" ry="5.5" fill="#2C2C2A" />
      <circle cx="81.5" cy="80" r="1.2" fill="#fff" />
      <circle cx="121.5" cy="80" r="1.2" fill="#fff" />
      <path d="M93 102 Q100 106 108 102" {...PEinner} strokeWidth={1.5} />
    </g>
  );
}

function Lie() {
  return (
    <g filter="url(#paperShadow)" transform="translate(0,30)">
      <path
        d="M165 175 Q195 170 195 145 Q190 135 178 142 Q172 158 162 170 Z"
        fill={MAIN}
        {...PE}
        paintOrder="stroke"
      />
      <path
        d="M30 160 Q20 120 70 110 Q140 105 170 130 Q180 165 155 180 Q90 188 50 182 Q28 175 30 160 Z"
        fill={MAIN}
        {...PE}
        paintOrder="stroke"
      />
      <path d="M55 158 Q100 145 150 158 Q150 178 100 180 Q60 178 55 158 Z" fill={BELLY} />
      <ellipse cx="60" cy="183" rx="14" ry="6" fill={SEC} {...PE} paintOrder="stroke" />
      <ellipse cx="135" cy="183" rx="14" ry="6" fill={SEC} {...PE} paintOrder="stroke" />
      <path
        d="M22 100 Q15 60 60 55 Q105 60 102 95 Q98 130 60 132 Q26 130 22 100 Z"
        fill={MAIN}
        {...PE}
        paintOrder="stroke"
      />
      <path d="M40 60 Q36 42 46 40 Q54 44 50 62 Z" fill={HORN} {...PE} paintOrder="stroke" />
      <path d="M68 56 Q64 38 74 36 Q82 40 78 58 Z" fill={HORN} {...PE} paintOrder="stroke" />
      {/* 闭眼 */}
      <path
        d="M40 92 Q46 96 52 92"
        stroke="#2C2C2A"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M76 90 Q82 94 88 90"
        stroke="#2C2C2A"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      <path d="M58 108 Q63 110 68 108" {...PEinner} strokeWidth={1.5} />
      <text x="120" y="55" fontFamily="var(--f-num)" fontSize="14" fill="#888780">
        z z
      </text>
    </g>
  );
}

/** 用于路由切换时的预加载（确保 3 个 pose 都缓存） */
export const XIAOQINGLONG_POSES: Pose[] = ['stand', 'sit', 'lie'];
