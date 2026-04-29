/**
 * 房间视觉派生（PRD §4.4）
 *
 * 输入：memory_bank.remembered + photos
 * 输出：地上物品 / 人物相框 / 情绪光线 / 照片摆放槽
 *
 * 规则：
 * - 食物/玩具/物品类概念 → 地上图标（最多 4 个，按重要性挑）
 * - 人物概念 → 后墙相框（最多 3 个）
 * - 情绪概念 → mood 'warm' / 'cool' / 'neutral'
 * - 照片 → 最近 6 张，按预设槽位
 */

import type {
  FloorItemKind,
  FloorItemProps,
  FrameStickerProps,
  PhotoStickerProps,
} from '@/components/room/Room';

interface RememberedConcept {
  concept_name: string;
  concept_category?: string;
  ai_summary?: string;
  evidence?: Array<{ memory_id: string; day: number; excerpt: string }>;
}

interface Photo {
  id: string;
  url: string;
  day: number;
}

const FOOD_KEYWORDS: Array<{ test: RegExp; kind: FloorItemKind }> = [
  { test: /饺子/, kind: 'dumplings' },
  { test: /米饭|盖饭/, kind: 'rice_bowl' },
  { test: /面条|拉面|意面/, kind: 'noodle_bowl' },
  { test: /苹果/, kind: 'apple' },
  { test: /香蕉/, kind: 'banana' },
  { test: /披萨|比萨/, kind: 'pizza' },
  { test: /蛋糕|生日/, kind: 'cake' },
];

const OBJECT_KEYWORDS: Array<{ test: RegExp; kind: FloorItemKind }> = [
  { test: /积木/, kind: 'blocks' },
  { test: /娃娃|布偶|公仔/, kind: 'doll' },
  { test: /汽车|小车|玩具车/, kind: 'car' },
  { test: /球/, kind: 'ball' },
  { test: /书|课本|绘本/, kind: 'book' },
  { test: /画笔|彩笔|画画/, kind: 'paint' },
  { test: /铅笔|笔/, kind: 'pencil' },
  { test: /书包/, kind: 'bag' },
  { test: /自行车|单车/, kind: 'bicycle' },
  { test: /植物|绿植|花/, kind: 'plant' },
  { test: /电视|TV/i, kind: 'tv' },
  { test: /床/, kind: 'bed' },
  { test: /灯|台灯/, kind: 'lamp' },
];

const POSITIVE_EMOTION = /开心|快乐|高兴|喜欢|爱|温暖|安心|舒服/;
const NEGATIVE_EMOTION = /害怕|担心|害羞|紧张|烦|生气|难过|讨厌|怕/;

function pickFloorKind(concept: RememberedConcept): FloorItemKind | null {
  const cat = concept.concept_category;
  const haystack = `${concept.concept_name} ${concept.ai_summary ?? ''}`;
  const list =
    cat === 'food'
      ? FOOD_KEYWORDS
      : cat === 'object' || cat === 'activity' || cat === 'place'
        ? [...OBJECT_KEYWORDS, ...FOOD_KEYWORDS]
        : [...FOOD_KEYWORDS, ...OBJECT_KEYWORDS];
  for (const { test, kind } of list) {
    if (test.test(haystack)) return kind;
  }
  return null;
}

function pickMood(concepts: RememberedConcept[]): 'warm' | 'cool' | 'neutral' {
  let warm = 0;
  let cool = 0;
  for (const c of concepts) {
    const haystack = `${c.concept_name} ${c.ai_summary ?? ''}`;
    if (c.concept_category === 'emotion' || POSITIVE_EMOTION.test(haystack) || NEGATIVE_EMOTION.test(haystack)) {
      if (POSITIVE_EMOTION.test(haystack)) warm++;
      if (NEGATIVE_EMOTION.test(haystack)) cool++;
    } else if (POSITIVE_EMOTION.test(haystack)) {
      warm++;
    } else if (NEGATIVE_EMOTION.test(haystack)) {
      cool++;
    }
  }
  if (warm > cool && warm >= 2) return 'warm';
  if (cool > warm && cool >= 1) return 'cool';
  return 'neutral';
}

const PHOTO_SLOTS: Array<Pick<PhotoStickerProps, 'x' | 'y' | 'rot' | 'wall'>> = [
  { x: 230, y: 250, rot: -6, wall: 'back' },
  { x: 360, y: 230, rot: 5, wall: 'back' },
  { x: 290, y: 320, rot: 2, wall: 'back' },
  { x: 410, y: 295, rot: -3, wall: 'back' },
  { x: 100, y: 290, rot: -5, wall: 'left' },
  { x: 90, y: 240, rot: 4, wall: 'left' },
];

const ITEM_SLOTS = [
  { x: 240, y: 470 },
  { x: 380, y: 500 },
  { x: 180, y: 510 },
  { x: 440, y: 470 },
];

const FRAME_SLOTS: Array<Pick<FrameStickerProps, 'x' | 'y' | 'rot' | 'wall'>> = [
  { x: 460, y: 310, rot: 2, wall: 'back' },
  { x: 180, y: 240, rot: -3, wall: 'back' },
  { x: 165, y: 320, rot: 4, wall: 'left' },
];

export interface DerivedLayout {
  photos: PhotoStickerProps[];
  items: FloorItemProps[];
  frames: FrameStickerProps[];
  mood: 'warm' | 'cool' | 'neutral';
}

export function deriveRoomLayout(args: {
  remembered: RememberedConcept[];
  photos: Photo[];
}): DerivedLayout {
  // 1. 照片
  const photoStickers: PhotoStickerProps[] = args.photos
    .slice(0, 6)
    .map((p, i) => ({
      ...PHOTO_SLOTS[i],
      label: `D${p.day}`,
      tone: '#E8C896',
    }));

  // 2. 地上物品（最多 4，按概念顺序）
  const items: FloorItemProps[] = [];
  const usedKinds = new Set<FloorItemKind>();
  for (const c of args.remembered) {
    if (items.length >= 4) break;
    const kind = pickFloorKind(c);
    if (!kind || usedKinds.has(kind)) continue;
    usedKinds.add(kind);
    items.push({ ...ITEM_SLOTS[items.length], kind });
  }

  // 3. 人物相框（最多 3）
  const persons = args.remembered.filter((c) => c.concept_category === 'person').slice(0, 3);
  const frames: FrameStickerProps[] = persons.map((_, i) => ({
    ...FRAME_SLOTS[i],
  }));

  // 4. 情绪光线
  const mood = pickMood(args.remembered);

  return { photos: photoStickers, items, frames, mood };
}
