/**
 * 业务层数据访问 — 把 SQL 屏蔽在这一层。
 * 上层 API route 只调这里的方法。
 */

import 'server-only';

import { execute, query, queryOne, SINGLE_USER_ID, uuid } from './client';
import type {
  Companion,
  ConceptCategory,
  ConversationLine,
  CorrectionEvent,
  DayNumber,
  Memory,
  MemoryBankEntry,
  MemoryBankType,
  MemoryInputType,
  VisionTags,
} from '@/types';
import type { CompanionPresetId } from '@/components/characters/types';

// ──────────────────── companions ────────────────────

export async function findCompanionForSingleUser(): Promise<Companion | null> {
  return await queryOne<Companion>(
    `select id, user_id, preset_id, custom_name, starting_personality,
            current_day, last_panel_visit_at, personality_weight,
            created_at, graduated_at
       from companions where user_id = :uid
       order by created_at desc limit 1`,
    { uid: SINGLE_USER_ID },
  );
}

export async function getCompanionById(id: string): Promise<Companion | null> {
  return await queryOne<Companion>(
    `select id, user_id, preset_id, custom_name, starting_personality,
            current_day, last_panel_visit_at, personality_weight,
            created_at, graduated_at
       from companions where id = :id`,
    { id },
  );
}

export async function createCompanion(args: {
  presetId: CompanionPresetId;
  startingPersonality: string;
}): Promise<Companion> {
  const id = uuid();
  await execute(
    `insert into companions (id, user_id, preset_id, starting_personality)
       values (:id, :uid, :preset_id, :sp)`,
    {
      id,
      uid: SINGLE_USER_ID,
      preset_id: args.presetId,
      sp: args.startingPersonality,
    },
  );
  const row = await getCompanionById(id);
  if (!row) throw new Error('createCompanion: row not found after insert');
  return row;
}

export async function setCompanionName(id: string, name: string | null) {
  await execute(`update companions set custom_name = :name where id = :id`, {
    id,
    name,
  });
}

export async function advanceCompanionDay(id: string, day: DayNumber) {
  await execute(
    `update companions set current_day = :day where id = :id`,
    { id, day },
  );
}

export async function markPanelVisited(id: string) {
  await execute(
    `update companions set last_panel_visit_at = current_timestamp(3) where id = :id`,
    { id },
  );
}

// ──────────────────── memories ────────────────────

export async function insertMemory(args: {
  companionId: string;
  day: DayNumber;
  type: MemoryInputType;
  taskId: string;
  taskQuestion?: string;
  photoUrl?: string;
  visionTags?: VisionTags;
  userText?: string;
}): Promise<Memory> {
  const id = uuid();
  await execute(
    `insert into memories
       (id, companion_id, day, type, photo_url, vision_tags, user_text, task_id, task_question)
     values
       (:id, :cid, :day, :type, :photo, cast(:tags as json), :text, :task_id, :tq)`,
    {
      id,
      cid: args.companionId,
      day: args.day,
      type: args.type,
      photo: args.photoUrl ?? null,
      tags: args.visionTags ? JSON.stringify(args.visionTags) : null,
      text: args.userText ?? null,
      task_id: args.taskId,
      tq: args.taskQuestion ?? null,
    },
  );
  const row = await queryOne<Memory>(
    `select id, companion_id, day, type, photo_url, vision_tags, user_text,
            task_id, task_question, created_at
       from memories where id = :id`,
    { id },
  );
  if (!row) throw new Error('insertMemory: row not found after insert');
  return row;
}

/**
 * 今日是否已经完成主任务（含跳过）。
 * 判定：当天 task_id 下至少有 1 条 memory（含 type=skipped）。
 */
export async function isTaskDoneToday(
  companionId: string,
  day: DayNumber,
  taskId: string,
): Promise<boolean> {
  const r = await queryOne<{ c: number }>(
    `select count(*) as c from memories
       where companion_id = :cid and day = :day and task_id = :tid`,
    { cid: companionId, day, tid: taskId },
  );
  return Number(r?.c ?? 0) > 0;
}

export async function listRecentMemories(
  companionId: string,
  limit = 5,
): Promise<Memory[]> {
  // mysql2 的 ? 占位符不允许 LIMIT 用绑定参数；用 number 拼接（已校验整数）
  const lim = Math.max(1, Math.min(100, Math.floor(limit)));
  return await query<Memory>(
    `select id, companion_id, day, type, photo_url, vision_tags, user_text,
            task_id, task_question, created_at
       from memories where companion_id = :cid
       order by created_at desc limit ${lim}`,
    { cid: companionId },
  );
}

// ──────────────────── memory_bank ────────────────────

