/**
 * POST /api/voice/upload
 *
 * multipart/form-data：audio (File) + companion_id
 *
 * V1.0 改造（Plan_02 §2.2）：音频上传到 OSS 而非本地 public/uploads_voice/。
 *
 * 流程：保存临时文件 → ASR → 安全过滤 → 上传 OSS → 删除临时文件 → 返回
 *
 * 失败码：
 *   400 missing fields
 *   404 companion not found
 *   413 audio too large
 *   422 asr_empty / asr_safety_block
 *   503 asr_unavailable / timeout
 */

import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { recognizeAudioFile, isASRResult } from '@/lib/asr/client';
import { getCompanionById } from '@/lib/db/repos';
import { filterChildInput } from '@/lib/safety/filters';
import { uploadToOSS, ossKey } from '@/lib/storage/client';

export const runtime = 'nodejs';
export const maxDuration = 30;

const MAX_AUDIO_BYTES = 2 * 1024 * 1024; // 2MB

export async function POST(req: Request) {
  let tmpPath: string | null = null;

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

    const companion = await getCompanionById(companionId);
    if (!companion) {
      return NextResponse.json({ error: 'companion not found' }, { status: 404 });
    }

    // 1. 保存临时本地文件
    const fromName = (audio.name.split('.').pop() || '').toLowerCase();
    const fromMime = audio.type.includes('wav')
      ? 'wav'
      : audio.type.includes('webm')
        ? 'webm'
        : audio.type.includes('mp4')
          ? 'mp4'
          : '';
    const ext = fromName || fromMime || 'webm';
    const allowedExts = ['wav', 'webm', 'mp4', 'm4a', 'mp3', 'ogg'];
    const safeExt = allowedExts.includes(ext) ? ext : 'webm';
    const uuid = randomUUID();
    const filename = `${uuid}.${safeExt}`;
    tmpPath = path.join(tmpdir(), filename);

    const buf = Buffer.from(await audio.arrayBuffer());
    await writeFile(tmpPath, buf);

    // 2. ASR
    const asr = await recognizeAudioFile(tmpPath, companionId);
    if (!isASRResult(asr)) {
      const reason = asr.reason;
      // ASR 失败也上传到 OSS（保留音频以备调试）
      const voiceKey = ossKey('uploads_voice', companionId, filename);
      const uploaded = await uploadToOSS(tmpPath, voiceKey);
      await unlink(tmpPath).catch(() => {});
      tmpPath = null;

      if (reason === 'empty') {
        return NextResponse.json(
          {
            error: 'asr_empty',
            message: '我没听清，再说一次？',
            voice_audio_url: uploaded.url,
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
      return NextResponse.json(
        {
          error: 'asr_unavailable',
          message: '网络好像有点慢，要不先打字试试？',
          voice_audio_url: uploaded.url,
        },
        { status: 503 },
      );
    }

    // 3. 安全过滤
    const safety = filterChildInput(asr.transcription);
    if (!safety.ok) {
      // 上传到 OSS 保留音频
      const voiceKey = ossKey('uploads_voice', companionId, filename);
      const uploaded = await uploadToOSS(tmpPath, voiceKey);
      await unlink(tmpPath).catch(() => {});
      tmpPath = null;

      return NextResponse.json(
        {
          error: 'asr_safety_block',
          message: '我没太听明白，要不换个说法？',
          voice_audio_url: uploaded.url,
        },
        { status: 422 },
      );
    }

    // 4. 上传到 OSS
    const voiceKey = ossKey('uploads_voice', companionId, filename);
    const uploaded = await uploadToOSS(tmpPath, voiceKey);

    // 5. 删除临时文件
    await unlink(tmpPath).catch(() => {});
    tmpPath = null;

    return NextResponse.json({
      transcription: asr.transcription,
      confidence: asr.confidence,
      duration_seconds: asr.duration_seconds,
      voice_audio_url: uploaded.url,
    });
  } catch (err) {
    console.error('[/api/voice/upload]', err);
    // 清理临时文件
    if (tmpPath) {
      await unlink(tmpPath).catch(() => {});
    }
    return NextResponse.json(
      { error: (err as Error)?.message ?? 'internal error' },
      { status: 500 },
    );
  }
}
