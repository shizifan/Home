/**
 * POST /api/station/plaza/play
 *
 * 三种 action：
 *   - { action: 'start', scenario_id, item_row_ids: [r1,r2,r3] }
 *     → 创建 trip + plaza_play；返回 play_id + 剧本 + 选定道具 + 第二次玩特殊台词
 *   - { action: 'act', play_id, act_number, item_row_id|null }
 *     → 跑该幕 LLM；返回 scene_narrative / 小青龙台词 / others / next_hook
 *   - { action: 'finish', play_id }
 *     → 跑结局 LLM + 计算 rewards + 落 inventory + 关 trip
 *
 * GET /api/station/plaza/play?play_id=...
 *   → 查当前 play 状态（用于刷新 / 中途回来）
 */

import { NextResponse } from 'next/server';

import {
  finishPlaza,
  getPlazaPlayState,
  runAct,
  startPlaza,
} from '@/lib/orchestrate/processPlaza';

export const runtime = 'nodejs';
export const maxDuration = 30;

function badRequest(code: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: code, ...(extra ?? {}) }, { status: 400 });
}

interface StartBody {
  action: 'start';
  companion_id?: string;
  scenario_id: string;
  item_row_ids: [string, string, string];
}

interface ActBody {
  action: 'act';
  play_id: string;
  act_number: 1 | 2 | 3;
  item_row_id: string | null;
}

interface FinishBody {
  action: 'finish';
  play_id: string;
}

type Body = StartBody | ActBody | FinishBody;

function handleErr(e: unknown) {
  const msg = (e as Error)?.message ?? 'unknown';
  const known = new Set([
    'not_graduated',
    'daily_limit_reached',
    'scenario_not_found',
    'companion_not_found',
    'play_not_found',
    'play_already_finished',
    'items_must_be_distinct',
    'invalid_item_row',
  ]);
  if (known.has(msg) || msg.startsWith('locked:') || msg.startsWith('out_of_order_act:')) {
    return badRequest(msg);
  }
  if (msg.startsWith('incomplete_acts:')) return badRequest(msg);
  if (msg.startsWith('invalid_item_row:')) return badRequest(msg);
  if (msg === 'act_already_done') return badRequest(msg);
  console.error('[/api/station/plaza/play]', e);
  return NextResponse.json({ error: 'internal_error', detail: msg }, { status: 500 });
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return badRequest('invalid_json');
  }

  if (body.action === 'start') {
    const cid = body.companion_id;
    const { findCompanionForSingleUser, getCompanionById } = await import(
      '@/lib/db/repos'
    );
    const companion = cid
      ? await getCompanionById(cid)
      : await findCompanionForSingleUser();
    if (!companion) {
      return NextResponse.json({ error: 'no_companion' }, { status: 404 });
    }
    if (
      !body.scenario_id ||
      !Array.isArray(body.item_row_ids) ||
      body.item_row_ids.length !== 3
    ) {
      return badRequest('invalid_start_args');
    }
    try {
      const r = await startPlaza({
        companionId: companion.id,
        scenarioId: body.scenario_id,
        selectedItemRowIds: body.item_row_ids,
      });
      return NextResponse.json({
        play_id: r.play_id,
        trip_id: r.trip_id,
        scenario: {
          id: r.scenario.id,
          title: r.scenario.title,
          background: r.scenario.background,
          intro: r.scenario.intro,
        },
        selected_items: r.selected_items,
        repeat_hint: r.repeat_hint,
        played_times_before: r.played_times_before,
      });
    } catch (e) {
      return handleErr(e);
    }
  }

  if (body.action === 'act') {
    if (!body.play_id || ![1, 2, 3].includes(body.act_number)) {
      return badRequest('invalid_act_args');
    }
    try {
      const r = await runAct({
        playId: body.play_id,
        actNumber: body.act_number,
        selectedItemRowId: body.item_row_id ?? null,
      });
      return NextResponse.json({
        act: r.act,
        is_final_act: r.is_final_act,
        selected_item: r.selected_item,
      });
    } catch (e) {
      return handleErr(e);
    }
  }

  if (body.action === 'finish') {
    if (!body.play_id) return badRequest('missing_play_id');
    try {
      const r = await finishPlaza(body.play_id);
      return NextResponse.json({
        ending: r.ending,
        earned_items: r.earned_items,
        source: r.source,
      });
    } catch (e) {
      return handleErr(e);
    }
  }

  return badRequest('unsupported_action');
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const playId = url.searchParams.get('play_id');
  if (!playId) return badRequest('missing_play_id');
  const state = await getPlazaPlayState(playId);
  if (!state) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json(state);
}
