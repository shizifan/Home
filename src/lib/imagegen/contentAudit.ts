/**
 * 图像内容审核 — 阿里云内容安全（绿网）
 *
 * 在风格审核之后再做一次（V0.6.1 §19.2 双层防护）。
 *
 * MVP 简化：先用通义千问-VL 做软审（重用 styleAudit 同 client），
 * 后续接阿里云内容安全 API 替换。当前实现只检查 obvious 暴力/恐怖关键词。
 *
 * 失败时返回 passed=false（保守策略），调用方走文字降级。
 */

import 'server-only';

import OpenAI from 'openai';
import { logLLMCall } from '@/lib/db/repos';

export interface ContentAuditResult {
  passed: boolean;
  labels: string[];
}

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
const TIMEOUT_MS = 8_000;

const AUDIT_PROMPT = `你是儿童内容安全审核员。
请判断这张给 8–12 岁孩子看的插画是否安全。

【拦截标准（任一命中即不通过）】
- 暴力、血腥、恐怖
- 武器、毒品
- 成人/性暗示
- 明确的真实人脸（写实照片级人脸，纸片简笔人物可通过）
- 仇恨、歧视性符号

【输出 JSON】
{
  "passed": true 或 false,
  "labels": ["命中的标签，可空"]
}

仅输出 JSON。`;

const MOCK_RESULT: ContentAuditResult = { passed: true, labels: [] };

export async function auditImageContent(
  imageUrl: string,
  companionId?: string,
): Promise<ContentAuditResult> {
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
        max_tokens: 100,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: AUDIT_PROMPT },
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

    let parsed: ContentAuditResult | null = null;
    try {
      const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
      const start_ = cleaned.indexOf('{');
      const end_ = cleaned.lastIndexOf('}');
      if (start_ < 0 || end_ <= start_) throw new Error('no json');
      const obj = JSON.parse(cleaned.slice(start_, end_ + 1));
      if (typeof obj.passed === 'boolean') {
        parsed = {
          passed: obj.passed,
          labels: Array.isArray(obj.labels) ? obj.labels.map(String) : [],
        };
      }
    } catch {
      parsed = null;
    }

    await logLLMCall({
      companionId,
      callType: 'content_audit',
      model: MODEL,
      latencyMs,
      success: parsed != null,
      failReason: parsed ? undefined : 'parse',
    });

    if (!parsed) {
      // 解析失败时保守拦截（避免漏放有问题图）
      console.warn('[content_audit] parse failed, defaulting to fail. raw=', raw.slice(0, 200));
      return { passed: false, labels: ['audit_parse_fail'] };
    }
    return parsed;
  } catch (err) {
    const latencyMs = Date.now() - start;
    await logLLMCall({
      companionId,
      callType: 'content_audit',
      model: MODEL,
      latencyMs,
      success: false,
      failReason: (err as Error)?.name === 'AbortError' ? 'timeout' : 'http',
    });
    console.error('[content_audit]', (err as Error)?.message ?? err);
    // 审核服务故障时保守拦截
    return { passed: false, labels: ['audit_unavailable'] };
  }
}
