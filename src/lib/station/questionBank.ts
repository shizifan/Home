/**
 * 学校系统题库（PRD §13.4）
 *
 * 40 题（A 类 24 + B 类 16）+ 20 条教学时刻 pool。
 * 数据存于 data/system_questions.json。
 *
 * 选题规则（attend_class 目的）：
 *   - 按 (companion + date) 哈希挑一道；当日同一拜访者拿到同一题
 *   - A/B 类交替（每 3 次保证至少 1 次 B 类，避免连续高密度教育题让孩子疲劳）
 */

import 'server-only';

import questionsJson from '../../../data/system_questions.json';

export interface SystemQuestion {
  id: string;
  category: 'A' | 'B';
  text: string;
  intent: string;
}

interface QuestionsFile {
  version: string;
  questions: SystemQuestion[];
  teaching_moments: string[];
}

const FILE = questionsJson as unknown as QuestionsFile;
const ALL: SystemQuestion[] = FILE.questions;
const A_LIST = ALL.filter((q) => q.category === 'A');
const B_LIST = ALL.filter((q) => q.category === 'B');

export const TEACHING_MOMENTS: string[] = FILE.teaching_moments;

function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * 按 (visitor + 当日) 挑选系统题。
 * A/B 类交替策略：以 dayOfYear 为分流，3 天里有 2 天落 A 类、1 天落 B 类。
 */
export function pickSystemQuestion(visitorPresetId: string): SystemQuestion {
  const today = new Date();
  const dayOfYear = Math.floor(
    (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) /
      86400_000,
  );
  const seed = `${visitorPresetId}-${today.toISOString().slice(0, 10)}-q`;
  const hash = hashSeed(seed);

  const isB = dayOfYear % 3 === 0;
  const pool = isB ? B_LIST : A_LIST;
  return pool[hash % pool.length];
}

export function listAllQuestions(): SystemQuestion[] {
  return ALL;
}
