/**
 * 前端 API client — 薄封装 fetch
 */

export interface CompanionStateResponse {
  companion: {
    id: string;
    preset_id: string;
    custom_name: string | null;
    display_name: string;
    current_day: number;
    starting_personality: string;
    /** P2: 是否已毕业（worldview 已生成时为 true）*/
    graduated?: boolean;
    /** P4: 玩过 1 次广场后置 true → 主页 BottomNav 显示"行囊"入口（PRD §11.6）*/
    has_played_plaza?: boolean;
  } | null;
  last_companion_line: string | null;
  last_companion_line_source: string | null;
  /** P2: 整天没打开后的"等你一天"台词；非缺席时为 null */
  missed_day_greeting?: string | null;
  /** PRD §5.5 / §18.2 中断恢复台词；30s‑10min 内重访才有 */
  session_resume_greeting?: string | null;
  /** PRD §8.9 拿不准 + 放下 ≥2 时主页伙伴主动打招呼 */
  has_pending_clarifications?: boolean;
  /** PRD §8.9 Day 1 完成后引导孩子打开记忆面板 */
  should_hint_brain_panel?: boolean;
  today_task: { id: string; kind: string; title: string; description: string } | null;
  today_done?: boolean;
  can_advance?: boolean;
  can_view_worldview?: boolean;
  photos: Array<{ id: string; url: string; day: number }>;
  /** V0.6.1：纸片插画卡片（已确认的）*/
  cards?: Array<{
    id: string;
    memory_id: string;
    image_url: string | null;
    is_fallback_text_card: boolean;
    day: number;
    /** 孩子描述时说的原话 */
    description: string;
  }>;
  has_unread_memory: boolean;
  memory_bank_summary: { remembered: number; uncertain: number; set_aside: number };
  remembered_concepts?: Array<{
    concept_name: string;
    concept_category?: string;
    ai_summary?: string;
  }>;
}

export async function askChat(
  question: string,
): Promise<{ reply: string; source: 'free_chat' | 'safety_filter' }> {
  const r = await fetch('/api/chat/ask', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ question }),
  });
  if (!r.ok) {
    const err = (await r.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `chat ask ${r.status}`);
  }
  return r.json();
}

export async function deleteCard(cardId: string): Promise<void> {
  const r = await fetch(`/api/cards/${encodeURIComponent(cardId)}/delete`, {
    method: 'POST',
  });
  if (!r.ok) {
    const err = (await r.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `delete card ${r.status}`);
  }
}

export async function advanceDay(): Promise<{ ok: boolean; new_day: number; opening: string | null }> {
  const r = await fetch('/api/companion/advance', { method: 'POST' });
  if (!r.ok) {
    const err = (await r.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `advance ${r.status}`);
  }
  return r.json();
}

export interface TaskSubmitResponse {
  photo_url?: string;
  vision_tags?: unknown;
  memory_update: { action: string; concept: string; reasoning?: string; memory_bank_id?: string };
  companion_response: string;
  response_source: 'llm' | 'fallback';
}

export async function getCompanionState(): Promise<CompanionStateResponse> {
  const r = await fetch('/api/companion/state', { cache: 'no-store' });
  if (!r.ok) throw new Error(`state ${r.status}`);
  return r.json();
}

export async function createCompanion(args: {
  preset_id: string;
  custom_name?: string;
}): Promise<{ companion: { id: string; preset_id: string; custom_name: string | null; current_day: number } }> {
  const r = await fetch('/api/companion/create', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!r.ok) throw new Error(`create ${r.status}`);
  return r.json();
}

export async function submitText(args: {
  companion_id: string;
  task_id: string;
  user_text: string;
}): Promise<TaskSubmitResponse> {
  const r = await fetch('/api/text/submit', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!r.ok) throw new Error(`submit text ${r.status}`);
  return r.json();
}

export async function skipTask(args: {
  companion_id: string;
  task_id: string;
}): Promise<TaskSubmitResponse> {
  const r = await fetch('/api/task/skip', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!r.ok) throw new Error(`skip ${r.status}`);
  return r.json();
}

/**
 * P1 fix: Day 6 纠正动作触发 / Day 7 看完档案触发。
 * 仅 task_id ∈ {'day6_review', 'day7_worldview'} 有效。
 */
export async function completeTask(args: {
  companion_id?: string;
  task_id: 'day6_review' | 'day7_worldview';
}): Promise<{ ok: boolean; action: 'marked_done' | 'noop_already_done' }> {
  const r = await fetch('/api/task/complete', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!r.ok) {
    const body = (await r.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `complete ${r.status}`);
  }
  return r.json();
}

