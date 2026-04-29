/**
 * LLM 输出 Schema（zod）
 * 与 prompts 中要求的 JSON 结构对齐，作为 callLLM.parse 的实现。
 */

import 'server-only';
import { z } from 'zod';

export const Pass1Schema = z.object({
  action: z.enum(['create_new', 'append_to_existing', 'mark_uncertain', 'set_aside']),
  concept_name: z.string().min(1).max(100),
  concept_category: z.enum([
    'person',
    'place',
    'food',
    'activity',
    'object',
    'emotion',
    'other',
  ]),
  target_concept_id: z.string().nullable(),
  evidence_text: z.string().min(1),
  ai_reasoning: z.string().min(1),
  confidence: z.number().min(0).max(1),
});
export type Pass1Output = z.infer<typeof Pass1Schema>;

export const ConceptDetailSchema = z.object({
  understanding: z.string().min(1),
  reasoning: z.string().min(1),
  evidence_rephrased: z.array(
    z.object({
      day: z.number().int().min(1).max(7),
      text: z.string().min(1),
    }),
  ),
});
export type ConceptDetailOutput = z.infer<typeof ConceptDetailSchema>;

export const Day7Schema = z.object({
  most_important_person: z.string().min(1).max(60),
  most_fun_thing: z.string().min(1).max(60),
  most_delicious_thing: z.string().min(1).max(60),
  most_scary_thing: z.string().min(1).max(60),
  unknown_thing: z.string().min(1).max(60),
  almost_forgot_thing: z.string().nullable(),
});
export type Day7Output = z.infer<typeof Day7Schema>;

/**
 * 兜底解析：先尝试整体 JSON.parse，失败再用宽松的"代码块抽取"。
 * 用 zod 做最终校验 + 钳制（confidence 0..1）。
 */
export function parseJsonStrict<T>(raw: string, schema: z.ZodType<T>): T | null {
  if (!raw) return null;
  let attempt = raw.trim();
  // 去掉 ```json 包围
  attempt = attempt.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
  try {
    const obj = JSON.parse(attempt);
    const r = schema.safeParse(obj);
    if (r.success) return r.data;
    return null;
  } catch {
    // 尝试只取第一个 { ... } 段
    const start = attempt.indexOf('{');
    const end = attempt.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        const obj = JSON.parse(attempt.slice(start, end + 1));
        const r = schema.safeParse(obj);
        if (r.success) return r.data;
      } catch {
        return null;
      }
    }
  }
  return null;
}

/**
 * Pass 2 输出是纯文本（无 JSON），强制 ≤ 50 字 + 去引号。
 */
export function parsePass2Text(raw: string, maxLen = 50): string | null {
  if (!raw) return null;
  let s = raw.trim();
  // 去掉一对外层引号 / 「」 / 「
  s = s.replace(/^["'「『]+|["'」』]+$/g, '');
  s = s.trim();
  if (!s) return null;
  if (s.length <= maxLen) return s;
  // 截断到第一个完整句号位置
  for (const punct of ['。', '！', '？', '.', '!', '?']) {
    const idx = s.indexOf(punct);
    if (idx > 0 && idx <= maxLen) return s.slice(0, idx + 1);
  }
  return s.slice(0, maxLen);
}

/** 纠正反馈：纯文本，≤ 30 字 */
export function parseCorrectionText(raw: string): string | null {
  return parsePass2Text(raw, 30);
}
