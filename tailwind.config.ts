import type { Config } from 'tailwindcss';

/**
 * Design tokens 完整对应 PRD §9.2 / §9.3 与 design/styles.css。
 * 颜色组织：
 *   bg-*       房间与基础底色
 *   ink-*      文字三档
 *   amber-*    强调色族（PRD §9.2 强调）
 *   m-*        记忆面板 4 区块色
 *   companion-*  8 个伙伴主辅描边色（PRD §9.2 角色色板）
 *   gold       第 6 项档案专属
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // 基础底色（PRD §9.2 主色板）
        bg: {
          base: '#FAEEDA',
          backWall: '#F5DEB3',
          leftWall: '#E8C896',
          floor: '#D4A86A',
        },
        edge: {
          warm: '#A8773D',
          paper: '#FFFFFF',
          line: '#5F5E5A',
        },
        ink: {
          1: '#2C2C2A',
          2: '#5F5E5A',
          3: '#888780',
        },
        amber: {
          DEFAULT: '#BA7517',
          light: '#FAC775',
          deep: '#633806',
          mid: '#854F0B',
        },
        m: {
          remember: '#F0997B', // 「记住的事」
          uncertain: '#AFA9EC', // 「拿不准」
          setaside: '#B5D4F4', // 「放下的事」
          unknown: '#D3D1C7', // 「盲区」
        },
        gold: {
          DEFAULT: '#EF9F27', // 第 6 项档案
          deep: '#854F0B',
        },
        red: {
          dot: '#E24B4A',
        },
        companion: {
          xiaoqinglong: { main: '#D3D1C7', sec: '#888780', line: '#5F5E5A' },
          dabear: { main: '#E8C896', sec: '#A8773D', line: '#5F5E5A' },
          xiaohuolong: { main: '#D4537E', sec: '#993556', line: '#4B1528' },
          tengtengshe: { main: '#1D9E75', sec: '#FAC775', line: '#085041' },
          xiaolvlong: { main: '#97C459', sec: '#3B6D11', line: '#173404' },
          linnabel: { main: '#F4C0D1', sec: '#ED93B1', line: '#72243E' },
          xiaolaohu: { main: '#FAC775', sec: '#854F0B', line: '#412402' },
          xiaoshizi: { main: '#FAC775', sec: '#BA7517', line: '#633806' },
        },
      },
      fontFamily: {
        title: ['"LXGW WenKai TC"', '"PingFang SC"', 'system-ui', 'sans-serif'],
        body: ['"Noto Sans SC"', '"PingFang SC"', 'system-ui', 'sans-serif'],
        num: ['Quicksand', '"Noto Sans SC"', 'sans-serif'],
      },
      fontSize: {
        // PRD §9.3 字号规范
        h1: ['28px', { lineHeight: '1.4', fontWeight: '500' }],
        h2: ['22px', { lineHeight: '1.5', fontWeight: '500' }],
        h3: ['18px', { lineHeight: '1.5', fontWeight: '500' }],
        body: ['16px', { lineHeight: '1.7' }],
        sub: ['14px', { lineHeight: '1.6' }],
        small: ['12px', { lineHeight: '1.5' }],
        mini: ['11px', { lineHeight: '1.4' }],
      },
      borderRadius: {
        card: '8px',
        sheet: '24px',
      },
      boxShadow: {
        sheet: '0 -8px 32px rgba(0,0,0,0.18)',
        paper: '0 2px 0 #5F5E5A',
      },
      animation: {
        breathe: 'breathe 3s ease-in-out infinite',
        blink: 'blink 5s ease-in-out infinite',
        spin: 'spin 1.6s linear infinite',
        'slide-in-x': 'slide-in-x 0.4s ease-out',
      },
      keyframes: {
        breathe: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.02)' },
        },
        blink: {
          '0%, 95%, 100%': { transform: 'scaleY(1)' },
          '97%': { transform: 'scaleY(0.05)' },
        },
        'slide-in-x': {
          '0%': { transform: 'translateX(24%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