// ──────────────────── 对话时间线 ────────────────────

export type TimelineItem =
  | { kind: 'day_break'; day: number; title: string }
  | {
      kind: 'companion';
      id: string;
      content: string;
      source: string;
      day: number;
      at: string;
    }
  | {
      kind: 'child_photo';
      id: string;
      photo_url: string;
      tags?: string[];
      user_text?: string;
      day: number;
      at: string;
    }
  | {
      kind: 'child_text';
      id: string;
      text: string;
      day: number;
      at: string;
    }
  | {
      kind: 'child_skip';
      id: string;
      day: number;
      at: string;
    };

export interface TimelineResponse {
  companion_display_name: string;
  preset_id: string;
  items: TimelineItem[];
}

export async function getTimeline(): Promise<TimelineResponse> {
  const r = await fetch('/api/conversation/timeline', { cache: 'no-store' });
  if (!r.ok) throw new Error(`timeline ${r.status}`);
  return r.json();
}

export interface MemoryBankResponse {
  remembered: MemoryBankCardData[];
  uncertain: MemoryBankCardData[];
  set_aside: MemoryBankCardData[];
  unknown: MemoryBankCardData[];
}

/**
 * 拜访池伙伴 preset_id → 显示名映射（前端用）。
 * 包含 4 系统预设伙伴 + 8 主角伙伴。
 * 真实毕业用户的 source_companion_id 是 UUID，这里查不到 → 返回 null，
 * 由调用方降级为通用 "另一只朋友"。
 */
const PRESET_NAMES: Record<string, string> = {
  // 系统预设池（4 只极端对照组）
  xiaoyu: '小鱼',
  tudou: '土豆',
  xingxing: '星星',
  amu: '阿木',
  // 主角池（8 只）
  xiaoqinglong: '小青龙',
  dabear: '大熊',
  xiaohuolong: '小火龙',
  tengtengshe: '藤藤蛇',
  xiaolvlong: '小绿龙',
  linnabel: '琳娜贝尔',
  xiaolaohu: '小老虎',
  xiaoshizi: '小狮子',
};

export function presetCompanionDisplayName(
  presetIdOrCompanionId: string | null | undefined,
): string | null {
  if (!presetIdOrCompanionId) return null;
  return PRESET_NAMES[presetIdOrCompanionId] ?? null;
}

export interface MemoryBankCardData {
  id: string;
  concept_name: string;
  concept_category?: string;
  ai_summary?: string;
  ai_reasoning?: string;
  evidence?: Array<{ memory_id: string; day: number; excerpt: string }>;
  confidence: number;
  /** P2: PRD §12.7 来源类型；'secondhand' 显示二手知识标识 */
  source_type?: 'firsthand' | 'secondhand';
  source_companion_id?: string | null;
  user_corrected: boolean;
  user_correction_history?: Array<{
    action: string;
    at: string;
    payload?: Record<string, unknown>;
  }>;
  last_updated: string;
}

export async function getMemoryBank(): Promise<MemoryBankResponse> {
  const r = await fetch('/api/memory/bank', { cache: 'no-store' });
  if (!r.ok) throw new Error(`memory bank ${r.status}`);
  return r.json();
}

// ──────────────────── 记忆面板纠正 ────────────────────

export type CorrectAction =
  | 'restore'
  | 'dismiss'
  | 'clarify'
  | 'rename'
  | 'merge'
  | 'inform'
  | 'withhold';

export interface CorrectResponse {
  feedback: string;
  newType?: 'remembered' | 'uncertain' | 'set_aside' | 'unknown';
  newConceptName?: string;
}

export async function correctMemory(args: {
  memory_id: string;
  action: CorrectAction;
  params?: { clarification?: string; newName?: string; targetMemoryId?: string };
}): Promise<CorrectResponse> {
  const r = await fetch('/api/memory/correct', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!r.ok) throw new Error(`correct ${r.status}`);
  return r.json();
}

// ──────────────────── 概念详情 ────────────────────

export interface ConceptDetailResponse {
  id: string;
  concept_name: string;
  concept_category?: string;
  understanding: string;
  reasoning: string;
  evidence_rephrased: Array<{ day: number; text: string }>;
  raw_evidence: Array<{ day: number; excerpt: string; memory_id: string }>;
  source: 'cache' | 'llm' | 'fallback';
}

