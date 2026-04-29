/**
 * 本地文件存储（P2 阶段）
 * 文件落到 public/uploads/{companion_id}/{day}/{timestamp}.{ext}
 * Next.js 自动把 public/* 暴露到 /uploads/*，前端用 photo_url = `/uploads/...` 即可。
 */

import 'server-only';
import { mkdir, writeFile, copyFile } from 'node:fs/promises';
import path from 'node:path';

const UPLOAD_BASE = path.join(process.cwd(), 'public', 'uploads');

export async function saveUploadedBuffer(args: {
  companionId: string;
  day: number;
  buf: Buffer;
  ext: string;
}): Promise<string> {
  const dir = path.join(UPLOAD_BASE, args.companionId, String(args.day));
  await mkdir(dir, { recursive: true });
  const filename = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${args.ext}`;
  const fullPath = path.join(dir, filename);
  await writeFile(fullPath, args.buf);
  return `/uploads/${args.companionId}/${args.day}/${filename}`;
}

export async function copyJpgToUploads(args: {
  companionId: string;
  day: number;
  /** 来自 /jpg 目录的文件名（不含路径）*/
  jpgFilename: string;
}): Promise<{ url: string; absPath: string }> {
  const src = path.join(process.cwd(), 'jpg', args.jpgFilename);
  const dir = path.join(UPLOAD_BASE, args.companionId, String(args.day));
  await mkdir(dir, { recursive: true });
  const filename = `${Date.now()}_${path.basename(args.jpgFilename)}`;
  const fullPath = path.join(dir, filename);
  await copyFile(src, fullPath);
  return {
    url: `/uploads/${args.companionId}/${args.day}/${filename}`,
    absPath: fullPath,
  };
}

export function uploadAbsPath(url: string): string {
  // /uploads/xxx/yyy/zzz.jpg → public/uploads/xxx/yyy/zzz.jpg
  if (!url.startsWith('/uploads/')) throw new Error('not an uploads url');
  return path.join(process.cwd(), 'public', url);
}
