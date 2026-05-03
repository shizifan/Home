/**
 * cards 表 CRUD（V0.6.1 §4.1）
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
  style_check_passed: number | null;
  style_check_severity: string | null;
  style_check_issues: string[] | null;
  generation_attempt: number;
  is_active: number;
  is_fallback_text_card: number;
  child_action: string | null;
  confirmed_at: string | null;
  created_at: string;
}

const CARD_COLUMNS = `id, memory_id, companion_id, image_url, image_source,
  alt_image_url, alt_image_source, image_prompt,
  raw_keyword_extract, style_check_passed, style_check_severity,
  style_check_issues, generation_attempt, is_active, is_fallback_text_card,
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
    style_check_passed: row.style_check_passed == null ? null : Boolean(row.style_check_passed),
    style_check_severity: (row.style_check_severity ?? null) as CardSeverity | null,
    style_check_issues: Array.isArray(row.style_check_issues) ? row.style_check_issues : [],
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
    `update cards set is_active = 0 where memory_id = :mid and is_active = 1`,
    { mid: args.memoryId },
  );
  await execute(
    `insert into cards
       (id, memory_id, companion_id, image_url, image_source,
        alt_image_url, alt_image_source, image_prompt,
        raw_keyword_extract, style_check_passed, style_check_severity,
        style_check_issues, generation_attempt, is_active, is_fallback_text_card)
     values
       (:id, :mid, :cid, :url, :src, :alt_url, :alt_src, :prompt, cast(:kw as json),
        :passed, :sev, cast(:issues as json),
        :attempt, 1, :fallback)`,
    {
      id,
      mid: args.memoryId,
      cid: args.companionId,
      url: args.imageUrl,
      src: args.imageSource ?? null,
      alt_url: args.altImageUrl ?? null,
      alt_src: args.altImageSource ?? null,
      prompt: args.imagePrompt,
      kw: args.rawKeywordExtract ? JSON.stringify(args.rawKeywordExtract) : null,
      passed: args.styleCheckPassed == null ? null : args.styleCheckPassed ? 1 : 0,
      sev: args.styleCheckSeverity ?? null,
      issues: JSON.stringify(args.styleCheckIssues ?? []),
      attempt: args.generationAttempt,
      fallback: args.isFallbackTextCard ? 1 : 0,
    },
  );
  const row = await getCardById(id);
  if (!row) throw new Error('createCard: row not found after insert');
  return row;
}

export async function getCardById(id: string): Promise<Card | null> {
  const row = await queryOne<CardRow>(
    `select ${CARD_COLUMNS} from cards where id = :id`,
    { id },
  );
  return row ? rowToCard(row) : null;
}

export async function getActiveCardForMemory(memoryId: string): Promise<Card | null> {
  const row = await queryOne<CardRow>(
    `select ${CARD_COLUMNS}
       from cards where memory_id = :mid and is_active = 1
       order by created_at desc limit 1`,
    { mid: memoryId },
  );
  return row ? rowToCard(row) : null;
}

export async function listCardsForCompanion(
  companionId: string,
  limit = 50,
): Promise<Card[]> {
  // mysql2 的 ? 占位符不允许 LIMIT 用绑定参数；钳制后拼接
  const lim = Math.max(1, Math.min(200, Math.floor(limit)));
  const rows = await query<CardRow>(
    `select ${CARD_COLUMNS}
       from cards
       where companion_id = :cid
         and is_active = 1
         and child_action in ('confirmed', 'no_action_timeout')
       order by created_at desc
       limit ${lim}`,
    { cid: companionId },
  );
  return rows.map(rowToCard);
}

export async function setCardChildAction(
  cardId: string,
  action: CardChildAction,
): Promise<void> {
  await execute(
    `update cards
       set child_action = :a, confirmed_at = current_timestamp(3)
       where id = :id`,
    { id: cardId, a: action },
  );
}

export async function setCardInactive(cardId: string): Promise<void> {
  await execute(`update cards set is_active = 0 where id = :id`, { id: cardId });
}

/**
 * 测试期：用户在双图中选了 alt 那张时，把 image_url ↔ alt_image_url 互换。
 * 互换后 image_url / image_source 永远是孩子选中的那张。
 */
export async function swapCardPrimaryImage(cardId: string): Promise<void> {
  const row = await getCardById(cardId);
  if (!row) return;
  await execute(
    `update cards
       set image_url = :url,
           image_source = :src,
           alt_image_url = :alt_url,
           alt_image_source = :alt_src
     where id = :id`,
    {
      id: cardId,
      url: row.alt_image_url,
      src: row.alt_image_source,
      alt_url: row.image_url,
      alt_src: row.image_source,
    },
  );
}

/** 累加 memories.regenerate_count（用于限制 ≤ 3 次重做）*/
export async function incrementMemoryRegenerateCount(memoryId: string): Promise<number> {
  await execute(
    `update memories set regenerate_count = regenerate_count + 1 where id = :id`,
    { id: memoryId },
  );
  const row = await queryOne<{ regenerate_count: number }>(
    `select regenerate_count from memories where id = :id`,
    { id: memoryId },
  );
  return row?.regenerate_count ?? 0;
}
