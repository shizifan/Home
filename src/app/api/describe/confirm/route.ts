/**
 * POST /api/describe/confirm
 *
 * 孩子点"就是这样"（或 5 分钟超时自动判定）。
 *
 * Body:
 * {
 *   "card_id": "...",
 *   "auto_timeout": false  // 5 分钟无操作时由前端定时器置 true
 * }
 *
 * V0.6.1 简化方案（Plan §8.6 选 A）：
 *   不再额外调 LLM，复用 Pass2 已生成的回应。
 *   这里只做：
 *     - 把 card 标记为 confirmed / no_action_timeout
 *     - 写一条简短的"贴墙了"系统对话（来自伙伴 fallback 行）
 *
 * 响应：{ companion_final_response }
 */

import { NextResponse } from 'next/server';

import {
  getCardById,
  setCardChildAction,
} from '@/lib/db/cardsRepo';
import { getCompanionById, insertCompanionLine } from '@/lib/db/repos';
import { getCompanionPreset } from '@/lib/companionPresets';
import type { DayNumber } from '@/types';

export const runtime = 'nodejs';

const STICKED_LINES_BY_PRESET: Record<string, string[]> = {
  xiaoqinglong: ['好——贴上了。', '我把它放到墙上了。'],
  dabear: ['嗯......贴好了。', '我慢慢贴的。'],
  xiaohuolong: ['哒！贴好了！', '搞定！'],
  tengtengshe: ['......贴上了。', '......好了。'],
  xiaolvlong: ['贴上！贴上！', '好啦！'],
  linnabel: ['（小声）我贴好了......', '......贴上了。'],
  xiaolaohu: ['搞定！立刻贴上！', '好——贴上！'],
  xiaoshizi: ['本王已贴上。', '嗯，贴好了。'],
};

function pickLine(presetId: string): string {
  const list = STICKED_LINES_BY_PRESET[presetId] ?? ['贴好了。'];
  return list[Math.floor(Math.random() * list.length)];
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const cardId: string = body.card_id;
    const autoTimeout: boolean = body.auto_timeout === true;

    if (!cardId) {
      return NextResponse.json({ error: 'missing card_id' }, { status: 400 });
    }

    const card = await getCardById(cardId);
    if (!card) {
      return NextResponse.json({ error: 'card not found' }, { status: 404 });
    }

    // 双图测试期已结束（V1.0 移除），chosen_source 不再处理

    if (card.child_action === 'confirmed' || card.child_action === 'no_action_timeout') {
      // 幂等：再次调用直接返回成功（避免前端重试时报错）
      const companion = await getCompanionById(card.companion_id);
      const preset = companion ? getCompanionPreset(companion.preset_id) : null;
      return NextResponse.json({
        companion_final_response: pickLine(preset?.preset_id ?? ''),
        memory_bank_updated: true,
        already_confirmed: true,
      });
    }

    await setCardChildAction(cardId, autoTimeout ? 'no_action_timeout' : 'confirmed');

    const companion = await getCompanionById(card.companion_id);
    if (!companion) {
      return NextResponse.json({ error: 'companion not found' }, { status: 500 });
    }

    const preset = getCompanionPreset(companion.preset_id);
    const finalLine = pickLine(preset?.preset_id ?? '');

    await insertCompanionLine({
      companionId: card.companion_id,
      day: companion.current_day as DayNumber,
      content: finalLine,
      source: autoTimeout ? 'card_auto_confirm' : 'card_confirm',
      relatedMemoryId: card.memory_id,
    });

    return NextResponse.json({
      companion_final_response: finalLine,
      memory_bank_updated: true,
    });
  } catch (err) {
    console.error('[/api/describe/confirm]', err);
    return NextResponse.json(
      { error: (err as Error)?.message ?? 'internal error' },
      { status: 500 },
    );
  }
}
