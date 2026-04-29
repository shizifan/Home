/**
 * 8 个预设伙伴的标识与立绘类型
 * 来源：PRD §6.1 角色清单 + §9.2 角色色板
 */

export const COMPANION_PRESET_IDS = [
  'xiaoqinglong',
  'dabear',
  'xiaohuolong',
  'tengtengshe',
  'xiaolvlong',
  'linnabel',
  'xiaolaohu',
  'xiaoshizi',
] as const;

export type CompanionPresetId = (typeof COMPANION_PRESET_IDS)[number];

export type Pose = 'stand' | 'sit' | 'lie';

export type Mood = 'default' | 'happy' | 'curious' | 'thinking' | 'confused';

export interface CompanionVisualProps {
  pose?: Pose;
  size?: number;
  mood?: Mood;
}

/** 角色色板（PRD §9.2 角色色板 + design/styles.css） */
export const COMPANION_PALETTE: Record<
  CompanionPresetId,
  { main: string; sec: string; line: string; horn?: string; belly?: string }
> = {
  xiaoqinglong: { main: '#D3D1C7', sec: '#888780', line: '#5F5E5A', horn: '#6B6A66', belly: '#E8E6DD' },
  dabear: { main: '#E8C896', sec: '#A8773D', line: '#5F5E5A', belly: '#F5DEB3' },
  xiaohuolong: { main: '#D4537E', sec: '#993556', line: '#4B1528', belly: '#EDB7C9' },
  tengtengshe: { main: '#1D9E75', sec: '#FAC775', line: '#085041', belly: '#9BD9C2' },
  xiaolvlong: { main: '#97C459', sec: '#3B6D11', line: '#173404', belly: '#C9E2A0' },
  linnabel: { main: '#F4C0D1', sec: '#ED93B1', line: '#72243E', belly: '#FBE3EC' },
  xiaolaohu: { main: '#FAC775', sec: '#854F0B', line: '#412402', belly: '#F5E1B6' },
  xiaoshizi: { main: '#FAC775', sec: '#BA7517', line: '#633806', belly: '#F5E1B6' },
};

/** 中文显示名（PRD §6.1） */
export const COMPANION_CN_NAME: Record<CompanionPresetId, string> = {
  xiaoqinglong: '小青龙',
  dabear: '大熊',
  xiaohuolong: '小火龙',
  tengtengshe: '藤藤蛇',
  xiaolvlong: '小绿龙',
  linnabel: '琳娜贝尔',
  xiaolaohu: '小老虎',
  xiaoshizi: '小狮子',
};
