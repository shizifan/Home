/**
 * POST /api/describe/submit
 *
 * 提交确认后的描述（来自语音转文字或直接文字），触发完整链路：
 *   关键词提取 + 图像生成 + 风格审核 + 内容审核 + Pass1 归类 + Pass2 对话
 *
 * Body:
 * {
 *   "companion_id": "...",
 *   "task_id": "...",
 *   "description_text": "...",
 *   "input_method": "voice" | "text",
 *   "voice_audio_url": "..." (optional, 若 input_method=voice)
 * }
 */

import { NextResponse } from 'next/server';

import { processDescribe } from '@/lib/orchestrate/processDescribe';
import { getCompanionById } from '@/lib/db/repos';
import { getTaskByDay } from '@/lib/tasks';
import { resolveCurrentUser } from '@/lib/auth/session';
import {
  assertCompanionOwnedByUser,
  NotFoundOrForbiddenError,
} from '@/lib/auth/ownership';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_DESCRIPTION_LEN = 1000;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const companionId: string = body.companion_id;
    const taskId: string = body.task_id;
    const text: string = (body.description_text ?? '').toString().trim();
    const inputMethod: 'voice' | 'text' =
      body.input_method === 'voice' ? 'voice' : 'text';
    const voiceAudioUrl: string | undefined =
      typeof body.voice_audio_url === 'string' ? body.voice_audio_url : undefined;
    const asrTranscription: string | undefined =
      typeof body.asr_transcription === 'string' ? body.asr_transcription : undefined;
    const editedText: string | undefined =
      typeof body.edited_text === 'string' ? body.edited_text : undefined;

    if (!companionId || !taskId) {
      return NextResponse.json({ error: 'missing fields' }, { status: 400 });
    }
    if (!text) {
      return NextResponse.json({ error: 'empty description' }, { status: 400 });
    }
    if (text.length > MAX_DESCRIPTION_LEN) {
      return NextResponse.json({ error: 'description too long' }, { status: 400 });
    }

    const user = await resolveCurrentUser();
    if (!user) return NextResponse.json({ error: 'no_user' }, { status: 401 });

    // PRD §27.4 单用户日 LLM 调用上限
    const { checkUserDailyLLM } = await import('@/lib/auth/rateLimit');
    const llmCheck = await checkUserDailyLLM(user.id);
    if (!llmCheck.ok) {
      return NextResponse.json(
        { error: llmCheck.reason, message: llmCheck.message },
        { status: 429 },
      );
    }

    try {
      await assertCompanionOwnedByUser(companionId, user.id);
    } catch (e) {
      if (e instanceof NotFoundOrForbiddenError) {
        return NextResponse.json({ error: 'not_found' }, { status: 404 });
      }
      throw e;
    }
    const companion = await getCompanionById(companionId);
    if (!companion) {
      return NextResponse.json({ error: 'companion not found' }, { status: 404 });
    }

    const task = getTaskByDay(companion.current_day);
    if (!task || task.id !== taskId) {
      return NextResponse.json({ error: 'task mismatch' }, { status: 400 });
    }

    const result = await processDescribe({
      companionId,
      taskId,
      taskTitle: task.title,
      taskQuestion: task.description,
      descriptionText: text,
      inputMethod,
      voiceAudioUrl,
      asrTranscription,
      editedText,
    });

    return NextResponse.json({
      memory_id: result.memoryId,
      card_id: result.card.id,
      image_url: result.card.image_url,
      image_source: result.card.image_source,
      alt_image_url: result.card.alt_image_url,
      alt_image_source: result.card.alt_image_source,
      is_fallback_text_card: result.card.is_fallback_text_card,
      style_check: {
        passed: result.card.style_check_passed,
        severity: result.card.style_check_severity,
        regenerate_count: result.card.generation_attempt - 1,
        issues: result.card.style_check_issues,
      },
      memory_update: {
        action: result.pass1.action,
        concept: result.pass1.concept_name,
        reasoning: result.pass1.ai_reasoning,
        memory_bank_id: result.memoryBankId,
      },
      companion_response: result.pass2Reply,
      response_source: result.pass2Source,
    });
  } catch (err) {
    console.error('[/api/describe/submit]', err);
    return NextResponse.json(
      { error: (err as Error)?.message ?? 'internal error' },
      { status: 500 },
    );
  }
}
