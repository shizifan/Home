/**
 * 业务层数据访问 — V1.0 PostgreSQL 方言
 * 把 SQL 屏蔽在这一层。上层 API route 只调这里的方法。
 */

import 'server-only';

import { execute, query, queryOne, SINGLE_USER_ID, uuid } from './client';
import type {
  Companion,
  ConceptCategory,
  ConversationLine,
  CorrectionEvent,
  DayNumber,
  EvidenceItem,
  Memory,
  MemoryBankEntry,
  MemoryBankType,
  MemoryInputType,
  MemorySourceType,
  VisionTags,
  WorldviewStats,
} from '@/types';
import type { CompanionPresetId } from '@/components/characters/types';

// ──────────────────── companions ────────────────────

export async function findCompanionForSingleUser(): Promise<Companion | null> {
  return await queryOne<Companion>(
    `select id, user_id, preset_id, custom_name, starting_personality,
            current_day, visit_count, school_count, plaza_count,
            created_at, graduated_at
       from companions where user_id = $1
       order by created_at desc limit 1`,
    [SINGLE_USER_ID],
  );
}

export async function getCompanionById(id: string): Promise<Companion | null> {
  return await queryOne<Companion>(
    `select id, user_id, preset_id, custom_name, starting_personality,
            current_day, visit_count, school_count, plaza_count,
            created_at, graduated_at
       from companions where id = $1`,
    [id],
  );
}

export async function createCompanion(args: {
  presetId: CompanionPresetId;
  startingPersonality: string;
}): Promise<Companion> {
  const id = uuid();
  await execute(
    `insert into companions (id, user_id, preset_id, starting_personality)
       values ($1, $2, $3, $4)`,
    [id, SINGLE_USER_ID, args.presetId, args.startingPersonality],
  );
  const row = await getCompanionById(id);
  if (!row) throw new Error('createCompanion: row not found after insert');
  return row;
}

export async function setCompanionName(id: string, name: string | null) {
  await execute(`update companions set custom_name = $1 where id = $2`, [name, id]);
}

export async function advanceCompanionDay(id: string, day: DayNumber) {
  await execute(`update companions set current_day = $1 where id = $2`, [day, id]);
}

export async function graduateCompanion(id: string) {
  await execute(
    `update companions set graduated_at = now() where id = $1`,
    [id],
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
  descriptionText?: string;
  userChoice?: unknown;
  inputMethod?: string;
  voiceAudioUrl?: string;
  asrTranscription?: string;
  editedText?: string;
}): Promise<Memory> {
  const id = uuid();
  await execute(
    `insert into memories
       (id, companion_id, day, type, photo_url, vision_tags, user_text,
        description_text, user_choice, task_id, task_question,
        input_method, voice_audio_url, asr_transcription, edited_text)
     values
       ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9::jsonb,$10,$11,$12,$13,$14,$15)`,
    [
      id, args.companionId, args.day, args.type,
      args.photoUrl ?? null,
      args.visionTags ? JSON.stringify(args.visionTags) : null,
      args.userText ?? null,
      args.descriptionText ?? null,
      args.userChoice ? JSON.stringify(args.userChoice) : null,
      args.taskId,
      args.taskQuestion ?? null,
      args.inputMethod ?? args.type,
      args.voiceAudioUrl ?? null,
      args.asrTranscription ?? null,
      args.editedText ?? null,
    ],
  );
  const row = await queryOne<Memory>(
    `select id, companion_id, day, type, photo_url, vision_tags, user_text,
            description_text, user_choice,
            task_id, task_question, created_at,
            input_method, voice_audio_url, asr_transcription, edited_text
       from memories where id = $1`,
    [id],
  );
  if (!row) throw new Error('insertMemory: row not found after insert');
  return row;
}

export async function isTaskDoneToday(
  companionId: string,
  day: DayNumber,
  taskId: string,
): Promise<boolean> {
  const r = await queryOne<{ c: number }>(
    `select count(*)::int as c from memories
       where companion_id = $1 and day = $2 and task_id = $3`,
    [companionId, day, taskId],
  );
  return Number(r?.c ?? 0) > 0;
}

export async function listRecentMemories(
  companionId: string,
  limit = 5,
): Promise<Memory[]> {
  const lim = Math.max(1, Math.min(100, Math.floor(limit)));
  return await query<Memory>(
    `select id, companion_id, day, type, photo_url, vision_tags, user_text,
            description_text, user_choice,
            task_id, task_question, created_at
       from memories where companion_id = $1
       order by created_at desc limit $2`,
    [companionId, lim],
  );
}

