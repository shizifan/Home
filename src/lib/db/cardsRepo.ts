/**
 * cards 表 CRUD（V1.0 PostgreSQL 方言）
 *
 * 一张 memory 可以有多张 cards（重做产生多版本），但同一 memory 同时只能有 1 张 is_active=true。
 */

import 'server-only';

import { execute, query, queryOne, uuid } from './client';
import type {
  Card,
  CardChildAction,
  CardSeverity,
  ImageSource,
  KeywordExtractOutput,
} from '@/types';

interface CardRow {
  id: string;
  memory_id: string;
  companion_id: string;
  image_url: string | null;
  image_source: string | null;
  alt_image_url: string | null;
  alt_image_source: string | null;
  image_prompt: string;
  raw_keyword_extract: KeywordExtractOutput | null;
  style_check_passed: boolean | null;
  style_check_severity: string | null;
  style_check_issues: string[] | null;
  content_audit_passed: boolean | null;
  content_audit_labels: string[] | null;
  generation_attempt: number;
  is_active: boolean;
  is_fallback_text_card: boolean;
  child_action: string | null;
  confirmed_at: string | null;
  created_at: string;
}

const CARD_COLUMNS = `id, memory_id, companion_id, image_url, image_source,
  alt_image_url, alt_image_source, image_prompt,
  raw_keyword_extract, style_check_passed, style_check_severity,
  style_check_issues, content_audit_passed, content_audit_labels,
  generation_attempt, is_active, is_fallback_text_card,
  child_action, confirmed_at, created_at`;

function rowToCard(row: CardRow): Card {
  return {
    id: row.id,
    memory_id: row.memory_id,
    companion_id: row.companion_id,
    image_url: row.image_url,
    image_source: (row.image_source ?? null) as ImageSource | null,
    alt_image_url: row.alt_image_url,
    alt_image_source: (row.alt_image_source ?? null) as ImageSource | null,
    image_prompt: row.image_prompt,
    raw_keyword_extract: row.raw_keyword_extract,
    style_check_passed: row.style_check_passed,
    style_check_severity: (row.style_check_severity ?? null) as CardSeverity | null,
    style_check_issues: Array.isArray(row.style_check_issues) ? row.style_check_issues : [],
    content_audit_passed: row.content_audit_passed ?? null,
    content_audit_labels: Array.isArray(row.content_audit_labels) ? row.content_audit_labels : [],
    generation_attempt: row.generation_attempt as 1 | 2 | 3 | 4,
    is_active: Boolean(row.is_active),
    is_fallback_text_card: Boolean(row.is_fallback_text_card),
    child_action: (row.child_action ?? null) as CardChildAction | null,
    confirmed_at: row.confirmed_at,
    created_at: row.created_at,
  };
}

export interface CreateCardArgs {
  memoryId: string;
  companionId: string;
  imageUrl: string | null;
  imageSource?: ImageSource | null;
  altImageUrl?: string | null;
  altImageSource?: ImageSource | null;
  imagePrompt: string;
  rawKeywordExtract?: KeywordExtractOutput | null;
  styleCheckPassed?: boolean | null;
  styleCheckSeverity?: CardSeverity | null;
  styleCheckIssues?: string[];
  contentAuditPassed?: boolean | null;
  contentAuditLabels?: string[];
  generationAttempt: 1 | 2 | 3 | 4;
  isFallbackTextCard?: boolean;
}

/**
 * 写入新卡片。把同一 memory 下旧的 active 卡片设为 inactive。
 */
export async function createCard(args: CreateCardArgs): Promise<Card> {
  const id = uuid();
  // 旧 active → inactive
  await execute(
    `update cards set is_active = false where memory_id = $1 and is_active = true`,
    [args.memoryId],
  );
  await execute(
    `insert into cards
       (id, memory_id, companion_id, image_url, image_source,
        alt_image_url, alt_image_source, image_prompt,
        raw_keyword_extract, style_check_passed, style_check_severity,
        style_check_issues, content_audit_passed, content_audit_labels,
        generation_attempt, is_active, is_fallback_text_card)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12::jsonb,$13,$14::jsonb,$15,true,$16)`,
    [
      id, args.memoryId, args.companionId,
      args.imageUrl, args.imageSource ?? null,
      args.altImageUrl ?? null, args.altImageSource ?? null,
      args.imagePrompt,
      args.rawKeywordExtract ? JSON.stringify(args.rawKeywordExtract) : null,
      args.styleCheckPassed ?? null,
      args.styleCheckSeverity ?? null,
      JSON.stringify(args.styleCheckIssues ?? []),
      args.contentAuditPassed ?? null,
      args.contentAuditLabels ? JSON.stringify(args.contentAuditLabels) : null,
      args.generationAttempt,
      args.isFallbackTextCard ?? false,
    ],
  );
  const row = await getCardById(id);
  if (!row) throw new Error('createCard: row not found after insert');
  return row;
}

export async function getCardById(id: string): Promise<Card | null> {
  const row = await queryOne<CardRow>(
    `select ${CARD_COLUMNS} from cards where id = $1`,
    [id],
  );
  return row ? rowToCard(row) : null;
}

export async function getActiveCardForMemory(memoryId: string): Promise<Card | null> {
  const row = await queryOne<CardRow>(
    `select ${CARD_COLUMNS}
       from cards where memory_id = $1 and is_active = true
       order by created_at desc limit 1`,
    [memoryId],
  );
  return row ? rowToCard(row) : null;
}

export async function listCardsForCompanion(
  companionId: string,
  limit = 50,
): Promise<Card[]> {
  const lim = Math.max(1, Math.min(200, Math.floor(limit)));
  const rows = await query<CardRow>(
    `select ${CARD_COLUMNS}
       from cards
       where companion_id = $1
         and is_active = true
         and child_action in ('confirmed', 'no_action_timeout')
       order by created_at desc
       limit $2`,
    [companionId, lim],
  );
  return rows.map(rowToCard);
}

export async function setCardChildAction(
  cardId: string,
  action: CardChildAction,
): Promise<void> {
  await execute(
    `update cards
       set child_action = $1, confirmed_at = now()
       where id = $2`,
    [action, cardId],
  );
}

export async function setCardInactive(cardId: string): Promise<void> {
  await execute(`update cards set is_active = false where id = $1`, [cardId]);
}

/** 获取同一 memory 的卡片数量（用于判断重做是否超限） */
export async function countCardAttempts(memoryId: string): Promise<number> {
  const r = await queryOne<{ c: number }>(
    `select count(*)::int as c from cards where memory_id = $1`,
    [memoryId],
  );
  return Number(r?.c ?? 0);
}
