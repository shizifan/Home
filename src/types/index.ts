/**
 * 全局共享类型
 * 与 supabase/migrations/0001_init.sql 的列同名同语义。
 * 真接 Supabase 后用 `npm run db:types` 生成 src/types/database.ts，
 * 此文件只放业务层视图与 store 类型。
 */

import type { CompanionPresetId } from '@/components/characters/types';

export type DayNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface User {
  id: string;
  parent_phone?: string;
  child_nickname?: string;
  child_age?: number;
  consent_at?: string;
}

export interface Companion {
  id: string;
  user_id: string;
  preset_id: CompanionPresetId;
  custom_name?: string;
  starting_personality: string;
  current_day: DayNumber;
  last_panel_visit_at?: string;
  personality_weight: number;
  created_at: string;
  graduated_at?: string;
}

export type MemoryInputType = 'photo' | 'text' | 'choice' | 'skipped';

export interface Memory {
  id: string;
  companion_id: string;
  day: DayNumber;
  type: MemoryInputType;
  photo_url?: string;
  vision_tags?: VisionTags;
  user_text?: string;
  task_id: string;
  task_question?: string;
  created_at: string;
}

export interface VisionTags {
  objects: string[];
  scene?: string;
  atmosphere?: string;
  time_of_day?: string;
}

export type MemoryBankType = 'remembered' | 'uncertain' | 'set_aside' | 'unknown';
export type ConceptCategory = 'person' | 'place' | 'food' | 'activity' | 'object' | 'emotion' | 'other';

export interface MemoryBankEntry {
  id: string;
  companion_id: string;
  type: MemoryBankType;
  concept_name: string;
  concept_category?: ConceptCategory;
  ai_summary?: string;
  ai_reasoning?: string;
  evidence: Array<{ memory_id: string; day: number; excerpt: string }>;
  confidence: number;
  user_corrected: boolean;
  user_correction_history: CorrectionEvent[];
  cached_detail?: {
    understanding: string;
    reasoning: string;
    evidence_rephrased: Array<{ day: number; text: string }>;
  } | null;
  cache_dirty?: boolean;
  display_order?: number;
  last_updated: string;
  created_at: string;
}

export type CorrectionAction = 'restore' | 'dismiss' | 'clarify' | 'rename' | 'merge' | 'inform' | 'withhold';

export interface CorrectionEvent {
  action: CorrectionAction;
  at: string;
  payload?: Record<string, unknown>;
}

export interface ConversationLine {
  id: string;
  companion_id: string;
  day: number;
  role: 'companion' | 'child' | 'system';
  content: string;
  source?: string;
  created_at: string;
}

export interface WorldviewCard {
  id: string;
  companion_id: string;
  most_important_person: string;
  most_fun_thing: string;
  most_delicious_thing: string;
  most_scary_thing: string;
  unknown_thing: string;
  almost_forgot_thing?: string;
  stats?: { photos: number; conversations: number; corrections: number };
  generated_at: string;
}

/** 任务定义（PRD §3 + §11.3） */
export type TaskKind = 'photo' | 'text' | 'photo_text' | 'choice' | 'memory_review';

export interface TaskDef {
  id: string;
  day: DayNumber;
  kind: TaskKind;
  title: string;
  description: string;
  inputPlaceholder?: string;
  charLimit?: number;
}
