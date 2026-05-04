/**
 * 全局共享类型 — V1.0
 * 与 db/migrations/0004_v1_init_pg.sql 列同名同语义。
 */

import type { CompanionPresetId } from '@/components/characters/types';

export type DayNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7;

// ============================================================
// User
// ============================================================
export interface User {
  id: string;
  parent_phone?: string;
  child_nickname?: string;
  child_age?: number;
  consent_at?: string;
}

// ============================================================
// Companion（V1.0：+visit_count/+school_count/+plaza_count，-last_panel_visit_at/-personality_weight）
// ============================================================
export interface Companion {
  id: string;
  user_id: string;
  preset_id: CompanionPresetId;
  custom_name?: string;
  starting_personality: string;
  current_day: DayNumber;
  visit_count: number;
  school_count: number;
  plaza_count: number;
  created_at: string;
  graduated_at?: string;
}

// ============================================================
// Memory
// ============================================================
export type MemoryInputType = 'photo' | 'text' | 'choice' | 'skipped' | 'voice' | 'describe';
export type InputMethod = 'photo' | 'voice' | 'text' | 'choice' | 'skipped' | 'describe';

export interface Memory {
  id: string;
  companion_id: string;
  day: DayNumber;
  type: MemoryInputType;
  input_method?: InputMethod;
  photo_url?: string;
  vision_tags?: VisionTags;
  user_text?: string;
  description_text?: string;
  user_choice?: unknown;
  voice_audio_url?: string;
  asr_transcription?: string;
  edited_text?: string;
  task_id: string;
  task_question?: string;
  created_at: string;
}

// ============================================================
// Card
// ============================================================
export type CardSeverity = 'ok' | 'minor' | 'major';
export type CardChildAction = 'confirmed' | 'rejected' | 'no_action_timeout';
export type ImageSource = 'dashscope' | 'minimax';

export interface Card {
  id: string;
  memory_id: string;
  companion_id: string;
  image_url: string | null;
  image_source: ImageSource | null;
  alt_image_url: string | null;
  alt_image_source: ImageSource | null;
  image_prompt: string;
  raw_keyword_extract?: KeywordExtractOutput | null;
  style_check_passed: boolean | null;
  style_check_severity: CardSeverity | null;
  style_check_issues: string[];
  content_audit_passed?: boolean | null;
  content_audit_labels?: string[];
  generation_attempt: 1 | 2 | 3 | 4;
  is_active: boolean;
  is_fallback_text_card: boolean;
  child_action: CardChildAction | null;
  confirmed_at: string | null;
  created_at: string;
}

export interface KeywordExtractOutput {
  scene_type: 'indoor_room' | 'outdoor_place' | 'people_with_env' | 'object_focus';
  main_subjects: string[];
  visual_attributes: string[];
  atmosphere: string;
  prompt_content: string;
  excluded_details: string[];
}

export interface StyleAuditOutput {
  style_match: boolean;
  issues: string[];
  severity: CardSeverity;
}

// ============================================================
// VisionTags（保留给历史数据）
// ============================================================
export interface VisionTags {
  objects: string[];
  scene?: string;
  atmosphere?: string;
  time_of_day?: string;
}

// ============================================================
// MemoryBank（V1.0：+source_type/+source_companion_id，-cached_detail/-cache_dirty/-display_order）
// ============================================================
export type MemoryBankType = 'remembered' | 'uncertain' | 'set_aside' | 'unknown';
export type ConceptCategory = 'person' | 'place' | 'food' | 'activity' | 'object' | 'emotion' | 'other';
export type MemorySourceType = 'direct' | 'secondhand';

export interface MemoryBankEntry {
  id: string;
  companion_id: string;
  type: MemoryBankType;
  concept_name: string;
  concept_category?: ConceptCategory;
  ai_summary?: string;
  ai_reasoning?: string;
  evidence: EvidenceItem[];
  confidence: number;
  source_type: MemorySourceType;
  source_companion_id?: string;
  user_corrected: boolean;
  user_correction_history: CorrectionEvent[];
  last_updated: string;
  created_at: string;
}

