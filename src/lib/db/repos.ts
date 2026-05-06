/**
 * 业务层数据访问 — 把 SQL 屏蔽在这一层。
 * 上层 API route 只调这里的方法。
 */

import 'server-only';

import { execute, query, queryOne, SINGLE_USER_ID, uuid } from './client';
import type {
  ActChoice,
  Companion,
  ConceptCategory,
  ConversationLine,
  CorrectionEvent,
  DayNumber,
  EndingType,
  InventoryItem,
  ItemCategory,
  Memory,
  MemoryBankEntry,
  MemoryBankType,
  MemoryInputType,
  PlazaPlay,
  Trip,
  TripStatus,
  TripType,
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

/**
 * Bump companions.last_active_at = now()，并返回旧值（用于"等你一天"判断）。
 * PRD §16.3 末段：last_active_at < 今天 0:00 → missed_yesterday = true
 *
 * 容错：如果迁移 0004 没跑（column 不存在），返回 null 并静默忽略，
 * 让 state API 仍可正常返回。日志一条警告便于排查。
 */
export async function bumpAndGetLastActive(
  id: string,
): Promise<Date | null> {
  try {
    const before = await queryOne<{ last_active_at: Date | null }>(
      `select last_active_at from companions where id = :id`,
      { id },
    );
    await execute(
      `update companions set last_active_at = current_timestamp(3) where id = :id`,
      { id },
    );
    return before?.last_active_at ?? null;
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === 'ER_BAD_FIELD_ERROR') {
      console.warn(
        '[bumpAndGetLastActive] companions.last_active_at 不存在 — 请运行迁移 0004_trips_and_last_active.sql。本次 missed_day_greeting 静默降级。',
      );
      return null;
    }
    throw err;
  }
}

/** 首次生成 worldview 时写入毕业时间，作为 graduated 的权威信号 */
export async function setGraduatedAtIfNull(id: string): Promise<void> {
  await execute(
    `update companions set graduated_at = current_timestamp(3)
       where id = :id and graduated_at is null`,
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
  /** V0.6.1：用户实际输入方式（与 type 区分）*/
  inputMethod?: string;
  /** V0.6.1：语音文件 URL（如有）*/
  voiceAudioUrl?: string;
  /** V0.6.1：ASR 原始结果 */
  asrTranscription?: string;
  /** V0.6.1：孩子在中转页编辑后的最终文字 */
  editedText?: string;
}): Promise<Memory> {
  const id = uuid();
  await execute(
    `insert into memories
       (id, companion_id, day, type, photo_url, vision_tags, user_text, task_id, task_question,
        input_method, voice_audio_url, asr_transcription, edited_text)
     values
       (:id, :cid, :day, :type, :photo, cast(:tags as json), :text, :task_id, :tq,
        :im, :va, :asr, :et)`,
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
      im: args.inputMethod ?? args.type,
      va: args.voiceAudioUrl ?? null,
      asr: args.asrTranscription ?? null,
      et: args.editedText ?? null,
    },
  );
  const row = await queryOne<Memory>(
    `select id, companion_id, day, type, photo_url, vision_tags, user_text,
            task_id, task_question, created_at,
            input_method, voice_audio_url, asr_transcription, edited_text, regenerate_count
       from memories where id = :id`,
    { id },
  );
  if (!row) throw new Error('insertMemory: row not found after insert');
  return row;
}

/**
 * 标记当天 task 为完成（用于 Day 6 纠正动作 / Day 7 看完档案）。
 * 写一条 type='choice' 的 memory 占位，user_text 用约定标记区分来源。
 * 幂等：重复调用同一 task_id 同一天会再插一行，但 isTaskDoneToday 仍 true，无害。
 */
