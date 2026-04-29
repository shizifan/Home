/**
 * Prompt 模板加载 + 变量注入
 * 模板格式：prompts/{name}/system.md，变量用 {{var}}，包括 {{HARD_CONSTRAINTS}} 与 {{FEW_SHOT_EXAMPLES}}。
 */

import 'server-only';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const PROMPTS_DIR = path.join(process.cwd(), 'prompts');

const HARD_CONSTRAINTS = readFileSync(
  path.join(PROMPTS_DIR, 'shared/hard_constraints.md'),
  'utf8',
);

interface CachedTemplate {
  raw: string;
  loadedAt: number;
}

const _cache = new Map<string, CachedTemplate>();
const TTL = 60 * 1000; // dev 期 1 分钟，方便改 prompt 即时生效

function loadTemplate(name: string): string {
  const now = Date.now();
  const cached = _cache.get(name);
  if (cached && now - cached.loadedAt < TTL) return cached.raw;
  const raw = readFileSync(path.join(PROMPTS_DIR, name, 'system.md'), 'utf8');
  _cache.set(name, { raw, loadedAt: now });
  return raw;
}

export function renderPrompt(
  templateName: string,
  vars: Record<string, string | number | undefined>,
  fewShotExamples?: string,
): string {
  let out = loadTemplate(templateName);
  out = out.replaceAll('{{HARD_CONSTRAINTS}}', HARD_CONSTRAINTS);
  out = out.replaceAll('{{FEW_SHOT_EXAMPLES}}', fewShotExamples ?? '（无示例）');
  for (const [k, v] of Object.entries(vars)) {
    const str = v == null ? '' : String(v);
    out = out.replaceAll(`{{${k}}}`, str);
  }
  return out;
}

/** 从 examples JSON 文件读 Few-shot 列表，并格式化为 prompt 注入字符串 */
export function loadFewShotJSON(relPath: string): string {
  const file = readFileSync(path.join(PROMPTS_DIR, relPath), 'utf8');
  const data = JSON.parse(file);
  if (Array.isArray(data.examples)) {
    return data.examples
      .map((ex: Record<string, unknown>, i: number) => {
        const lines = [`示例 ${i + 1}：`];
        if (ex.input) lines.push(`输入：${JSON.stringify(ex.input, null, 2)}`);
        if (ex.context) lines.push(`上下文：${ex.context}`);
        if (ex.expected_output)
          lines.push(`输出：${JSON.stringify(ex.expected_output, null, 2)}`);
        return lines.join('\n');
      })
      .join('\n\n');
  }
  return JSON.stringify(data, null, 2);
}

export function clearPromptCache() {
  _cache.clear();
}
