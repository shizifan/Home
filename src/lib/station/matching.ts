/**
 * 伙伴匹配逻辑
 * 朋友家拜访时匹配对方伙伴：优先真人伙伴，回退 NPC。
 * 学校匹配班级成员。
 */

import 'server-only';

import { query } from '@/lib/db/client';
import type { Companion } from '@/types';
import type { CompanionPresetId } from '@/components/characters/types';

/** 4 个 NPC 预设 ID（对应 companion_presets 表中的 sys_* 条目） */
const NPC_PRESET_IDS = ['sys_xiaoyu', 'sys_tudou', 'sys_xingxing', 'sys_amu'] as const;

/** NPC 伙伴的中文名 */
const NPC_NAMES: Record<string, string> = {
  sys_xiaoyu: '小鱼',
  sys_tudou: '土豆',
  sys_xingxing: '星星',
  sys_amu: '阿木',
};

/**
 * 为拜访匹配一个对方伙伴。
 * - 优先匹配其他已毕业的真实伙伴（排除自己）
 * - 无真实伙伴时随机选一个 NPC
 */
export async function matchCompanion(
  myCompanionId: string,
): Promise<Companion> {
  // 1. 优先匹配其他已毕业的真实伙伴（排除自己）
  const real = await query<Companion>(
    `SELECT id, user_id, preset_id, custom_name, starting_personality,
            current_day, visit_count, school_count, plaza_count,
            created_at, graduated_at
     FROM companions
     WHERE graduated_at IS NOT NULL
       AND id != $1
     ORDER BY RANDOM()
     LIMIT 1`,
    [myCompanionId],
  );
  if (real.length > 0) return real[0];

  // 2. 无真实伙伴时，匹配 NPC
  return getNpcCompanionData();
}

/**
 * 随机选择一个 NPC 伙伴作为虚拟同伴。
 * NPC 伙伴是系统预设的伙伴实例，有真实的 companions 表行和 memory_bank。
 */
export async function getNpcCompanionData(): Promise<Companion> {
  const pick = NPC_PRESET_IDS[Math.floor(Math.random() * NPC_PRESET_IDS.length)];
  const row = await query<Companion>(
    `SELECT id, user_id, preset_id, custom_name, starting_personality,
            current_day, visit_count, school_count, plaza_count,
            created_at, graduated_at
     FROM companions
     WHERE preset_id = $1
     LIMIT 1`,
    [pick],
  );
  if (row.length > 0) return row[0];

  // 如果 NPC 不存在于 companions 表（极端情况），返回一个占位对象
  return {
    id: pick,
    user_id: 'system',
    preset_id: pick as unknown as CompanionPresetId,
    custom_name: NPC_NAMES[pick] ?? '陌生人',
    starting_personality: '一个善良的伙伴',
    current_day: 7 as const,
    visit_count: 0,
    school_count: 0,
    plaza_count: 0,
    created_at: new Date().toISOString(),
    graduated_at: new Date().toISOString(),
  };
}

/**
 * 为学校匹配班级成员。
 * @param myCompanionId 自己的伙伴 ID
 * @param size 班级总人数（含自己），默认 4
 */
export async function matchSchoolClass(
  myCompanionId: string,
  size: number = 4,
): Promise<Companion[]> {
  const classmates: Companion[] = [];

  // 1. 我方伙伴始终在列（由调用方添加）

  // 2. 从其他已毕业伙伴随机选 (size-1) 只
  const others = await query<Companion>(
    `SELECT id, user_id, preset_id, custom_name, starting_personality,
            current_day, visit_count, school_count, plaza_count,
            created_at, graduated_at
     FROM companions
     WHERE graduated_at IS NOT NULL
       AND id != $1
     ORDER BY RANDOM()
     LIMIT $2`,
    [myCompanionId, size - 1],
  );
  classmates.push(...others);

  // 3. 不足时从 NPC 补充
  while (classmates.length < size - 1) {
    const npc = await getNpcCompanionData();
    // 避免重复 NPC
    if (!classmates.some(c => c.id === npc.id)) {
      classmates.push(npc);
    } else {
      break; // 防止死循环
    }
  }

  return classmates;
}