export async function markTaskCompleted(args: {
  companionId: string;
  day: DayNumber;
  taskId: string;
  marker: string;
}): Promise<void> {
  await insertMemory({
    companionId: args.companionId,
    day: args.day,
    type: 'choice',
    taskId: args.taskId,
    userText: args.marker,
    inputMethod: 'choice',
  });
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

/** PRD §9.4 Day 7 跳过差异化用：统计该 companion 这一周跳过的任务次数（type='skipped'）*/
export async function countSkippedTasks(companionId: string): Promise<number> {
  const r = await queryOne<{ n: number }>(
    `select count(*) as n from memories
       where companion_id = :cid and type = 'skipped'`,
    { cid: companionId },
  );
  return Number(r?.n ?? 0);
}

/** 拉某一天 companion 的全部输入记录（按时间倒序） */
export async function listMemoriesByDay(
  companionId: string,
  day: DayNumber,
): Promise<Memory[]> {
  return await query<Memory>(
    `select id, companion_id, day, type, photo_url, vision_tags, user_text,
            task_id, task_question, created_at,
            input_method, voice_audio_url, asr_transcription, edited_text, regenerate_count
       from memories
       where companion_id = :cid and day = :day
       order by created_at desc`,
    { cid: companionId, day },
  );
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
            source_type, source_companion_id,
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
            source_type, source_companion_id,
            user_corrected, user_correction_history, cached_detail, cache_dirty,
            display_order, last_updated, created_at
       from memory_bank where id = :id`,
    { id },
  );
}

/** 按 (companion_id, type, concept_name) 精确查回 —— ER_DUP_ENTRY 后用 */
export async function findMemoryBankByConcept(
  companionId: string,
  type: MemoryBankType,
  conceptName: string,
): Promise<MemoryBankEntry | null> {
  return await queryOne<MemoryBankEntry>(
    `select id, companion_id, type, concept_name, concept_category,
            ai_summary, ai_reasoning, evidence, confidence,
            source_type, source_companion_id,
            user_corrected, user_correction_history, cached_detail, cache_dirty,
            display_order, last_updated, created_at
       from memory_bank
       where companion_id = :cid and type = :type and concept_name = :cn
       limit 1`,
    { cid: companionId, type, cn: conceptName },
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
  /** P2：来源标识（PRD §12.7 / §22.1.5）*/
  sourceType?: 'firsthand' | 'secondhand';
  /** secondhand 时记录来源伙伴 id（系统预设伙伴写 preset_id 字符串）*/
  sourceCompanionId?: string;
}

export async function createMemoryBankEntry(
  input: CreateMemoryBankInput,
): Promise<MemoryBankEntry> {
  const id = uuid();
  await execute(
    `insert into memory_bank
      (id, companion_id, type, concept_name, concept_category,
       ai_summary, ai_reasoning, evidence, confidence,
       source_type, source_companion_id,
       user_correction_history)
     values
      (:id, :cid, :type, :cn, :cat,
       :sum, :rea, cast(:ev as json), :conf,
       :stype, :sid,
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
      stype: input.sourceType ?? 'firsthand',
      sid: input.sourceCompanionId ?? null,
    },
  );
  const row = await findMemoryBankById(id);
  if (!row) throw new Error('createMemoryBankEntry: row not found');
  return row;
}

/**
 * Upsert：试图新建 memory_bank entry；若 (companion_id, type, concept_name)
 * 已有同行（ER_DUP_ENTRY），改为给已有行 append evidence 并返回它。
 *
 * 防御项：
 *   - LLM 输出 concept_name 与 DB 之间存在不可见 unicode 差异
 *   - 多请求并发命中同一 fixed concept（安全过滤兜底、Pass1 兜底等）
 */
