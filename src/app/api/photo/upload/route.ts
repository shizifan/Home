/**
 * POST /api/photo/upload
 * multipart/form-data，含：image (File) | jpg_filename (string) + companion_id + task_id
 *
 * 串行：保存文件 → MiniMax Vision → Pass 1 → Pass 2 → 写库
 */

import { NextResponse } from 'next/server';

import { processInput } from '@/lib/orchestrate/processInput';
import { saveUploadedBuffer, copyJpgToUploads, uploadAbsPath } from '@/lib/storage/upload';
import { analyzeImageFile } from '@/lib/vision/client';
import { getCompanionById } from '@/lib/db/repos';
import { getTaskByDay } from '@/lib/tasks';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const companionId = String(form.get('companion_id') ?? '');
    const taskId = String(form.get('task_id') ?? '');
    if (!companionId || !taskId) {
      return NextResponse.json({ error: 'missing companion_id / task_id' }, { status: 400 });
    }

    const companion = await getCompanionById(companionId);
    if (!companion) return NextResponse.json({ error: 'companion not found' }, { status: 404 });

    const task = getTaskByDay(companion.current_day);
    if (!task || task.id !== taskId) {
      return NextResponse.json({ error: 'task does not match current day' }, { status: 400 });
    }

    // 三种来源：file | jpg_filename | (未来可接 OSS direct URL)
    let photoUrl: string;
    let absPath: string;

    const file = form.get('image');
    const jpgFilename = form.get('jpg_filename');

    if (file && file instanceof File) {
      const buf = Buffer.from(await file.arrayBuffer());
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      photoUrl = await saveUploadedBuffer({
        companionId,
        day: companion.current_day,
        buf,
        ext: ext === 'jpeg' ? 'jpg' : ext,
      });
      absPath = uploadAbsPath(photoUrl);
    } else if (typeof jpgFilename === 'string' && jpgFilename) {
      // dev mode：从 /jpg/ 复制
      if (process.env.ENABLE_DEV_JPG_PICKER !== 'true') {
        return NextResponse.json({ error: 'jpg picker disabled' }, { status: 403 });
      }
      const out = await copyJpgToUploads({
        companionId,
        day: companion.current_day,
        jpgFilename,
      });
      photoUrl = out.url;
      absPath = out.absPath;
    } else {
      return NextResponse.json({ error: 'no image or jpg_filename' }, { status: 400 });
    }

    // Vision
    const visionTags = await analyzeImageFile(absPath, companionId);
    // visionTags 可能为 null（失败），processInput 接受 undefined

    // 文字补充（Day 2/3 photo+text）
    const userText = form.get('user_text');
    const text = typeof userText === 'string' ? userText.trim() || undefined : undefined;

    const result = await processInput({
      companionId,
      taskId,
      taskQuestion: task.description,
      inputType: 'photo',
      photoUrl,
      visionTags: visionTags ?? undefined,
      userText: text,
    });

    return NextResponse.json({
      photo_url: photoUrl,
      vision_tags: visionTags,
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
    console.error('[/api/photo/upload]', err);
    return NextResponse.json(
      { error: (err as Error)?.message ?? 'internal error' },
      { status: 500 },
    );
  }
}
