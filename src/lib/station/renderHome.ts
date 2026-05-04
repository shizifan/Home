/**
 * 对方家渲染逻辑
 * 基于 memory_bank 内容推导对方小家的视觉呈现。
 */

import 'server-only';

import { getMemoryBank } from '@/lib/db/repos';

export interface RenderedHome {
  wallDecorations: { type: string; position: { x: number; y: number } }[];
  floorItems: { icon: string; position: { x: number; y: number } }[];
  atmosphere: 'warm' | 'cool' | 'neutral';
  density: 'sparse' | 'moderate' | 'rich';
}

const CATEGORY_TO_ICON: Record<string, string> = {
  person: '👤',
  food: '🍎',
  activity: '🎯',
  object: '📦',
  emotion: '💭',
  place: '🌳',
  other: '✨',
};

const OUTDOOR_PLACES = ['公园', '森林', '海边', '山上', '野外', '户外', '花园', '草地', '河边'];

export async function renderCompanionHome(
  companionId: string,
): Promise<RenderedHome> {
  const bank = await getMemoryBank(companionId);
  const wallDecorations: RenderedHome['wallDecorations'] = [];
  const floorItems: RenderedHome['floorItems'] = [];
  let hasNegativeEmotion = false;
  const usedPositions = new Set<string>();

  for (let i = 0; i < bank.length; i++) {
    const entry = bank[i];
    const category = entry.concept_category ?? 'other';
    const icon = CATEGORY_TO_ICON[category] ?? '✨';

    // 随机位置（避免重叠）
    let pos: { x: number; y: number };
    let attempts = 0;
    do {
      pos = { x: 20 + Math.random() * 320, y: 20 + Math.random() * 200 };
      attempts++;
    } while (usedPositions.has(`${pos.x},${pos.y}`) && attempts < 20);
    usedPositions.add(`${pos.x},${pos.y}`);

    // 场所类且户外 → 墙面装饰
    if (category === 'place') {
      const isOutdoor = OUTDOOR_PLACES.some(
        (outdoor) => entry.concept_name.includes(outdoor),
      );
      if (isOutdoor) {
        wallDecorations.push({ type: 'landscape', position: pos });
        continue;
      }
    }

    // 人物/食物 → 地面物品
    if (category === 'person' || category === 'food' || category === 'object') {
      floorItems.push({ icon, position: pos });
      continue;
    }

    // 情绪类 → 判断氛围
    if (category === 'emotion') {
      wallDecorations.push({ type: 'emotion', position: pos });
      const negativeKeywords = ['难过', '害怕', '生气', '伤心', '哭'];
      if (negativeKeywords.some((kw) => entry.concept_name.includes(kw))) {
        hasNegativeEmotion = true;
      }
    }
  }

  return {
    wallDecorations,
    floorItems,
    atmosphere: hasNegativeEmotion ? 'cool' : bank.some((e) => e.concept_category === 'person') ? 'warm' : 'neutral',
    density:
      bank.length < 10 ? 'sparse' :
      bank.length > 20 ? 'rich' : 'moderate',
  };
}