export async function getConceptDetail(id: string): Promise<ConceptDetailResponse> {
  const r = await fetch(`/api/memory/concept/${id}`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`concept ${r.status}`);
  return r.json();
}

export async function listJpgFiles(): Promise<{ files: Array<{ name: string; size: number }> }> {
  const r = await fetch('/api/dev/jpg-list', { cache: 'no-store' });
  if (!r.ok) return { files: [] };
  return r.json();
}

// ──────────────────── 家长监控 ────────────────────

export interface MonitorAggregate {
  call_type: string;
  total: number;
  ok: number;
  success_rate: number;
  avg_ms: number | null;
  max_ms: number | null;
  p95_ms: number | null;
  avg_in_tok: number | null;
  avg_out_tok: number | null;
  sum_in_tok: number | null;
  sum_out_tok: number | null;
}

export interface MonitorRecent {
  id: number;
  call_type: string;
  model: string | null;
  success: boolean;
  fail_reason: string | null;
  latency_ms: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  created_at: string;
}

export interface MonitorCostByModel {
  model: string;
  calls: number;
  sum_in: number;
  sum_out: number;
  cost_cny: number;
}

export interface MonitorResponse {
  aggregates: MonitorAggregate[];
  recent: MonitorRecent[];
  cost_by_model: MonitorCostByModel[];
  total_cost_cny: number;
}

export async function getMonitor(): Promise<MonitorResponse> {
  const r = await fetch('/api/parent/monitor', { cache: 'no-store' });
  if (!r.ok) throw new Error(`monitor ${r.status}`);
  return r.json();
}

// ──────────────────── Day 7 档案 ────────────────────

export interface WorldviewData {
  most_important_person: string | null;
  most_fun_thing: string | null;
  most_delicious_thing: string | null;
  most_scary_thing: string | null;
  unknown_thing: string | null;
  almost_forgot_thing: string | null;
  stats: { photos: number; conversations: number; corrections: number } | null;
  generated_at: string;
}

export async function generateWorldview(): Promise<{
  worldview: WorldviewData;
  from_cache: boolean;
}> {
  // 客户端 90s 超时；后端 maxDuration=30s + 重试 3×15s + soft fallback，正常应在 60s 内返回
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 90_000);
  try {
    const r = await fetch('/api/day7/generate', {
      method: 'POST',
      signal: ctrl.signal,
    });
    if (r.status === 503) {
      const err = (await r.json().catch(() => ({}))) as { message?: string };
      throw new Day7FailureError(err.message ?? '我有点累了，等会儿再来吧');
    }
    if (!r.ok) throw new Error(`day7 ${r.status}`);
    return r.json();
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') {
      throw new Day7FailureError('它想了好久没整理完，等一会儿再来？');
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export async function getWorldview(): Promise<WorldviewData | null> {
  const r = await fetch('/api/day7/generate', { cache: 'no-store' });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`day7 get ${r.status}`);
  const j = (await r.json()) as { worldview: WorldviewData };
  return j.worldview;
}

export class Day7FailureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'Day7FailureError';
  }
}

// ──────────────────── 多用户软隔离（P6 §27.2）────────────────────

export interface AuthMeResponse {
  user: { id: string; nickname: string | null; created_at: string } | null;
}

export async function fetchMe(): Promise<AuthMeResponse> {
  const r = await fetch('/api/auth/me', { cache: 'no-store' });
  if (!r.ok) throw new Error(`auth me ${r.status}`);
  return r.json();
}

export interface AuthStartResponse {
  user_id: string;
  nickname: string;
  created: boolean;
  homonym_count: number;
}

export async function authStart(args: {
  nickname: string;
  fingerprint: string;
}): Promise<AuthStartResponse> {
  const r = await fetch('/api/auth/start', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-home-fingerprint': args.fingerprint,
    },
    body: JSON.stringify(args),
  });
  if (!r.ok) {
    const body = (await r.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `auth start ${r.status}`);
  }
  return r.json();
}

export interface AuthLookupMatch {
  user_id: string;
  nickname: string;
  created_at: string;
  last_active_at: string | null;
}

export async function authLookup(nickname: string): Promise<AuthLookupMatch[]> {
  const r = await fetch('/api/auth/lookup', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ nickname }),
  });
  if (!r.ok) throw new Error(`auth lookup ${r.status}`);
  const body = (await r.json()) as { matches: AuthLookupMatch[] };
  return body.matches;
}

