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
  } | null;
  last_companion_line: string | null;
  last_companion_line_source: string | null;
  today_task: { id: string; kind: string; title: string; description: string } | null;
  today_done?: boolean;
  can_advance?: boolean;
  can_view_worldview?: boolean;
  photos: Array<{ id: string; url: string; day: number }>;
  has_unread_memory: boolean;
  memory_bank_summary: { remembered: number; uncertain: number; set_aside: number };
  remembered_concepts?: Array<{
    concept_name: string;
    concept_category?: string;
    ai_summary?: string;
  }>;
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

export async function submitPhoto(args: {
  companion_id: string;
  task_id: string;
  file?: File;
  jpg_filename?: string;
  user_text?: string;
}): Promise<TaskSubmitResponse> {
  const fd = new FormData();
  fd.append('companion_id', args.companion_id);
  fd.append('task_id', args.task_id);
  if (args.file) fd.append('image', args.file);
  if (args.jpg_filename) fd.append('jpg_filename', args.jpg_filename);
  if (args.user_text) fd.append('user_text', args.user_text);
  const r = await fetch('/api/photo/upload', { method: 'POST', body: fd });
  if (!r.ok) throw new Error(`submit photo ${r.status}`);
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

export interface MemoryBankCardData {
  id: string;
  concept_name: string;
  concept_category?: string;
  ai_summary?: string;
  ai_reasoning?: string;
  evidence?: Array<{ memory_id: string; day: number; excerpt: string }>;
  confidence: number;
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
  const r = await fetch('/api/day7/generate', { method: 'POST' });
  if (r.status === 503) {
    const err = (await r.json().catch(() => ({}))) as { message?: string; reason?: string };
    throw new Day7FailureError(err.message ?? '我有点累了，等会儿再来吧');
  }
  if (!r.ok) throw new Error(`day7 ${r.status}`);
  return r.json();
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

// ──────────────────── Day 5 选择题 ────────────────────

export interface Day5Question {
  question: string;
  options: string[];
}

export async function getDay5Questions(): Promise<{
  questions: Day5Question[];
  source: 'llm' | 'fallback';
}> {
  const r = await fetch('/api/task/day5-questions', { cache: 'no-store' });
  if (!r.ok) throw new Error(`day5 ${r.status}`);
  return r.json();
}
