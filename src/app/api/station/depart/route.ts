/**
 * POST /api/station/depart
 *
 * P2 阶段只支持 trip_type='visit'。学校 / 广场分别在 P3 / P5 加分支。
 *
 * body: { trip_type: 'visit', purpose_type: VisitPurposeType, purpose_question?: string, host_preset_id?: string }
 *
 * 同步：校验 + 建 trip（status=traveling）→ 立即返回 trip_id
 * 异步：fire-and-forget 跑 LLM 写报告，最后把 trip 标记 returned
 *
 * 客户端流程：
 *   1. POST depart → 拿 trip_id
 *   2. 跳 /station/traveling?trip_id=X
 *   3. 客户端轮询 GET /api/station/trip/[id]，status=returned 时跳报告页
 *
 * 状态码：
 *   200: { trip_id, status: 'traveling', host }
 *   400: validation_error / not_graduated / locked / daily_limit_reached / ask_question_requires_question
 *   404: no_companion
 */

import { NextResponse } from 'next/server';

import { findCompanionForSingleUser, getCompanionById } from '@/lib/db/repos';
import { startVisit, finishVisit } from '@/lib/orchestrate/processVisit';
import type { TripType, VisitPurposeType } from '@/types';

export const runtime = 'nodejs';
export const maxDuration = 30;

const VISIT_PURPOSES: VisitPurposeType[] = [
  'meet_friend',
  'observe_home',
  'introduce_self',
  'ask_question',
];

function badRequest(code: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: code, ...(extra ?? {}) }, { status: 400 });
}

export async function POST(req: Request) {
  let body: {
    companion_id?: string;
    trip_type?: TripType;
    purpose_type?: VisitPurposeType;
    purpose_question?: string;
    host_preset_id?: string;
  };
  try {
    body = await req.json();
  } catch {
    return badRequest('invalid_json');
  }

  if (body.trip_type !== 'visit') {
    return badRequest('unsupported_trip_type', {
      message: '当前 P2 仅支持 visit；school 与 plaza 在 P3 / P5 阶段开放',
    });
  }
  if (!body.purpose_type || !VISIT_PURPOSES.includes(body.purpose_type)) {
    return badRequest('invalid_purpose_type', { allowed: VISIT_PURPOSES });
  }

  const companion = body.companion_id
    ? await getCompanionById(body.companion_id)
    : await findCompanionForSingleUser();
  if (!companion) {
    return NextResponse.json({ error: 'no_companion' }, { status: 404 });
  }

  let started;
  try {
    started = await startVisit({
      companionId: companion.id,
      purposeType: body.purpose_type,
      purposeQuestion: body.purpose_question,
      hostPresetId: body.host_preset_id,
    });
  } catch (e) {
    const msg = (e as Error)?.message ?? 'unknown';
    if (
      msg === 'not_graduated' ||
      msg === 'daily_limit_reached' ||
      msg.startsWith('locked:') ||
      msg === 'ask_question_requires_question'
    ) {
      return badRequest(msg);
    }
    console.error('[/api/station/depart]', e);
    return NextResponse.json({ error: 'internal_error', detail: msg }, { status: 500 });
  }

  // fire-and-forget 跑 LLM；finishVisit 内部捕获所有错误并写兜底报告
  const tripId = started.trip.id;
  const hostPresetId = started.host.preset_id;
  void finishVisit({
    tripId,
    companionId: companion.id,
    hostPresetId,
    purposeType: body.purpose_type,
    purposeQuestion: body.purpose_question,
  });

  return NextResponse.json({
    trip_id: tripId,
    status: 'traveling',
    host: started.host,
  });
}