export async function getMemoryBank(
  companionId: string,
): Promise<MemoryBankEntry[]> {
  return await query<MemoryBankEntry>(
    `select id, companion_id, type, concept_name, concept_category,
            ai_summary, ai_reasoning, evidence, confidence,
            user_corrected, user_correction_history, cached_detail, cache_dirty,
            display_order, last_updated, created_at
       from memory_bank where companion_id = :cid
       order by last_updated desc`,
    { cid: companionId },
  );
}

export async function findMemoryBankById(id: string): Promise<MemoryBankEntry | null> {
  return await queryOne<MemoryBankEntry>(
    `select id, companion_id, type, concept_name, concept_category,
            ai_summary, ai_reasoning, evidence, confidence,
            user_corrected, user_correction_history, cached_detail, cache_dirty,
            display_order, last_updated, created_at
       from memory_bank where id = :id`,
    { id },
  );
}

export interface CreateMemoryBankInput {
  companionId: string;
  type: MemoryBankType;
  conceptName: string;
  conceptCategory?: ConceptCategory;
  aiSummary?: string;
  aiReasoning?: string;
  evidence: Array<{ memory_id: string; day: number; excerpt: string }>;
  confidence?: number;
}

export async function createMemoryBankEntry(
  input: CreateMemoryBankInput,
): Promise<MemoryBankEntry> {
  const id = uuid();
  await execute(
    `insert into memory_bank
      (id, companion_id, type, concept_name, concept_category,
       ai_summary, ai_reasoning, evidence, confidence,
       user_correction_history)
     values
      (:id, :cid, :type, :cn, :cat,
       :sum, :rea, cast(:ev as json), :conf,
       cast('[]' as json))`,
    {
      id,
      cid: input.companionId,
      type: input.type,
      cn: input.conceptName,
      cat: input.conceptCategory ?? null,
      sum: input.aiSummary ?? null,
      rea: input.aiReasoning ?? null,
      ev: JSON.stringify(input.evidence),
      conf: input.confidence ?? 0.5,
    },
  );
  const row = await findMemoryBankById(id);
  if (!row) throw new Error('createMemoryBankEntry: row not found');
  return row;
}

export async function appendEvidenceToMemoryBank(
  id: string,
  evidence: { memory_id: string; day: number; excerpt: string },
): Promise<void> {
  await execute(
    `update memory_bank
       set evidence = json_array_append(evidence, '$', cast(:ev as json)),
           cache_dirty = true
       where id = :id`,
    { id, ev: JSON.stringify(evidence) },
  );
}

export async function appendCorrectionHistory(
  id: string,
  event: CorrectionEvent,
): Promise<void> {
  await execute(
    `update memory_bank
       set user_correction_history = json_array_append(user_correction_history, '$', cast(:e as json)),
           user_corrected = true,
           cache_dirty = true
       where id = :id`,
    { id, e: JSON.stringify(event) },
  );
}

export async function setMemoryBankType(
  id: string,
  type: MemoryBankType,
): Promise<void> {
  await execute(
    `update memory_bank set type = :type, cache_dirty = true where id = :id`,
    { id, type },
  );
}

export async function deleteMemoryBankEntry(id: string): Promise<void> {
  await execute(`delete from memory_bank where id = :id`, { id });
}

export async function countByType(
  companionId: string,
  type: MemoryBankType,
): Promise<number> {
  const r = await queryOne<{ c: number }>(
    `select count(*) as c from memory_bank where companion_id = :cid and type = :type`,
    { cid: companionId, type },
  );
  return Number(r?.c ?? 0);
}

export async function bulkInsertUnknown(
  companionId: string,
  items: string[],
): Promise<void> {
  // 跳过已经存在的同名 unknown，避免重复
  for (const name of items) {
    const trimmed = name.trim().slice(0, 60);
    if (!trimmed) continue;
    const exists = await queryOne(
      `select id from memory_bank
       where companion_id = :cid and concept_name = :name and type = 'unknown' limit 1`,
      { cid: companionId, name: trimmed },
    );
    if (exists) continue;
    await createMemoryBankEntry({
      companionId,
      type: 'unknown',
      conceptName: trimmed,
      conceptCategory: 'other',
      aiSummary: undefined,
      aiReasoning: undefined,
      evidence: [],
      confidence: 0.5,
    });
  }
}

// ──────────────────── conversations ────────────────────

export async function insertCompanionLine(args: {
  companionId: string;
  day: DayNumber;
  content: string;
  source: string;
  relatedMemoryId?: string;
  relatedMemoryBankId?: string;
}): Promise<ConversationLine> {
  const id = uuid();
  await execute(
    `insert into conversations
      (id, companion_id, day, role, content, source, related_memory_id, related_memory_bank_id)
     values
      (:id, :cid, :day, 'companion', :content, :source, :rm, :rmb)`,
    {
      id,
      cid: args.companionId,
      day: args.day,
      content: args.content,
      source: args.source,
      rm: args.relatedMemoryId ?? null,
      rmb: args.relatedMemoryBankId ?? null,
    },
  );
  const row = await queryOne<ConversationLine>(
    `select id, companion_id, day, role, content, source, created_at
       from conversations where id = :id`,
    { id },
  );
  if (!row) throw new Error('insertCompanionLine: row not found');
  return row;
}