export interface EvidenceItem {
  quote: string;
  day: number;
  source: string;
  at: string;
}

export type CorrectionAction = 'restore' | 'dismiss' | 'clarify' | 'rename' | 'merge' | 'inform' | 'withhold';

export interface CorrectionEvent {
  action: CorrectionAction;
  at: string;
  payload?: Record<string, unknown>;
}

// ============================================================
// Conversation
// ============================================================
export interface ConversationLine {
  id: string;
  companion_id: string;
  day: number;
  role: 'companion' | 'child' | 'system';
  content: string;
  source?: string;
  created_at: string;
}

// ============================================================
// Worldview + Stats
// ============================================================
export interface WorldviewCard {
  id: string;
  companion_id: string;
  most_important_person: string;
  most_fun_thing: string;
  most_delicious_thing: string;
  most_scary_thing: string;
  unknown_thing: string;
  almost_forgot_thing?: string;
  stats?: WorldviewStats;
  generated_at: string;
}

export interface WorldviewStats {
  cards_count: number;
  conversations_count: number;
  corrections_count: number;
  days_count: number;
}

// ============================================================
// Task
// ============================================================
export type TaskKind = 'describe' | 'text' | 'choice' | 'memory_review';

export interface TaskDef {
  id: string;
  day: DayNumber;
  kind: TaskKind;
  title: string;
  description: string;
  inputPlaceholder?: string;
  charLimit?: number;
}

// ============================================================
// V1.0 NEW: Station types
// ============================================================
export type TripType = 'visit' | 'school' | 'plaza';
export type TripStatus = 'traveling' | 'returned';
export type VisitPurpose = 'meet_friend' | 'observe_home' | 'introduce_self' | 'ask_question';
export type SchoolPurpose = 'attend_class' | 'ask_my_question' | 'observe_others' | 'learn_new';

export interface Trip {
  id: string;
  companion_id: string;
  trip_type: TripType;
  destination_companion_id?: string;
  purpose_type?: VisitPurpose | SchoolPurpose;
  purpose_question?: string;
  plaza_play_id?: string;
  status: TripStatus;
  departed_at: string;
  returned_at?: string;
  report_narrative?: string;
  report_data?: Record<string, unknown>;
}

export type ItemCategory = 'knowledge' | 'object' | 'gift' | 'ability';

export interface InventoryItem {
  id: string;
  companion_id: string;
  item_id: string;
  item_name: string;
  item_category: ItemCategory;
  item_subcategory?: string;
  item_description: string;
  item_detailed_description: string;
  acquired_at: string;
  acquired_from?: string;
  use_count: number;
  last_used_at?: string;
  is_upgraded_from?: string;
}

export type PlazaEndingType = 'perfect' | 'good' | 'barely';

export interface PlazaPlay {
  id: string;
  companion_id: string;
  trip_id?: string;
  scenario_id: string;
  scenario_title?: string;
  act_choices: ActChoice[];
  ending_type?: PlazaEndingType;
  ending_narrative?: string;
  earned_items?: EarnedItem[];
  played_at: string;
  finished_at?: string;
}

export interface ActChoice {
  act: number;
  selected_item_id: string | null;
  item_name?: string;
  narrative: string;
  item_use_quality?: 'clever' | 'reasonable' | 'barely_relevant';
}

export interface EarnedItem {
  item_id: string;
  item_name: string;
  category: ItemCategory;
}

export interface StationUnlockStatus {
  friendHouseUnlocked: boolean;
  schoolUnlocked: boolean;
  plazaUnlocked: boolean;
  dailyDeparturesRemaining: number;
}

// ============================================================
// Content Audit
// ============================================================
export interface ContentAuditResult {
  passed: boolean;
  labels: string[];
}
