/**
 * 风格审核 — 通义千问-VL（DashScope）
 *
 * 与 vision/client.ts 复用同一 API key 但模板/温度不同。
 * 不走 callLLM（callLLM 路由到 DeepSeek），独立实现。
 *
 * 失败时返回 severity=ok 并记录告警 — 不阻塞主流程（V0.6.1 §12.2）。
 */

import 'server-only';

import OpenAI from 'openai';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { logLLMCall } from '@/lib/db/repos';
import { StyleAuditSchema, parseJsonStrict, type StyleAuditOutput } from '@/lib/llm/validators';

let _client: OpenAI | null = null;
function getClient(): OpenAI {
  if (_client) return _client;
  const apiKey = process.env.DASHSCOPE_API_KEY;
  const baseURL =
    process.env.DASHSCOPE_BASE_URL ??
    'https://dashscope.aliyuncs.com/compatible-mode/v1';
  if (!apiKey) throw new Error('DASHSCOPE_API_KEY is not set');
  _client = new OpenAI({ apiKey, baseURL });
  return _client;
}

const MODEL = process.env.DASHSCOPE_VISION_MODEL ?? 'qwen-vl-plus';
const TIMEOUT_MS = 10_000;

const PROMPTS_DIR = path.join(process.cwd(), 'prompts');
const SYSTEM_PROMPT = readFileSync(path.join(PROMPTS_DIR, 'style_audit/system.md'), 'utf8');

const MOCK_RESULT: StyleAuditOutput = {
  style_match: true,
  issues: [],
  severity: 'ok',
};

/**
 * 对生成的图片做纸片马里奥风格审核。
 *
 * @param imageUrl 远程 URL（通义万相返回的 OSS URL）
 * @returns 审核结果；失败时返回 severity=ok 不阻塞
 */
export async function auditImageStyle(
  imageUrl: string,
  companionId?: string,
): Promise<StyleAuditOutput> {
  if (process.env.TEST_LLM_MODE === 'mock') {
    return MOCK_RESULT;
  }

  const start = Date.now();
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

    const completion = await getClient().chat.completions.create(
      {
        model: MODEL,
        temperature: 0.1,
        max_tokens: 200,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: SYSTEM_PROMPT },
              { type: 'image_url', image_url: { url: imageUrl } },
            ],
          },
        ],
      },
      { signal: ctrl.signal },
    );
    clearTimeout(timer);

    const raw = completion.choices?.[0]?.message?.content?.trim() ?? '';
    const latencyMs = Date.now() - start;

    const parsed = parseJsonStrict(raw, StyleAuditSchema);
    await logLLMCall({
      companionId,
      callType: 'style_audit',
      model: MODEL,
      inputTokens: completion.usage?.prompt_tokens,
      outputTokens: completion.usage?.completion_tokens,
      latencyMs,
      success: parsed != null,
      failReason: parsed ? undefined : 'parse',
    });

    if (!parsed) {
      // 解析失败时不阻塞流程，按 ok 通过（带告警）
      console.warn('[style_audit] parse failed, defaulting to ok. raw=', raw.slice(0, 200));
      return MOCK_RESULT;
    }
    return parsed;
  } catch (err) {
    const latencyMs = Date.now() - start;
    await logLLMCall({
      companionId,
      callType: 'style_audit',
      model: MODEL,
      latencyMs,
      success: false,
      failReason: (err as Error)?.name === 'AbortError' ? 'timeout' : 'http',
    });
    console.error('[style_audit]', (err as Error)?.message ?? err);
    // 服务故障时不阻塞
    return MOCK_RESULT;
  }
}
