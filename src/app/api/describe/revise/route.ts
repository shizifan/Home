/**
 * POST /api/describe/revise
 *
 * 孩子说"不太对"，重新生成卡片。
 *
 * Body:
 * {
 *   "card_id": "...",
 *   "revision_type": "color" | "missing" | "complete_redo",
 *   "revision_text": "..." (语音补充)
 * }
 *
 * 服务端：
 *   - 校验 card_id + memory.regenerate_count < 3
 *   - 把当前 active 设为 rejected
 *   - 重新跑 keyword_extract + imagegen + style_audit
 *   - 写新 cards 行（attempt+1）
 *   - 第 4 次（regenerate_count=3 之后）不再重做，返回 fallback
 */

import { NextResponse } from 'next/server';

import { getCardById, setCardChildAction } from '@/lib/db/cardsRepo';
import { processReviseCard } from '@/lib/orchestrate/processDescribe';
import { queryOne } from '@/lib/db/client';
import { getTaskByDay } from '@/lib/tasks';
import { getCompanionById } from '@/lib/db/repos';

export const runtime = 'nodejs';
export const maxDuration = 30;

const VALID_TYPES = ['color', 'missing', 'complete_redo'] as const;
type RevisionType = (typeof VALID_TYPES)[number];

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const cardId: string = body.card_id;
    const revisionType: RevisionType = body.revision_type;
    const revisionText: string = (body.revision_text ?? '').toString().trim();

    if (!cardId) {
      return NextResponse.json({ error: 'missing card_id' }, { status: 400 });
    }
    if (!VALID_TYPES.includes(revisionType)) {
      return NextResponse.json({ error: 'invalid revision_type' }, { status: 400 });
    }

    const card = await getCardById(cardId);
    if (!card) {
      return NextResponse.json({ error: 'card not found' }, { status: 404 });
    }

    // 找 memory 原始描述
    const mem = await queryOne<{ user_text: string | null; task_id: string }>(
      `select user_text, task_id from memories where id = :id`,
      { id: card.memory_id },
    );
    if (!mem) {
      return NextResponse.json({ error: 'memory not found' }, { status: 404 });
    }

    // 找任务定义（用作 taskTitle 兜底）
    const companion = await getCompanionById(card.companion_id);
    const task = companion ? getTaskByDay(companion.current_day) : null;
    const taskTitle = task?.title ?? '一个场景';

    // 把旧卡片设为 rejected
    await setCardChildAction(cardId, 'rejected');

    const { card: newCard, attempt, isExhausted } = await processReviseCard({
      cardId,
      oldCard: card,
      revisionType,
      revisionText,
      originalDescription: mem.user_text ?? '',
      taskTitle,
    });

    return NextResponse.json({
      memory_id: newCard.memory_id,
      card_id: newCard.id,
      image_url: newCard.image_url,
      image_source: newCard.image_source,
      alt_image_url: newCard.alt_image_url,
      alt_image_source: newCard.alt_image_source,
      is_fallback_text_card: newCard.is_fallback_text_card,
      attempt,
      is_exhausted: isExhausted,
      style_check: {
        passed: newCard.style_check_passed,
        severity: newCard.style_check_severity,
        regenerate_count: attempt - 1,
        issues: newCard.style_check_issues,
      },
    });
  } catch (err) {
    console.error('[/api/describe/revise]', err);
    return NextResponse.json(
      { error: (err as Error)?.message ?? 'internal error' },
      { status: 500 },
    );
  }
}