export async function getRecentCompanionLine(
  companionId: string,
): Promise<ConversationLine | null> {
  return await queryOne<ConversationLine>(
    `select id, companion_id, day, role, content, source, created_at
       from conversations
       where companion_id = :cid and role = 'companion'
       order by created_at desc limit 1`,
    { cid: companionId },
  );
}

// ──────────────────── worldview_cards ────────────────────

export interface WorldviewRow {
  id: string;
  companion_id: string;
  most_important_person: string | null;
  most_fun_thing: string | null;
  most_delicious_thing: string | null;
  most_scary_thing: string | null;
  unknown_thing: string | null;
  almost_forgot_thing: string | null;
  stats: { photos: number; conversations: number; corrections: number } | null;
  generated_at: string;
}

export async function findWorldview(companionId: string): Promise<WorldviewRow | null> {
  return await queryOne<WorldviewRow>(
    `select id, companion_id, most_important_person, most_fun_thing, most_delicious_thing,
            most_scary_thing, unknown_thing, almost_forgot_thing, stats, generated_at
       from worldview_cards where companion_id = :cid`,
    { cid: companionId },
  );
}

export async function upsertWorldview(args: {
  companionId: string;
  data: {
    most_important_person: string;
    most_fun_thing: string;
    most_delicious_thing: string;
    most_scary_thing: string;
    unknown_thing: string;
    almost_forgot_thing: string | null;
  };
  stats: { photos: number; conversations: number; corrections: number };
  rawLLMOutput?: unknown;
}): Promise<WorldviewRow> {
  const id = uuid();
  await execute(
    `insert into worldview_cards
       (id, companion_id, most_important_person, most_fun_thing, most_delicious_thing,
        most_scary_thing, unknown_thing, almost_forgot_thing, stats, raw_llm_output)
     values
       (:id, :cid, :p1, :p2, :p3, :p4, :p5, :p6, cast(:s as json), cast(:r as json))
     on duplicate key update
       most_important_person = values(most_important_person),
       most_fun_thing = values(most_fun_thing),
       most_delicious_thing = values(most_delicious_thing),
       most_scary_thing = values(most_scary_thing),
       unknown_thing = values(unknown_thing),
       almost_forgot_thing = values(almost_forgot_thing),
       stats = values(stats),
       raw_llm_output = values(raw_llm_output),
       generated_at = current_timestamp(3)`,
    {
      id,
      cid: args.companionId,
      p1: args.data.most_important_person,
      p2: args.data.most_fun_thing,
      p3: args.data.most_delicious_thing,
      p4: args.data.most_scary_thing,
      p5: args.data.unknown_thing,
      p6: args.data.almost_forgot_thing,
      s: JSON.stringify(args.stats),
      r: JSON.stringify(args.rawLLMOutput ?? null),
    },
  );
  const row = await findWorldview(args.companionId);
  if (!row) throw new Error('upsertWorldview: not found after insert');
  return row;
}

/** 用 companion_stats 视图（schema 已建）取 4 个数字 */
export async function getCompanionStats(
  companionId: string,
): Promise<{ photos: number; conversations: number; corrections: number; current_day: number }> {
  const r = await queryOne<{
    photos: number;
    conversations_count: number;
    corrections: number;
    current_day: number;
  }>(
    `select photos, conversations_count, corrections, current_day
       from companion_stats where companion_id = :cid`,
    { cid: companionId },
  );
  return {
    photos: Number(r?.photos ?? 0),
    conversations: Number(r?.conversations_count ?? 0),
    corrections: Number(r?.corrections ?? 0),
    current_day: Number(r?.current_day ?? 1),
  };
}

// ──────────────────── llm_call_log ────────────────────

export async function logLLMCall(args: {
  companionId?: string;
  callType: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs: number;
  success: boolean;
  failReason?: string;
  promptVersion?: string;
}): Promise<void> {
  if (process.env.LLM_LOG_TO_DB !== 'true') return;
  await execute(
    `insert into llm_call_log
       (companion_id, call_type, model, input_tokens, output_tokens,
        latency_ms, success, fail_reason, prompt_version)
     values
       (:cid, :type, :model, :it, :ot, :lat, :ok, :fr, :pv)`,
    {
      cid: args.companionId ?? null,
      type: args.callType,
      model: args.model,
      it: args.inputTokens ?? null,
      ot: args.outputTokens ?? null,
      lat: args.latencyMs,
      ok: args.success,
      fr: args.failReason ?? null,
      pv: args.promptVersion ?? null,
    },
  );
}
