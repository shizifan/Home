/**
 * POST /api/chat/ask
 *
 * 孩子在 ChatOverlay 输入框提问 → 伙伴根据 memory_bank + 最近对话回答。
 *
 * Body: { question: string }
 *
 * Response 200:
 *   { reply: string, source: 'free_chat' | 'safety_filter' }
 *
 * 设计：spec/Free_Chat_Implementation.md V0.2
 *   - LLM / 输出过滤失败一律 5xx，不写静态兜底
 *   - input safety filter 走 PRD §17.2 拒绝路径，落两条 conversations
 *   - 失败路径不写 conversations，等重试成功才落库
 */

import { NextResponse } from 'next/server';

import { runFreeChat } from '@/lib/llm/freeChat';
import {
  findCompanionForSingleUser,
  getMemoryBank,
  insertChildLine,
  insertCompanionLine,
  listRecentConversations,
} from '@/lib/db/repos';
import { getCompanionPreset } from '@/lib/companionPresets';
import {
  filterChildInput,
  filterCompanionOutput,
  getInputRejectionLine,
} from '@/lib/safety/filters';
import type { DayNumber } from '@/types';

export const runtime = 'nodejs';
export const maxDuration = 15;

const MAX_QUESTION_LEN = 200;
const RECENT_CONV_LIMIT = 10;

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { question?: unknown };
    const raw = typeof body.question === 'string' ? body.question.trim() : '';
    if (!raw) {
      return NextResponse.json({ error: 'empty question' }, { status: 400 });
    }
    if (raw.length > MAX_QUESTION_LEN) {
      return NextResponse.json({ error: 'question too long' }, { status: 400 });
    }

    const companion = await findCompanionForSingleUser();
    if (!companion) {
      return NextResponse.json({ error: 'companion not found' }, { status: 404 });
    }
    const preset = getCompanionPreset(companion.preset_id);
    if (!preset) {
      return NextResponse.json({ error: 'preset not found' }, { status: 500 });
    }

    const day = companion.current_day as DayNumber;

    // 输入安全过滤 — PRD §17.2 产品特性，非降级
    const safety = filterChildInput(raw);
    if (!safety.ok) {
      const reply = getInputRejectionLine(safety.reason ?? 'other');
      await insertChildLine({
        companionId: companion.id,
        day,
        content: raw,
        source: 'child_chat',
      });
      await insertCompanionLine({
        companionId: companion.id,
        day,
        content: reply,
        source: 'safety_filter',
      });
      return NextResponse.json({ reply, source: 'safety_filter' as const });
    }

    const [memoryBank, recent] = await Promise.all([
      getMemoryBank(companion.id),
      listRecentConversations(companion.id, RECENT_CONV_LIMIT),
    ]);

    // LLM 调用 — 失败抛错（runFreeChat 自身保证）
    const reply = await runFreeChat(
      {
        companion: preset,
        day,
        memoryBank,
        recentConversations: recent,
        question: raw,
      },
      companion.id,
    );

    // 输出安全过滤 — 命中也直接抛，暴露 prompt / 词表问题
    const outCheck = filterCompanionOutput(reply);
    if (!outCheck.ok) {
      throw new Error(
        `free_chat output blocked by safety filter (reason=${outCheck.reason ?? 'other'}): ${reply}`,
      );
    }

    // 成功路径才落 DB
    await insertChildLine({
      companionId: companion.id,
      day,
      content: raw,
      source: 'child_chat',
    });
    await insertCompanionLine({
      companionId: companion.id,
      day,
      content: reply,
      source: 'free_chat',
    });

    return NextResponse.json({ reply, source: 'free_chat' as const });
  } catch (err) {
    console.error('[/api/chat/ask]', err);
    return NextResponse.json(
      { error: (err as Error)?.message ?? 'internal error' },
      { status: 500 },
    );
  }
}
