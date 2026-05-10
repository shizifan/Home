/**
 * POST /api/voice/upload
 *
 * multipart/form-data：audio (File) + companion_id
 *
 * 流程：保存音频 → ASR → 安全过滤 → 返回 transcription
 *
 * 失败码：
 *   400 missing fields
 *   404 companion not found
 *   413 audio too large
 *   422 asr_empty / asr_safety_block
 *   503 asr_unavailable / timeout
 */

import { NextResponse } from 'next/server';

import { saveUploadedAudio } from '@/lib/storage/upload';
import { recognizeAudioFile, isASRResult } from '@/lib/asr/client';
import { getCompanionById } from '@/lib/db/repos';
import { filterChildInput } from '@/lib/safety/filters';
import { resolveCurrentUser } from '@/lib/auth/session';
import {
  assertCompanionOwnedByUser,
  NotFoundOrForbiddenError,
} from '@/lib/auth/ownership';

export const runtime = 'nodejs';
export const maxDuration = 30;

const MAX_AUDIO_BYTES = 2 * 1024 * 1024; // 2MB

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const companionId = String(form.get('companion_id') ?? '');
    const audio = form.get('audio');

    if (!companionId) {
      return NextResponse.json({ error: 'missing companion_id' }, { status: 400 });
    }
    if (!(audio instanceof File)) {
      return NextResponse.json({ error: 'missing audio file' }, { status: 400 });
    }

    if (audio.size > MAX_AUDIO_BYTES) {
      return NextResponse.json(
        { error: 'audio_too_large', message: '语音文件太大了' },
        { status: 413 },
      );
    }

    const user = await resolveCurrentUser();
    if (!user) return NextResponse.json({ error: 'no_user' }, { status: 401 });
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

    // 保存到 uploads_voice/<companion_id>/
    const buf = Buffer.from(await audio.arrayBuffer());
    const fromName = (audio.name.split('.').pop() || '').toLowerCase();
    const fromMime = audio.type.includes('wav')
      ? 'wav'
      : audio.type.includes('webm')
        ? 'webm'
        : audio.type.includes('mp4')
          ? 'mp4'
          : '';
    const ext = fromName || fromMime || 'wav';
    const allowedExts = ['wav', 'webm', 'mp4', 'm4a', 'mp3', 'ogg'];
    const safeExt = allowedExts.includes(ext) ? ext : 'wav';
    const saved = await saveUploadedAudio({
      companionId,
      buf,
      ext: safeExt,
    });

    // ASR
    const asr = await recognizeAudioFile(saved.absPath, companionId);
    if (!isASRResult(asr)) {
      const reason = asr.reason;
      if (reason === 'empty') {
        return NextResponse.json(
          {
            error: 'asr_empty',
            message: '我没听清，再说一次？',
            voice_audio_url: saved.url,
          },
          { status: 422 },
        );
      }
      if (reason === 'unsupported') {
        return NextResponse.json(
          { error: 'asr_unsupported', message: '语音格式不支持' },
          { status: 415 },
        );
      }
      // timeout / http
      return NextResponse.json(
        {
          error: 'asr_unavailable',
          message: '网络好像有点慢，要不先打字试试？',
          voice_audio_url: saved.url,
        },
        { status: 503 },
      );
    }

    // 安全过滤
    const safety = filterChildInput(asr.transcription);
    if (!safety.ok) {
      return NextResponse.json(
        {
          error: 'asr_safety_block',
          message: '我没太听明白，要不换个说法？',
          voice_audio_url: saved.url,
        },
        { status: 422 },
      );
    }

    return NextResponse.json({
      transcription: asr.transcription,
      confidence: asr.confidence,
      duration_seconds: asr.duration_seconds,
      voice_audio_url: saved.url,
    });
  } catch (err) {
    console.error('[/api/voice/upload]', err);
    return NextResponse.json(
      { error: (err as Error)?.message ?? 'internal error' },
      { status: 500 },
    );
  }
}