// ──────────────────── memory_bank ────────────────────

const MB_COLUMNS = `id, companion_id, type, concept_name, concept_category,
  ai_summary, ai_reasoning, evidence, confidence,
  source_type, source_companion_id,
  user_corrected, user_correction_history, last_updated, created_at`;

export async function getMemoryBank(companionId: string): Promise<MemoryBankEntry[]> {
  return await query<MemoryBankEntry>(
    `select ${MB_COLUMNS} from memory_bank where companion_id = $1
       order by last_updated desc`,
    [companionId],
  );
}

export async function findMemoryBankById(id: string): Promise<MemoryBankEntry | null> {
  return await queryOne<MemoryBankEntry>(
    `select ${MB_COLUMNS} from memory_bank where id = $1`,
    [id],
  );
}

export async function findMemoryBankByConcept(
  companionId: string,
  type: MemoryBankType,
  conceptName: string,
): Promise<MemoryBankEntry | null> {
  return await queryOne<MemoryBankEntry>(
    `select ${MB_COLUMNS} from memory_bank
       where companion_id = $1 and type = $2 and concept_name = $3
       limit 1`,
    [companionId, type, conceptName],
  );
}

export interface CreateMemoryBankInput {
  companionId: string;
  type: MemoryBankType;
  conceptName: string;
  conceptCategory?: ConceptCategory;
  aiSummary?: string;
  aiReasoning?: string;
  evidence: EvidenceItem[];
  confidence?: number;
  sourceType?: MemorySourceType;
  sourceCompanionId?: string;
}

export async function createMemoryBankEntry(input: CreateMemoryBankInput): Promise<MemoryBankEntry> {
  const id = uuid();
  await execute(
    `insert into memory_bank
      (id, companion_id, type, concept_name, concept_category,
       ai_summary, ai_reasoning, evidence, confidence,
       source_type, source_companion_id,
       user_correction_history)
     values
      ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12::jsonb)`,
    [
      id, input.companionId, input.type, input.conceptName,
      input.conceptCategory ?? null,
      input.aiSummary ?? null, input.aiReasoning ?? null,
      JSON.stringify(input.evidence),
      input.confidence ?? 0.5,
      input.sourceType ?? 'direct',
      input.sourceCompanionId ?? null,
      JSON.stringify([]),
    ],
  );
  const row = await findMemoryBankById(id);
  if (!row) throw new Error('createMemoryBankEntry: row not found');
  return row;
}

