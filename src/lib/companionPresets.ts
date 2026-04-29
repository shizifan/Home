/**
 * 8 个预设伙伴（与 supabase/seed.sql 同源）
 * 客户端直接静态引用，避免 P1 阶段还要建 API。
 * 真接 Supabase 后，把此文件作为 fallback / type ref，主数据从 companion_presets 表读。
 */

import companionsJson from '@prompts/shared/companions.json';
import type { CompanionPresetId } from '@/components/characters/types';

export interface CompanionPresetMeta {
  preset_id: CompanionPresetId;
  name: string;
  appearance: string;
  personality: string;
  personality_examples: string[];
  skip_response: string;
}

const list = (companionsJson as { companions: CompanionPresetMeta[] }).companions;

export const COMPANION_PRESETS: CompanionPresetMeta[] = list;

export function getCompanionPreset(id: CompanionPresetId): CompanionPresetMeta | undefined {
  return list.find((c) => c.preset_id === id);
}
