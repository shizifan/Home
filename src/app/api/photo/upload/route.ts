/**
 * POST /api/photo/upload — 已废弃（V0.6.1）
 *
 * V0.6.1 改用语音/文字描述 + AI 生成纸片插画卡片。
 * 新流程：/api/voice/upload (ASR) + /api/describe/submit (生成卡片)。
 *
 * 此路由保留 30 天兼容期返回 410 Gone，便于流量监控。
 */

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST() {
  return NextResponse.json(
    {
      error: 'deprecated',
      message: '此接口已下线，请使用 /api/describe/submit',
      migrate_to: '/api/describe/submit',
    },
    { status: 410 },
  );
}
