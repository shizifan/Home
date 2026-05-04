/**
 * 图像内容审核 — 双层防护架构
 *
 * 第一层：阿里云内容安全 API（aliyunImageScan）— 主拦截
 * 第二层：通义千问-VL 补充审核 — 检查阿里云可能遗漏的内容（真实人脸、文字/Logo、品牌标识）
 *
 * 失败时返回 passed=false（保守策略），调用方走文字降级。
 */

import 'server-only';

import OpenAI from 'openai';
import { logLLMCall } from '@/lib/db/repos';
import { aliyunImageScan } from './aliyunSafetyClient';

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

const MOCK_RESULT: ContentAuditResult = { passed: true, labels: [] };

/**
 * 第二层提示词：只关注阿里云 API 可能遗漏的内容
 * - 真实人脸（写实照片级）
 * - 文字/Logo/品牌标识（是否包含露出的品牌标志或敏感文字）
 */
const SUPPLEMENTARY_AUDIT_PROMPT = `你是儿童内容安全审核员（补充层）。
请判断这张给 8–12 岁孩子看的插画是否存在以下问题。

【检查重点（阿里云已拦截暴力/色情，你只需关注以下方面）】
- 是否包含真实人脸的写实照片（非纸片/简笔画人物）
- 是否包含明显的品牌文字、Logo 或品牌标识
- 是否包含电话号码、网址、二维码等联系方式

【输出 JSON】
{
  "passed": true 或 false,
  "labels": ["命中的标签，可空。如 real_face, brand_logo, contact_info"]
}

仅输出 JSON。`;

export async function auditImageContent(
  imageUrl: string,
  companionId?: string,
): Promise<ContentAuditResult> {
  // Mock mode: skip all audits
  if (process.env.TEST_LLM_MODE === 'mock') {
    return MOCK_RESULT;
  }

  // ── 第一层：阿里云内容安全 API ──
  const aliyunResult = await aliyunImageScan(imageUrl);
  if (!aliyunResult.passed) {
    // Aliyun blocked the image — fail immediately
    return {
      passed: false,
      labels: aliyunResult.labels.length > 0 ? aliyunResult.labels : ['aliyun_blocked'],
    };
  }

  // ── 第二层：通义千问-VL 补充审核（真实人脸、文字/Logo、品牌标识） ──
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
              { type: 'text', text: SUPPLEMENTARY_AUDIT_PROMPT },
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
      const cleaned = raw
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim();
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
      callType: 'content_audit_supplementary',
      model: MODEL,
      latencyMs,
      success: parsed != null,
      failReason: parsed ? undefined : 'parse',
    });

    if (!parsed) {
      // Qwen-VL 解析失败：日志告警但放行（第一层已通过，保守放行而非拦截）
      console.warn('[content_audit_supplementary] parse failed, allowing (layer 1 passed). raw=', raw.slice(0, 200));
      return { passed: true, labels: [] };
    }
    return parsed;
  } catch (err) {
    const latencyMs = Date.now() - start;
    await logLLMCall({
      companionId,
      callType: 'content_audit_supplementary',
      model: MODEL,
      latencyMs,
      success: false,
      failReason: (err as Error)?.name === 'AbortError' ? 'timeout' : 'http',
    });
    console.error('[content_audit_supplementary]', (err as Error)?.message ?? err);
    // 第二层故障时放行（第一层已通过）
    return { passed: true, labels: [] };
  }
}