export async function authResume(userId: string): Promise<{ user_id: string; nickname: string | null }> {
  const r = await fetch('/api/auth/resume', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ user_id: userId }),
  });
  if (!r.ok) throw new Error(`auth resume ${r.status}`);
  return r.json();
}

// ──────────────────── 行囊（P4）────────────────────

export type ItemCategoryClient = 'knowledge' | 'object' | 'gift' | 'ability';

export interface InventoryItemView {
  id: string; // inventory_items.id
  item_id: string;
  name: string;
  category: ItemCategoryClient;
  description: string;
  detailed_description: string;
  icon: string;
  use_count: number;
  last_used_at?: string | null;
  acquired_at: string;
  acquired_from?: string | null;
  is_upgraded_from?: string | null;
}

export interface InventoryResponse {
  companion_id: string;
  items: InventoryItemView[];
  grouped: {
    knowledge: InventoryItemView[];
    object: InventoryItemView[];
    gift: InventoryItemView[];
    ability: InventoryItemView[];
  };
}

export async function getInventory(): Promise<InventoryResponse> {
  const r = await fetch('/api/inventory', { cache: 'no-store' });
  if (!r.ok) throw new Error(`inventory ${r.status}`);
  return r.json();
}

export async function getInventoryItem(id: string) {
  const r = await fetch(`/api/inventory/${encodeURIComponent(id)}`, {
    cache: 'no-store',
  });
  if (!r.ok) throw new Error(`inventory item ${r.status}`);
  return r.json() as Promise<{
    item: InventoryItemView;
    applicable_scenarios: string[];
    upgrade_to: string | null;
  }>;
}

// ──────────────────── 广场（P4 准备页 / P5 剧本进行）────────────────────

export interface PlazaPrepareResponse {
  today_used: boolean;
  scenario: {
    id: string;
    title: string;
    type: string;
    background: string;
    intro: string;
    played_times: number;
  };
  roles: Array<{
    preset_id: string;
    role: string;
    name: string;
    appearance: string;
  }>;
  inventory: InventoryResponse;
  applicable_item_ids: string[];
  starter_pack_granted: string[] | null;
}

// ─── 广场剧本进行 ───

export interface PlazaStartResponse {
  play_id: string;
  trip_id: string;
  scenario: {
    id: string;
    title: string;
    background: string;
    intro: string;
  };
  selected_items: Array<{
    inventory_row_id: string;
    item_id: string;
    item_name: string;
  }>;
  repeat_hint: string | null;
  played_times_before: number;
}

export async function startPlazaPlay(args: {
  scenario_id: string;
  item_row_ids: [string, string, string];
}): Promise<PlazaStartResponse> {
  const r = await fetch('/api/station/plaza/play', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'start', ...args }),
  });
  if (!r.ok) {
    const body = (await r.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `plaza start ${r.status}`);
  }
  return r.json();
}

export interface PlazaActResponse {
  act: {
    scene_narrative: string;
    small_blue_dragon_speech: string;
    other_response: string;
    next_act_hook: string;
    item_use_quality: 'natural' | 'stretched' | 'skipped';
  };
  is_final_act: boolean;
  selected_item: {
    inventory_row_id: string;
    item_id: string;
    item_name: string;
  } | null;
}

export async function runPlazaAct(args: {
  play_id: string;
  act_number: 1 | 2 | 3;
  item_row_id: string | null;
}): Promise<PlazaActResponse> {
  const r = await fetch('/api/station/plaza/play', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'act', ...args }),
  });
  if (!r.ok) {
    const body = (await r.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `plaza act ${r.status}`);
  }
  return r.json();
}

export interface PlazaEndingResponse {
  ending: {
    ending_type: 'perfect' | 'good' | 'barely';
    ending_narrative: string;
    king_evaluation: string;
    earned_items: Array<{
      item_id: string;
      item_name: string;
      acquisition_reason: string;
    }>;
  };
  earned_items: Array<{
    item_id: string;
    item_name: string;
    acquisition_reason: string;
    inventory_row_id: string;
    is_new: boolean;
    is_upgrade?: boolean;
  }>;
  source: 'llm' | 'fallback';
}

export async function finishPlazaPlay(playId: string): Promise<PlazaEndingResponse> {
  const r = await fetch('/api/station/plaza/play', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'finish', play_id: playId }),
  });
  if (!r.ok) {
    const body = (await r.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `plaza finish ${r.status}`);
  }
  return r.json();
}

