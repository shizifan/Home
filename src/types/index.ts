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

export type MemoryInputType = 'photo' | 'text' | 'choice' | 'skipped' | 'voice' | 'describe';
export type InputMethod = 'photo' | 'voice' | 'text' | 'choice' | 'skipped' | 'describe';

export interface Memory {
  id: string;
  companion_id: string;
  day: DayNumber;
  type: MemoryInputType;
  /** V0.6.1 新增：与 type 区分。type 是数据形态；input_method 是用户实际操作方式 */
  input_method?: InputMethod;
  photo_url?: string;
  vision_tags?: VisionTags;
  user_text?: string;
  /** V0.6.1：语音文件 URL（如果 input_method=voice）*/
  voice_audio_url?: string;
  /** V0.6.1：ASR 原始识别结果（在孩子编辑前）*/
  asr_transcription?: string;
  /** V0.6.1：孩子在中转页编辑后的最终文字 */
  edited_text?: string;
  /** V0.6.1：卡片重做次数（0/1/2/3）*/
  regenerate_count?: number;
  task_id: string;
  task_question?: string;
  created_at: string;
}

/** V0.6.1：纸片插画卡片（PRD §4 + Plan §4.1） */
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
  generation_attempt: 1 | 2 | 3 | 4;
  is_active: boolean;
  is_fallback_text_card: boolean;
  child_action: CardChildAction | null;
  confirmed_at: string | null;
  created_at: string;
}

/** V0.6.1：关键词提取输出（图像生成 prompt 内容来源） */
export interface KeywordExtractOutput {
  scene_type: 'indoor_room' | 'outdoor_place' | 'people_with_env' | 'object_focus';
  main_subjects: string[];
  visual_attributes: string[];
  atmosphere: string;
  prompt_content: string;
  excluded_details: string[];
}

/** V0.6.1：风格审核输出 */
export interface StyleAuditOutput {
  style_match: boolean;
  issues: string[];
  severity: CardSeverity;
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

/** 任务定义（PRD §3 + §11.3）
 * V0.6.1：'describe' 替代 'photo' / 'photo_text'（保留旧值用于兼容期，新逻辑只用 describe）
 */
export type TaskKind = 'photo' | 'text' | 'photo_text' | 'choice' | 'memory_review' | 'describe';

export interface TaskDef {
  id: string;
  day: DayNumber;
  kind: TaskKind;
  title: string;
  description: string;
  inputPlaceholder?: string;
  charLimit?: number;
}
