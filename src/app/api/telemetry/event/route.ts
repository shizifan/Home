/**
 * POST /api/telemetry/event
 *
 * 通用客户端遥测端点。最小集合：
 *   { event: string, ms?: number, source?: string, meta?: object }
 *
 * 写到 llm_call_log（call_type='client_telemetry'，用现有表避免再加表）：
 *   - call_type        = 'client_telemetry'
 *   - model            = event 名（如 'describe_e2e' / 'describe_first_card'）
 *   - latency_ms       = 客户端报的耗时
 *   - prompt_version   = source（如 'describe/voice' / 'describe/text'）
 *   - companion_id     = 当前用户的 companion_id（可选）
 *
 * 因为只供监控聚合，无幂等性 / 不返回内容。失败静默。
 *
 * PRD §28.4 描述卡片总时长中位数 ≤ 15s 的统计来源。
 */

import { NextResponse } from 'next/server';
import { execute } from '@/lib/db/client';
import { resolveCurrentUser } from '@/lib/auth/session';

export const runtime = 'nodejs';

const ALLOWED_EVENTS = new Set([
  'describe_e2e',
  'describe_first_card',
  'describe_revise',
  'voice_record_duration',
  'asr_duration',
  'visit_e2e',
  'school_e2e',
  'plaza_act_e2e',
  'day7_view_total',
]);

interface Body {
  event?: string;
  ms?: number;
  source?: string;
  companion_id?: string;
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const event = (body.event ?? '').trim();
  if (!event || !ALLOWED_EVENTS.has(event)) {
    return NextResponse.json({ ok: false, error: 'unknown_event' }, { status: 400 });
  }
  const ms = Number(body.ms ?? 0);
  if (!Number.isFinite(ms) || ms < 0 || ms > 24 * 60 * 60 * 1000) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // 解析当前 user → 取其 companion_id（telemetry 不强制 user，但有更好）
  let companionId: string | undefined = body.companion_id;
  if (!companionId) {
    const user = await resolveCurrentUser();
    if (user) {
      const { findCompanionByUserId } = await import('@/lib/db/repos');
      const c = await findCompanionByUserId(user.id);
      companionId = c?.id;
    }
  }

  // 直接写 llm_call_log（约定 call_type='client_telemetry'）；
  // 不走 logLLMCall 的 LLM_LOG_TO_DB dev gate（telemetry 始终落盘）
  try {
    await execute(
      `insert into llm_call_log
         (companion_id, call_type, model, latency_ms, success, prompt_version)
       values
         (:cid, 'client_telemetry', :model, :lat, true, :pv)`,
      {
        cid: companionId ?? null,
        model: event,
        lat: Math.round(ms),
        pv: body.source?.slice(0, 100) ?? null,
      },
    );
  } catch (err) {
    // 静默失败 — telemetry 不能阻塞用户
    console.warn('[telemetry/event]', err);
  }

  return NextResponse.json({ ok: true });
}
