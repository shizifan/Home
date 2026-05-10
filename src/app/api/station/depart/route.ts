/**
 * POST /api/station/depart
 *
 * 支持：trip_type ∈ {'visit'（P2）, 'school'（P3）}；'plaza' 留 P5。
 *
 * body:
 *   visit:  { trip_type: 'visit', purpose_type, purpose_question?, host_preset_id? }
 *   school: { trip_type: 'school', purpose_type, purpose_question? }
 *
 * 同步：校验 + 建 trip（status=traveling）→ 立即返回 trip_id
 * 异步：fire-and-forget 跑 LLM 写报告
 */

import { NextResponse } from 'next/server';

import { getCompanionById } from '@/lib/db/repos';
import { guardWithCompanion, guardErrorResponse } from '@/lib/auth/apiGuard';
import { startVisit, finishVisit } from '@/lib/orchestrate/processVisit';
import { startSchool, finishSchool } from '@/lib/orchestrate/processSchool';
import { filterChildInput, getInputRejectionLine } from '@/lib/safety/filters';
import type {
  SchoolPurposeType,
  TripType,
  VisitPurposeType,
} from '@/types';

export const runtime = 'nodejs';
export const maxDuration = 30;

const VISIT_PURPOSES: VisitPurposeType[] = [
  'meet_friend',
  'observe_home',
  'introduce_self',
  'ask_question',
];

const SCHOOL_PURPOSES: SchoolPurposeType[] = [
  'attend_class',
  'ask_my_question',
  'observe_others',
  'learn_new',
];

function badRequest(code: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: code, ...(extra ?? {}) }, { status: 400 });
}

export async function POST(req: Request) {
  let body: {
    companion_id?: string;
    trip_type?: TripType;
    purpose_type?: VisitPurposeType | SchoolPurposeType;
    purpose_question?: string;
    host_preset_id?: string;
  };
  try {
    body = await req.json();
  } catch {
    return badRequest('invalid_json');
  }

  if (body.trip_type !== 'visit' && body.trip_type !== 'school') {
    return badRequest('unsupported_trip_type', {
      message: '当前支持 visit / school；plaza 在 P5 开放',
    });
  }

  const guard = await guardWithCompanion(body.companion_id ?? null);
  if (!guard.ok) return guardErrorResponse(guard.code);
  const companion = await getCompanionById(guard.companion.id);
  if (!companion) {
    return NextResponse.json({ error: 'no_companion' }, { status: 404 });
  }

  // ─── visit 分支 ───
  if (body.trip_type === 'visit') {
    if (
      !body.purpose_type ||
      !VISIT_PURPOSES.includes(body.purpose_type as VisitPurposeType)
    ) {
      return badRequest('invalid_purpose_type', { allowed: VISIT_PURPOSES });
    }

    let started;
    try {
      started = await startVisit({
        companionId: companion.id,
        purposeType: body.purpose_type as VisitPurposeType,
        purposeQuestion: body.purpose_question,
        hostPresetId: body.host_preset_id,
      });
    } catch (e) {
      return handleDepartError(e);
    }

    void finishVisit({
      tripId: started.trip.id,
      companionId: companion.id,
      hostPresetId: started.host.preset_id,
      purposeType: body.purpose_type as VisitPurposeType,
      purposeQuestion: body.purpose_question,
    });

    return NextResponse.json({
      trip_id: started.trip.id,
      status: 'traveling',
      host: started.host,
    });
  }

  // ─── school 分支 ───
  if (
    !body.purpose_type ||
    !SCHOOL_PURPOSES.includes(body.purpose_type as SchoolPurposeType)
  ) {
    return badRequest('invalid_purpose_type', { allowed: SCHOOL_PURPOSES });
  }

  // PRD §13.7：孩子出题前敏感词过滤
  if (body.purpose_type === 'ask_my_question') {
    const q = body.purpose_question?.trim() ?? '';
    if (!q) return badRequest('ask_my_question_requires_question');
    const safe = filterChildInput(q);
    if (!safe.ok) {
      return badRequest('question_blocked_by_safety', {
        message: getInputRejectionLine(safe.reason ?? 'other'),
      });
    }
  }

  let startedSchool;
  try {
    startedSchool = await startSchool({
      companionId: companion.id,
      purposeType: body.purpose_type as SchoolPurposeType,
      purposeQuestion: body.purpose_question,
    });
  } catch (e) {
    return handleDepartError(e);
  }

  void finishSchool({
    tripId: startedSchool.trip.id,
    companionId: companion.id,
    purposeType: body.purpose_type as SchoolPurposeType,
    questionText: startedSchool.question_text,
  });

  return NextResponse.json({
    trip_id: startedSchool.trip.id,
    status: 'traveling',
    classmate_names: startedSchool.classmate_names,
    question_text: startedSchool.question_text,
    question_source: startedSchool.question_source,
  });
}

function handleDepartError(e: unknown) {
  const msg = (e as Error)?.message ?? 'unknown';
  if (
    msg === 'not_graduated' ||
    msg === 'daily_limit_reached' ||
    msg.startsWith('locked:') ||
    msg === 'ask_question_requires_question' ||
    msg === 'ask_my_question_requires_question'
  ) {
    return badRequest(msg);
  }
  console.error('[/api/station/depart]', e);
  return NextResponse.json(
    { error: 'internal_error', detail: msg },
    { status: 500 },
  );
}
