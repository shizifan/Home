/**
 * GET /api/dev/jpg/{name}
 * 把 /jpg/{name} 的图片字节直接 stream 回去；用于 dev picker 缩略图。
 */

import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  if (process.env.ENABLE_DEV_JPG_PICKER !== 'true') {
    return NextResponse.json({ error: 'disabled' }, { status: 403 });
  }
  const { name } = await params;
  const decoded = decodeURIComponent(name);
  // 防穿越
  if (decoded.includes('/') || decoded.includes('..')) {
    return NextResponse.json({ error: 'invalid name' }, { status: 400 });
  }
  if (!/\.(jpe?g|png)$/i.test(decoded)) {
    return NextResponse.json({ error: 'unsupported' }, { status: 400 });
  }
  try {
    const file = await readFile(path.join(process.cwd(), 'jpg', decoded));
    const ext = decoded.split('.').pop()!.toLowerCase();
    const ct = ext === 'png' ? 'image/png' : 'image/jpeg';
    return new NextResponse(new Uint8Array(file), {
      status: 200,
      headers: {
        'content-type': ct,
        'cache-control': 'public, max-age=600',
      },
    });
  } catch {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
}