export async function upsertMemoryBankEntry(input: CreateMemoryBankInput): Promise<MemoryBankEntry> {
  try {
    return await createMemoryBankEntry(input);
  } catch (err) {
    if ((err as { code?: string })?.code !== '23505') throw err; // unique_violation
    const existing = await findMemoryBankByConcept(
      input.companionId, input.type, input.conceptName,
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
  evidence: EvidenceItem,
): Promise<void> {
  await execute(
    `update memory_bank
       set evidence = evidence || $1::jsonb
       where id = $2`,
    [JSON.stringify(evidence), id],
  );
}

export async function appendCorrectionHistory(
  id: string,
  event: CorrectionEvent,
): Promise<void> {
  await execute(
    `update memory_bank
       set user_correction_history = user_correction_history || $1::jsonb,
           user_corrected = true
       where id = $2`,
    [JSON.stringify(event), id],
  );
}

export async function setMemoryBankType(id: string, type: MemoryBankType): Promise<void> {
  await execute(`update memory_bank set type = $1 where id = $2`, [type, id]);
}

export async function deleteMemoryBankEntry(id: string): Promise<void> {
  await execute(`delete from memory_bank where id = $1`, [id]);
}

export async function countByType(companionId: string, type: MemoryBankType): Promise<number> {
  const r = await queryOne<{ c: number }>(
    `select count(*)::int as c from memory_bank where companion_id = $1 and type = $2`,
    [companionId, type],
  );
  return Number(r?.c ?? 0);
}

export async function bulkInsertUnknown(companionId: string, items: string[]): Promise<void> {
  for (const name of items) {
    const trimmed = name.trim().slice(0, 60);
    if (!trimmed) continue;
    await upsertMemoryBankEntry({
      companionId,
      type: 'unknown',
      conceptName: trimmed,
      conceptCategory: 'other',
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
     values ($1,$2,$3,'companion',$4,$5,$6,$7)`,
    [id, args.companionId, args.day, args.content, args.source,
     args.relatedMemoryId ?? null, args.relatedMemoryBankId ?? null],
  );
  const row = await queryOne<ConversationLine>(
    `select id, companion_id, day, role, content, source, created_at
       from conversations where id = $1`,
    [id],
  );
  if (!row) throw new Error('insertCompanionLine: row not found');
  return row;
}

export async function insertChildLine(args: {
  companionId: string;
  day: DayNumber;
  content: string;
  source: string;
}): Promise<ConversationLine> {
  const id = uuid();
  await execute(
    `insert into conversations (id, companion_id, day, role, content, source)
     values ($1,$2,$3,'child',$4,$5)`,
    [id, args.companionId, args.day, args.content, args.source],
  );
  const row = await queryOne<ConversationLine>(
    `select id, companion_id, day, role, content, source, created_at
       from conversations where id = $1`,
    [id],
  );
  if (!row) throw new Error('insertChildLine: row not found');
  return row;
}

export async function listRecentConversations(
  companionId: string,
  limit: number,
): Promise<ConversationLine[]> {
  const lim = Math.max(1, Math.min(100, Math.floor(limit)));
  const rows = await query<ConversationLine>(
    `select * from (
       select id, companion_id, day, role, content, source, created_at
         from conversations
         where companion_id = $1
         order by created_at desc
         limit $2
     ) t order by created_at asc`,
    [companionId, lim],
  );
  return rows;
}

export async function getRecentCompanionLine(companionId: string): Promise<ConversationLine | null> {
  return await queryOne<ConversationLine>(
    `select id, companion_id, day, role, content, source, created_at
       from conversations
       where companion_id = $1 and role = 'companion'
       order by created_at desc limit 1`,
    [companionId],
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
  stats: Record<string, number> | null;
  generated_at: string;
}

export async function findWorldview(companionId: string): Promise<WorldviewRow | null> {
  return await queryOne<WorldviewRow>(
    `select id, companion_id, most_important_person, most_fun_thing, most_delicious_thing,
            most_scary_thing, unknown_thing, almost_forgot_thing, stats, generated_at
       from worldview_cards where companion_id = $1`,
    [companionId],
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
  stats: { cards_count: number; conversations_count: number; corrections_count: number; days_count: number };
  rawLLMOutput?: unknown;
}): Promise<WorldviewRow> {
  const id = uuid();
  await execute(
    `insert into worldview_cards
       (id, companion_id, most_important_person, most_fun_thing, most_delicious_thing,
        most_scary_thing, unknown_thing, almost_forgot_thing, stats, raw_llm_output)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb)
     on conflict (companion_id) do update set
       most_important_person = excluded.most_important_person,
       most_fun_thing = excluded.most_fun_thing,
       most_delicious_thing = excluded.most_delicious_thing,
       most_scary_thing = excluded.most_scary_thing,
       unknown_thing = excluded.unknown_thing,
       almost_forgot_thing = excluded.almost_forgot_thing,
       stats = excluded.stats,
       raw_llm_output = excluded.raw_llm_output,
       generated_at = now()`,
    [
      id, args.companionId,
      args.data.most_important_person, args.data.most_fun_thing,
      args.data.most_delicious_thing, args.data.most_scary_thing,
      args.data.unknown_thing, args.data.almost_forgot_thing,
      JSON.stringify(args.stats),
      JSON.stringify(args.rawLLMOutput ?? null),
    ],
  );
  const row = await findWorldview(args.companionId);
  if (!row) throw new Error('upsertWorldview: not found after insert');
  return row;
}

export async function getCompanionStats(
  companionId: string,
): Promise<{ photos: number; conversations: number; corrections: number; current_day: number }> {
  const r = await queryOne<{
    photos: number; conversations_count: number; corrections: number; current_day: number;
  }>(
    `select photos::int, conversations_count::int, corrections::int, current_day::int
       from companion_stats where companion_id = $1`,
    [companionId],
  );
  return {
    photos: r?.photos ?? 0,
    conversations: r?.conversations_count ?? 0,
    corrections: r?.corrections ?? 0,
    current_day: r?.current_day ?? 1,
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
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      args.companionId ?? null, args.callType, args.model,
      args.inputTokens ?? null, args.outputTokens ?? null,
      args.latencyMs, args.success,
      args.failReason ?? null, args.promptVersion ?? null,
    ],
  );
}

// ============================================================
// V1.0 NEW: Station repos (trips, inventory, plaza_plays)
// ============================================================

import type { Trip, TripType, TripStatus, InventoryItem, PlazaPlay } from '@/types';

export async function createTrip(args: {
  companionId: string;
  tripType: TripType;
  destinationCompanionId?: string;
  purposeType?: string;
  purposeQuestion?: string;
}): Promise<Trip> {
  const id = uuid();
  await execute(
    `insert into trips (id, companion_id, trip_type, destination_companion_id, purpose_type, purpose_question)
     values ($1,$2,$3,$4,$5,$6)`,
    [id, args.companionId, args.tripType, args.destinationCompanionId ?? null,
     args.purposeType ?? null, args.purposeQuestion ?? null],
  );
  const row = await queryOne<Trip>(`select * from trips where id = $1`, [id]);
  if (!row) throw new Error('createTrip: row not found');
  return row;
}

export async function getTripById(id: string): Promise<Trip | null> {
  return await queryOne<Trip>(`select * from trips where id = $1`, [id]);
}

export async function completeTrip(id: string, reportNarrative: string, reportData?: Record<string, unknown>): Promise<void> {
  await execute(
    `update trips set status = 'returned', returned_at = now(),
       report_narrative = $1, report_data = $2::jsonb where id = $3`,
    [reportNarrative, JSON.stringify(reportData ?? {}), id],
  );
}

export async function countTodayTrips(companionId: string): Promise<number> {
  const r = await queryOne<{ c: number }>(
    `select count(*)::int as c from trips
       where companion_id = $1 and created_at::date = current_date`,
    [companionId],
  );
  return Number(r?.c ?? 0);
}

export async function addInventoryItem(args: {
  companionId: string;
  itemId: string;
  itemName: string;
  itemCategory: string;
  itemSubcategory?: string;
  itemDescription: string;
  itemDetailedDescription: string;
  acquiredFrom?: string;
  upgradedFrom?: string;
}): Promise<InventoryItem> {
  const id = uuid();
  await execute(
    `insert into inventory_items
       (id, companion_id, item_id, item_name, item_category, item_subcategory,
        item_description, item_detailed_description, acquired_from, is_upgraded_from)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [id, args.companionId, args.itemId, args.itemName, args.itemCategory,
     args.itemSubcategory ?? null, args.itemDescription, args.itemDetailedDescription,
     args.acquiredFrom ?? null, args.upgradedFrom ?? null],
  );
  const row = await queryOne<InventoryItem>(`select * from inventory_items where id = $1`, [id]);
  if (!row) throw new Error('addInventoryItem: row not found');
  return row;
}

export async function getInventory(companionId: string): Promise<InventoryItem[]> {
  return await query<InventoryItem>(
    `select * from inventory_items where companion_id = $1 order by item_category, acquired_at desc`,
    [companionId],
  );
}

export async function createPlazaPlay(args: {
  companionId: string;
  tripId?: string;
  scenarioId: string;
  scenarioTitle?: string;
}): Promise<PlazaPlay> {
  const id = uuid();
  await execute(
    `insert into plaza_plays (id, companion_id, trip_id, scenario_id, scenario_title)
     values ($1,$2,$3,$4,$5)`,
    [id, args.companionId, args.tripId ?? null, args.scenarioId, args.scenarioTitle ?? null],
  );
  const row = await queryOne<PlazaPlay>(`select * from plaza_plays where id = $1`, [id]);
  if (!row) throw new Error('createPlazaPlay: row not found');
  return row;
}

export async function updatePlazaPlay(
  id: string,
  updates: { actChoices?: unknown; endingType?: string; endingNarrative?: string; earnedItems?: unknown },
): Promise<void> {
  await execute(
    `update plaza_plays
       set act_choices = coalesce($1, act_choices),
           ending_type = coalesce($2, ending_type),
           ending_narrative = coalesce($3, ending_narrative),
           earned_items = coalesce($4::jsonb, earned_items),
           finished_at = case when $3 is not null then now() else finished_at end
       where id = $5`,
    [
      updates.actChoices ? JSON.stringify(updates.actChoices) : null,
      updates.endingType ?? null,
      updates.endingNarrative ?? null,
      updates.earnedItems ? JSON.stringify(updates.earnedItems) : null,
      id,
    ],
  );
}

export async function incrementStationCounter(
  companionId: string,
  column: 'visit_count' | 'school_count' | 'plaza_count',
): Promise<void> {
  await execute(
    `update companions set ${column} = ${column} + 1 where id = $1`,
    [companionId],
  );
}