export interface PlazaPlayStateResponse {
  play_id: string;
  scenario_id: string;
  scenario_title: string | null;
  acts_done: number;
  acts: Array<{
    act: 1 | 2 | 3;
    item_id: string | null;
    quality?: 'natural' | 'stretched' | 'skipped';
    narrative?: string;
    small_blue_dragon_speech?: string;
    other_response?: string;
    next_act_hook?: string;
  }>;
  finished: boolean;
  ending_type: string | null;
  ending_narrative: string | null;
}

export async function getPlazaPlayState(
  playId: string,
): Promise<PlazaPlayStateResponse> {
  const r = await fetch(
    `/api/station/plaza/play?play_id=${encodeURIComponent(playId)}`,
    { cache: 'no-store' },
  );
  if (!r.ok) throw new Error(`plaza state ${r.status}`);
  return r.json();
}

export async function getPlazaPrepare(): Promise<PlazaPrepareResponse> {
  const r = await fetch('/api/station/plaza/prepare', { cache: 'no-store' });
  if (!r.ok) {
    const body = (await r.json().catch(() => ({}))) as {
      error?: string;
      hint?: string;
    };
    const e = new Error(body.error ?? `plaza prepare ${r.status}`);
    (e as Error & { hint?: string }).hint = body.hint;
    throw e;
  }
  return r.json();
}

// ──────────────────── 驿站（P2）────────────────────

export interface StationStatusResponse {
  companion_id: string;
  graduated: boolean;
  unlocked: { visit: boolean; school: boolean; plaza: boolean };
  counts: {
    visit_returned: number;
    school_returned: number;
    plaza_returned: number;
  };
  today_used: boolean;
  today_limit: number;
}

export async function getStationStatus(): Promise<StationStatusResponse> {
  const r = await fetch('/api/station/status', { cache: 'no-store' });
  if (!r.ok) throw new Error(`station status ${r.status}`);
  return r.json();
}

export type VisitPurpose =
  | 'meet_friend'
  | 'observe_home'
  | 'introduce_self'
  | 'ask_question';

export type SchoolPurpose =
  | 'attend_class'
  | 'ask_my_question'
  | 'observe_others'
  | 'learn_new';

export interface DepartVisitArgs {
  trip_type: 'visit';
  purpose_type: VisitPurpose;
  purpose_question?: string;
  host_preset_id?: string;
}

export interface DepartSchoolArgs {
  trip_type: 'school';
  purpose_type: SchoolPurpose;
  purpose_question?: string;
}

export interface DepartVisitResponse {
  trip_id: string;
  status: 'traveling';
  host: {
    preset_id: string;
    name: string;
    appearance: string;
    is_system_preset: boolean;
  };
}

export interface DepartSchoolResponse {
  trip_id: string;
  status: 'traveling';
  classmate_names: string[];
  question_text: string;
  question_source: 'system' | 'child';
}

export async function depart(args: DepartVisitArgs): Promise<DepartVisitResponse>;
export async function depart(args: DepartSchoolArgs): Promise<DepartSchoolResponse>;
export async function depart(
  args: DepartVisitArgs | DepartSchoolArgs,
): Promise<DepartVisitResponse | DepartSchoolResponse> {
  const r = await fetch('/api/station/depart', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!r.ok) {
    const body = (await r.json().catch(() => ({}))) as { error?: string; message?: string };
    const e = new Error(body.error ?? `depart ${r.status}`);
    // 把 server 的 friendly message 暴露给前端用
    (e as Error & { friendlyMessage?: string }).friendlyMessage = body.message;
    throw e;
  }
  return r.json();
}

/** @deprecated 留给历史调用兼容；新代码直接用 depart() 重载 */
export type DepartResponse = DepartVisitResponse;

export async function getTrip(tripId: string) {
  const r = await fetch(`/api/station/trip/${encodeURIComponent(tripId)}`, {
    cache: 'no-store',
  });
  if (!r.ok) throw new Error(`trip ${r.status}`);
  return r.json() as Promise<{ trip: Record<string, unknown> }>;
}

export async function importTripMemory(tripId: string) {
  const r = await fetch('/api/station/memory/import', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ trip_id: tripId }),
  });
  if (!r.ok) {
    const body = (await r.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `import ${r.status}`);
  }
  return r.json() as Promise<{
    memory_bank_id: string;
    action: 'created' | 'skipped';
  }>;
}

// ──────────────────── Day 5 选择题（PRD §5.6 双题，Q2 动态）────────────────────

