/**
 * 剧本插画占位（PRD §14.7 + §19.10）
 *
 * V1.0 阶段：纯 SVG/渐变 + emoji 表征剧本场景，避免依赖外部图像资产。
 * P7 阶段会替换为设计师/AI 生成的纸片马里奥风格真插画（30‑40 张），
 * 替换接口：保持 Props（scenario_id + act_number + variant 'a'|'b'）不变。
 */

interface Props {
  scenarioId: string;
  actNumber: 1 | 2 | 3;
  variant?: 'a' | 'b';
  width?: number;
  height?: number;
}

interface Theme {
  bg: [string, string]; // gradient stops
  accent: string;
  emojis: string[]; // [act 1, act 2, act 3]
}

const THEMES: Record<string, Theme> = {
  water_disaster: {
    bg: ['#B5D4F4', '#E8C896'],
    accent: '#3B6D9C',
    emojis: ['🏯', '🌊', '📜'],
  },
  envoy_visit: {
    bg: ['#F4E1B5', '#D4A86A'],
    accent: '#854F0B',
    emojis: ['🎎', '🍶', '🤝'],
  },
  plague_outbreak: {
    bg: ['#D3D1C7', '#AFA9EC'],
    accent: '#5F5E5A',
    emojis: ['🏥', '🌿', '📜'],
  },
  court_intrigue: {
    bg: ['#E8C896', '#D4537E'],
    accent: '#4B1528',
    emojis: ['🕯️', '✉️', '👑'],
  },
  border_alarm: {
    bg: ['#D4A86A', '#A8773D'],
    accent: '#412402',
    emojis: ['🏯', '🗻', '⚔️'],
  },
};

export function ScenarioIllustration({
  scenarioId,
  actNumber,
  width = 320,
  height = 180,
}: Props) {
  const theme = THEMES[scenarioId] ?? {
    bg: ['#FAEEDA', '#E8C896'],
    accent: '#5F5E5A',
    emojis: ['🏯', '📜', '👑'],
  };
  const emoji = theme.emojis[actNumber - 1] ?? theme.emojis[0];
  const gradId = `grad-${scenarioId}-${actNumber}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`${scenarioId} act ${actNumber} 占位插画`}
      className="rounded-card"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={theme.bg[0]} />
          <stop offset="100%" stopColor={theme.bg[1]} />
        </linearGradient>
      </defs>
      <rect
        width={width}
        height={height}
        fill={`url(#${gradId})`}
        stroke={theme.accent}
        strokeWidth={2}
        rx={8}
      />
      {/* 远山轮廓（等距视角暗示） */}
      <path
        d={`M0 ${height * 0.7} L${width * 0.3} ${height * 0.45} L${width * 0.55} ${
          height * 0.6
        } L${width * 0.8} ${height * 0.4} L${width} ${height * 0.55} L${width} ${height} L0 ${height} Z`}
        fill={theme.accent}
        opacity={0.18}
      />
      {/* 中心 emoji 表征当前幕 */}
      <text
        x={width / 2}
        y={height / 2 + 16}
        fontSize={64}
        textAnchor="middle"
        dominantBaseline="middle"
      >
        {emoji}
      </text>
      {/* 幕标识 */}
      <text
        x={width - 12}
        y={height - 12}
        fontSize={11}
        textAnchor="end"
        fill={theme.accent}
        opacity={0.7}
      >
        第 {actNumber} 幕
      </text>
    </svg>
  );
}
