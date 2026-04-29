/**
 * GET /api/dev/jpg-list
 * 列出 /jpg 目录下所有 .jpg/.png 文件名（开发模式专用）。
 * 生产构建中如未启用 ENABLE_DEV_JPG_PICKER，返回 403。
 */

import { NextResponse } from 'next/server';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

export const runtime = 'nodejs';

export async function GET() {
  if (process.env.ENABLE_DEV_JPG_PICKER !== 'true') {
    return NextResponse.json({ error: 'jpg picker disabled' }, { status: 403 });
  }
  const dir = path.join(process.cwd(), 'jpg');
  try {
    const names = await readdir(dir);
    const files = await Promise.all(
      names
        .filter((n) => /\.(jpe?g|png)$/i.test(n))
        .map(async (name) => {
          const s = await stat(path.join(dir, name));
          return { name, size: s.size };
        }),
    );
    files.sort((a, b) => a.name.localeCompare(b.name, 'zh'));
    return NextResponse.json({ files });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error)?.message ?? 'cannot read jpg dir', files: [] },
      { status: 200 },
    );
  }
}