export async function upsertMemoryBankEntry(
  input: CreateMemoryBankInput,
): Promise<MemoryBankEntry> {
  try {
    return await createMemoryBankEntry(input);
  } catch (err) {
    if ((err as { code?: string })?.code !== 'ER_DUP_ENTRY') throw err;
    const existing = await findMemoryBankByConcept(
      input.companionId,
      input.type,
      input.conceptName,
    );
    if (!existing) throw err;
    for (const ev of input.evidence) {
      await appendEvidenceToMemoryBank(existing.id, ev);
    }
    return existing;
  }
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
  // upsertMemoryBankEntry：已存在的同名 unknown 直接走 append（evidence 空，无副作用）
  for (const name of items) {
    const trimmed = name.trim().slice(0, 60);
    if (!trimmed) continue;
    await upsertMemoryBankEntry({
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

/**
 * 写一条 role='child' 的对话行。Free Chat 流程用：孩子主动问问题时落库。
 */
export async function insertChildLine(args: {
  companionId: string;
  day: DayNumber;
  content: string;
  source: string;
}): Promise<ConversationLine> {
  const id = uuid();
  await execute(
    `insert into conversations
      (id, companion_id, day, role, content, source)
     values
      (:id, :cid, :day, 'child', :content, :source)`,
    {
      id,
      cid: args.companionId,
      day: args.day,
      content: args.content,
      source: args.source,
    },
  );
  const row = await queryOne<ConversationLine>(
    `select id, companion_id, day, role, content, source, created_at
       from conversations where id = :id`,
    { id },
  );
  if (!row) throw new Error('insertChildLine: row not found');
  return row;
}

/**
 * 取最近 N 条对话（含 child / companion / system），时间正序（最旧 → 最新）。
 * 用于 Free Chat 给 LLM 注入上下文。
 */
export async function listRecentConversations(
  companionId: string,
  limit: number,
): Promise<ConversationLine[]> {
  const lim = Math.max(1, Math.min(100, Math.floor(limit)));
  // mysql2 ? 不允许在 LIMIT 用绑定参数；这里钳制后字面拼接
  const rows = await query<ConversationLine>(
    `select * from (
       select id, companion_id, day, role, content, source, created_at
         from conversations
         where companion_id = :cid
         order by created_at desc
         limit ${lim}
     ) t order by created_at asc`,
    { cid: companionId },
  );
  return rows;
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

// ──────────────────── trips（P2 §22.1.8）────────────────────

const TRIP_FIELDS = `
  id, companion_id, trip_type, destination_companion_id,
  purpose_type, purpose_question, plaza_play_id,
  status, departed_at, returned_at,
  report_narrative, report_data, created_at
`;

export interface CreateTripInput {
  companionId: string;
  tripType: TripType;
  destinationCompanionId?: string;
  purposeType?: string;
  purposeQuestion?: string;
  plazaPlayId?: string;
}

export async function createTrip(input: CreateTripInput): Promise<Trip> {
  const id = uuid();
  await execute(
    `insert into trips
       (id, companion_id, trip_type, destination_companion_id,
        purpose_type, purpose_question, plaza_play_id,
        status, departed_at)
     values
       (:id, :cid, :type, :dest,
        :ptype, :pq, :pp,
        'traveling', current_timestamp(3))`,
    {
      id,
      cid: input.companionId,
      type: input.tripType,
      dest: input.destinationCompanionId ?? null,
      ptype: input.purposeType ?? null,
      pq: input.purposeQuestion ?? null,
      pp: input.plazaPlayId ?? null,
    },
  );
  const row = await getTripById(id);
  if (!row) throw new Error('createTrip: row not found after insert');
  return row;
}

export async function getTripById(id: string): Promise<Trip | null> {
  return await queryOne<Trip>(
    `select ${TRIP_FIELDS} from trips where id = :id`,
    { id },
  );
}

export async function getTripsForCompanion(
  companionId: string,
  limit = 50,
): Promise<Trip[]> {
  return await query<Trip>(
    `select ${TRIP_FIELDS} from trips
       where companion_id = :cid
       order by created_at desc limit :lim`,
    { cid: companionId, lim: limit },
  );
}

export async function markTripReturned(args: {
  tripId: string;
  reportNarrative: string;
  reportData: Record<string, unknown>;
}): Promise<void> {
  await execute(
    `update trips
       set status = 'returned',
           returned_at = current_timestamp(3),
           report_narrative = :n,
           report_data = cast(:d as json)
       where id = :id`,
    {
      id: args.tripId,
      n: args.reportNarrative,
      d: JSON.stringify(args.reportData),
    },
  );
}

export async function markTripStatus(
  id: string,
  status: TripStatus,
): Promise<void> {
  await execute(`update trips set status = :s where id = :id`, {
    id,
    s: status,
  });
}

/** 今日是否已经出过门（任意 trip_type）— PRD §11.5 限流 */
export async function hasTripToday(companionId: string): Promise<boolean> {
  const r = await queryOne<{ n: number }>(
    `select count(*) as n from trips
       where companion_id = :cid
         and date(created_at) = curdate()`,
    { cid: companionId },
  );
  return (r?.n ?? 0) > 0;
}

// ──────────────────── inventory_items（P4 §22.1.9）────────────────────

const INVENTORY_FIELDS = `
  id, companion_id, item_id, item_name, item_category, item_subcategory,
  item_description, item_detailed_description,
  acquired_at, acquired_from, use_count, last_used_at,
  is_upgraded_from, created_at
`;

export interface GrantItemInput {
  companionId: string;
  itemId: string;
  itemName: string;
  itemCategory: ItemCategory;
  itemSubcategory?: string;
  itemDescription?: string;
  itemDetailedDescription?: string;
  acquiredFrom?: string;
  isUpgradedFrom?: string;
}

/**
 * 给伙伴授予一件道具。
 * 幂等：同 (companion_id, item_id) 已有 → 不插，返回已有行（PRD §14.3.2 道具不消耗，不重复获得）。
 */
export async function grantInventoryItem(
  input: GrantItemInput,
): Promise<{ row: InventoryItem; created: boolean }> {
  const existing = await queryOne<InventoryItem>(
    `select ${INVENTORY_FIELDS} from inventory_items
       where companion_id = :cid and item_id = :iid`,
    { cid: input.companionId, iid: input.itemId },
  );
  if (existing) {
    return { row: existing, created: false };
  }
  const id = uuid();
  await execute(
    `insert into inventory_items
       (id, companion_id, item_id, item_name, item_category, item_subcategory,
        item_description, item_detailed_description, acquired_from, is_upgraded_from)
     values
       (:id, :cid, :iid, :name, :cat, :sub,
        :desc, :ddesc, :from, :up)`,
    {
      id,
      cid: input.companionId,
      iid: input.itemId,
      name: input.itemName,
      cat: input.itemCategory,
      sub: input.itemSubcategory ?? null,
      desc: input.itemDescription ?? null,
      ddesc: input.itemDetailedDescription ?? null,
      from: input.acquiredFrom ?? null,
      up: input.isUpgradedFrom ?? null,
    },
  );
  const row = await queryOne<InventoryItem>(
    `select ${INVENTORY_FIELDS} from inventory_items where id = :id`,
    { id },
  );
  if (!row) throw new Error('grantInventoryItem: row missing after insert');
  return { row, created: true };
}

export async function listInventory(companionId: string): Promise<InventoryItem[]> {
  return await query<InventoryItem>(
    `select ${INVENTORY_FIELDS} from inventory_items
       where companion_id = :cid
       order by item_category asc, acquired_at desc`,
    { cid: companionId },
  );
}

export async function findInventoryById(id: string): Promise<InventoryItem | null> {
  return await queryOne<InventoryItem>(
    `select ${INVENTORY_FIELDS} from inventory_items where id = :id`,
    { id },
  );
}

export async function findInventoryByItemId(
  companionId: string,
  itemId: string,
): Promise<InventoryItem | null> {
  return await queryOne<InventoryItem>(
    `select ${INVENTORY_FIELDS} from inventory_items
       where companion_id = :cid and item_id = :iid`,
    { cid: companionId, iid: itemId },
  );
}

export async function bumpItemUseCount(rowId: string): Promise<void> {
  await execute(
    `update inventory_items
       set use_count = use_count + 1, last_used_at = current_timestamp(3)
       where id = :id`,
    { id: rowId },
  );
}

// ──────────────────── plaza_plays（P4 §22.1.10）────────────────────

const PLAZA_PLAY_FIELDS = `
  id, companion_id, trip_id, scenario_id, scenario_title,
  act_choices, ending_type, ending_narrative, earned_items,
  played_at, finished_at
`;

export async function createPlazaPlay(args: {
  companionId: string;
  tripId?: string;
  scenarioId: string;
  scenarioTitle?: string;
}): Promise<PlazaPlay> {
  const id = uuid();
  await execute(
    `insert into plaza_plays
       (id, companion_id, trip_id, scenario_id, scenario_title)
     values
       (:id, :cid, :tid, :sid, :title)`,
    {
      id,
      cid: args.companionId,
      tid: args.tripId ?? null,
      sid: args.scenarioId,
      title: args.scenarioTitle ?? null,
    },
  );
  const row = await queryOne<PlazaPlay>(
    `select ${PLAZA_PLAY_FIELDS} from plaza_plays where id = :id`,
    { id },
  );
  if (!row) throw new Error('createPlazaPlay: row missing');
  return row;
}

export async function appendPlazaPlayChoice(args: {
  playId: string;
  choice: ActChoice;
}): Promise<void> {
  await execute(
    `update plaza_plays
       set act_choices = json_array_append(coalesce(act_choices, cast('[]' as json)), '$', cast(:c as json))
       where id = :id`,
    { id: args.playId, c: JSON.stringify(args.choice) },
  );
}

export async function finishPlazaPlay(args: {
  playId: string;
  endingType: EndingType;
  endingNarrative: string;
  earnedItems: string[];
}): Promise<void> {
  await execute(
    `update plaza_plays
       set ending_type = :type,
           ending_narrative = :narr,
           earned_items = cast(:items as json),
           finished_at = current_timestamp(3)
       where id = :id`,
    {
      id: args.playId,
      type: args.endingType,
      narr: args.endingNarrative,
      items: JSON.stringify(args.earnedItems),
    },
  );
}

export async function getPlazaPlayById(id: string): Promise<PlazaPlay | null> {
  return await queryOne<PlazaPlay>(
    `select ${PLAZA_PLAY_FIELDS} from plaza_plays where id = :id`,
    { id },
  );
}

/** 同 companion 玩过广场（任意剧本）总次数 — 用于"玩过 1 次广场"的 BottomNav 行囊入口判断 */
export async function countPlazaPlaysAll(companionId: string): Promise<number> {
  const r = await queryOne<{ n: number }>(
    `select count(*) as n from plaza_plays where companion_id = :cid`,
    { cid: companionId },
  );
  return r?.n ?? 0;
}

/** 同 companion 玩过该剧本的次数（用于第 N 次台词差异 PRD §14.5.3）*/
export async function countPlazaPlaysByScenario(
  companionId: string,
  scenarioId: string,
): Promise<number> {
  const r = await queryOne<{ n: number }>(
    `select count(*) as n from plaza_plays
       where companion_id = :cid and scenario_id = :sid`,
    { cid: companionId, sid: scenarioId },
  );
  return r?.n ?? 0;
}

/** 最近玩过的剧本 id 列表（用于挑选时去重避免连续）*/
export async function listRecentPlazaScenarios(
  companionId: string,
  limit = 2,
): Promise<string[]> {
  const lim = Math.max(1, Math.min(10, Math.floor(limit)));
  const rows = await query<{ scenario_id: string }>(
    `select scenario_id from plaza_plays
       where companion_id = :cid
       order by played_at desc limit ${lim}`,
    { cid: companionId },
  );
  return rows.map((r) => r.scenario_id);
}