export interface Day5Question {
  question: string;
  options: string[];
}

interface Day5Response {
  question: Day5Question;
  source: 'llm' | 'fallback';
}

export async function getDay5Q1(): Promise<Day5Response> {
  const r = await fetch('/api/task/day5-questions', { cache: 'no-store' });
  if (!r.ok) throw new Error(`day5 q1 ${r.status}`);
  return r.json();
}

export async function getDay5Q2(args: {
  q1: string;
  a1: string;
}): Promise<Day5Response> {
  const r = await fetch('/api/task/day5-questions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!r.ok) throw new Error(`day5 q2 ${r.status}`);
  return r.json();
}

// ──────────────────── V0.6.1: 语音 + 描述卡片 ────────────────────

export interface VoiceUploadResponse {
  transcription: string;
  confidence: number;
  duration_seconds: number;
  voice_audio_url: string;
}

export class VoiceUploadError extends Error {
  reason: 'asr_empty' | 'asr_unavailable' | 'asr_safety_block' | 'asr_unsupported' | 'audio_too_large' | 'http';
  voiceAudioUrl?: string;
  constructor(reason: VoiceUploadError['reason'], message: string, voiceAudioUrl?: string) {
    super(message);
    this.reason = reason;
    this.voiceAudioUrl = voiceAudioUrl;
  }
}

export async function uploadVoice(args: {
  companionId: string;
  blob: Blob;
  ext?: string;
}): Promise<VoiceUploadResponse> {
  const fd = new FormData();
  fd.append('companion_id', args.companionId);
  const ext = args.ext ?? (args.blob.type.includes('mp4') ? 'mp4' : 'webm');
  fd.append('audio', args.blob, `voice.${ext}`);
  const r = await fetch('/api/voice/upload', { method: 'POST', body: fd });
  const body = (await r.json().catch(() => ({}))) as {
    error?: VoiceUploadError['reason'];
    message?: string;
    voice_audio_url?: string;
  } & Partial<VoiceUploadResponse>;
  if (!r.ok) {
    throw new VoiceUploadError(
      body.error ?? 'http',
      body.message ?? `voice upload ${r.status}`,
      body.voice_audio_url,
    );
  }
  return body as VoiceUploadResponse;
}

export type ImageGenSource = 'dashscope' | 'minimax';

export interface DescribeSubmitResponse {
  memory_id: string;
  card_id: string;
  image_url: string | null;
  image_source: ImageGenSource | null;
  alt_image_url: string | null;
  alt_image_source: ImageGenSource | null;
  is_fallback_text_card: boolean;
  style_check: {
    passed: boolean | null;
    severity: 'ok' | 'minor' | 'major' | null;
    regenerate_count: number;
    issues: string[];
  };
  memory_update: { action: string; concept: string; reasoning?: string; memory_bank_id?: string };
  companion_response: string;
  response_source: 'llm' | 'fallback';
}

export async function submitDescribe(args: {
  companion_id: string;
  task_id: string;
  description_text: string;
  input_method: 'voice' | 'text';
  voice_audio_url?: string;
  asr_transcription?: string;
  edited_text?: string;
}): Promise<DescribeSubmitResponse> {
  const r = await fetch('/api/describe/submit', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!r.ok) {
    const err = (await r.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `submit describe ${r.status}`);
  }
  return r.json();
}

export interface DescribeReviseResponse {
  memory_id: string;
  card_id: string;
  image_url: string | null;
  image_source: ImageGenSource | null;
  alt_image_url: string | null;
  alt_image_source: ImageGenSource | null;
  is_fallback_text_card: boolean;
  attempt: number;
  is_exhausted: boolean;
  style_check: DescribeSubmitResponse['style_check'];
}

export async function reviseDescribe(args: {
  card_id: string;
  revision_type: 'color' | 'missing' | 'complete_redo';
  revision_text: string;
}): Promise<DescribeReviseResponse> {
  const r = await fetch('/api/describe/revise', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!r.ok) {
    const err = (await r.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `revise ${r.status}`);
  }
  return r.json();
}

export async function confirmDescribe(args: {
  card_id: string;
  auto_timeout?: boolean;
  chosen_source?: ImageGenSource;
}): Promise<{ companion_final_response: string; memory_bank_updated: boolean; already_confirmed?: boolean }> {
  const r = await fetch('/api/describe/confirm', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!r.ok) {
    const err = (await r.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `confirm ${r.status}`);
  }
  return r.json();
}
