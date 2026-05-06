/**
 * 统一 LLM 客户端 — 通过 OpenAI 兼容协议调下游模型
 *
 * 7 个调用点（pass1 / pass2 / concept_detail / correction / day7 / keyword_extract / free_chat）
 * 都走这一个客户端，按 callType 路由模型 / 温度 / max_tokens / timeout（PRD §21.4 表 + V0.6.1 §16）。
 * 注：style_audit 走多模态视觉模型，在 src/lib/imagegen/styleAudit.ts 独立实现。
 *
 * 失败行为：本层只做 maxRetries 次重试 + 透传错误；降级（备用文案 / set_aside 写入）由调用方处理。
 *
 * ── 降级链总览（PRD §25.2）── 修改任何调用点前请对照
 *   pass1                maxRetries=1 → pass1FallbackSetAside（写 set_aside）
 *   pass2                maxRetries=1 → pickFallbackPass2AfterText/Photo
 *   concept_detail       maxRetries=1 → 显示原 evidence + 隐 reasoning（API 层处理）
 *   correction           maxRetries=0 → companion 预设台词（correction.ts 内）
 *   day7                 maxRetries=2 → 503 严禁预设替代（PRD §25.2）
 *   keyword_extract      maxRetries=1 → keywordExtractFallback（用 task 标题）
 *   free_chat            maxRetries=0 → throw（按 spec/Free_Chat_Implementation V0.2 设计）
 *   day5_q1 / day5_q2    maxRetries=1 → DAY5_FALLBACK_Q1 / Q2
 *   visit                maxRetries=1 → "它好像还没回来......明天再来看看？"（trip.report_data 占位）
 *   opening_line         maxRetries=1 → openingLineFallback（personality_examples[0]）
 *   school               maxRetries=1 → schoolFallbackOutput（每只伙伴说"今天有点累了"占位）
 *   plaza_act            maxRetries=1 → plazaActFallback（"这一幕剧情卡了一下..."）
 *   plaza_ending         maxRetries=1 → plazaEndingFallback（按 quality 计数推断 ending_type + always 道具）
 *
 * skipped 输入根本不调 LLM：processInput 内短路写 set_aside + 取预设跳过台词。
 */

import 'server-only';

import OpenAI from 'openai';
import { logLLMCall } from '@/lib/db/repos';

export type LLMCallType =
  | 'pass1'
  | 'pass2'
  | 'concept_detail'
  | 'correction'
  | 'day7'
  | 'keyword_extract'  // V0.6.1：从描述提取图像 prompt 内容
  | 'free_chat'        // V0.6.1+：ChatOverlay 开放问答
  | 'visit'            // P2：朋友家拜访（PRD §23.10）
  | 'opening_line'     // Day 2-6 伙伴主动开场白（PRD §5.6）
  | 'school'           // P3：学校课堂（PRD §23.11）
  | 'plaza_act'        // P5：广场剧本单幕（PRD §23.12）
  | 'plaza_ending';    // P5：广场剧本结局（PRD §23.13）
// 注：style_audit 走通义千问-VL（DashScope），不走 DeepSeek，
// 在 src/lib/imagegen/styleAudit.ts 独立实现。

interface ParamSet {
  model: string;
  max_tokens: number;
  temperature: number;
  timeoutMs: number;
}

// PRD §14.3 LLM 调用参数总览 + V0.6.1 §16
const PARAMS: Record<LLMCallType, ParamSet> = {
  pass1: { model: '', max_tokens: 300, temperature: 0.3, timeoutMs: 6000 },
  pass2: { model: '', max_tokens: 200, temperature: 0.7, timeoutMs: 8000 },
  concept_detail: { model: '', max_tokens: 400, temperature: 0.5, timeoutMs: 10000 },
  correction: { model: '', max_tokens: 100, temperature: 0.6, timeoutMs: 3000 },
  day7: { model: '', max_tokens: 500, temperature: 0.5, timeoutMs: 15000 },
  keyword_extract: { model: '', max_tokens: 400, temperature: 0.2, timeoutMs: 6000 },
  free_chat: { model: '', max_tokens: 120, temperature: 0.6, timeoutMs: 8000 },
  visit: { model: '', max_tokens: 600, temperature: 0.7, timeoutMs: 12000 },
  opening_line: { model: '', max_tokens: 120, temperature: 0.7, timeoutMs: 8000 },
  school: { model: '', max_tokens: 700, temperature: 0.5, timeoutMs: 12000 },
  plaza_act: { model: '', max_tokens: 500, temperature: 0.6, timeoutMs: 12000 },
  plaza_ending: { model: '', max_tokens: 600, temperature: 0.5, timeoutMs: 15000 },
};

let _client: OpenAI | null = null;
function getClient(): OpenAI {
  if (_client) return _client;
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const baseURL = process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com/v1';
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY is not set');
  _client = new OpenAI({ apiKey, baseURL });
  return _client;
}

function modelFor(callType: LLMCallType): string {
  if (callType === 'day7') {
    return process.env.DEEPSEEK_MODEL_DAY7 ?? process.env.DEEPSEEK_MODEL ?? 'deepseek-chat';
  }
  return process.env.DEEPSEEK_MODEL ?? 'deepseek-chat';
}

export type LLMResult<T> =
  | { success: true; data: T; raw: string; latencyMs: number; usage?: OpenAI.CompletionUsage }
  | {
      success: false;
      reason: 'timeout' | 'parse' | 'validate' | 'safety' | 'http';
      raw?: string;
      latencyMs: number;
      error?: string;
    };

export interface CallOptions<T> {
  callType: LLMCallType;
  /** 拼好的完整 system+user 内容；走 chat.completions */
  systemPrompt: string;
  userPrompt: string;
  /** 解析 + 验证；返回 null 表示验证失败 */
  parse: (raw: string) => T | null;
  /** 期望 JSON 输出 → 设 true 自动加 response_format */
  expectJson?: boolean;
  /** 调用上下文用于 log */
  companionId?: string;
  promptVersion?: string;
  /** 自定义 timeout / max_tokens / temperature 覆盖默认 */
  overrides?: Partial<ParamSet>;
  /** 重试次数（默认 1，总共调用 1+1=2 次）*/
  maxRetries?: number;
}

export async function callLLM<T>(opts: CallOptions<T>): Promise<LLMResult<T>> {
  const params = { ...PARAMS[opts.callType], ...opts.overrides };
  const model = params.model || modelFor(opts.callType);
  const maxRetries = opts.maxRetries ?? 1;

  let lastErr: LLMResult<T> | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const start = Date.now();
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), params.timeoutMs);

      const completion = await getClient().chat.completions.create(
        {
          model,
          temperature: params.temperature,
          max_tokens: params.max_tokens,
          messages: [
            { role: 'system', content: opts.systemPrompt },
            { role: 'user', content: opts.userPrompt },
          ],
          ...(opts.expectJson
            ? { response_format: { type: 'json_object' as const } }
            : {}),
        },
        { signal: ctrl.signal },
      );
      clearTimeout(timer);

      const raw = completion.choices?.[0]?.message?.content?.trim() ?? '';
      const latencyMs = Date.now() - start;

      const parsed = opts.parse(raw);
      if (parsed == null) {
        lastErr = {
          success: false,
          reason: 'validate',
          raw,
          latencyMs,
          error: 'parse() returned null',
        };
        await logLLMCall({
          companionId: opts.companionId,
          callType: opts.callType,
          model,
          inputTokens: completion.usage?.prompt_tokens,
          outputTokens: completion.usage?.completion_tokens,
          latencyMs,
          success: false,
          failReason: 'validate',
          promptVersion: opts.promptVersion,
        });
        continue; // 重试
      }

      await logLLMCall({
        companionId: opts.companionId,
        callType: opts.callType,
        model,
        inputTokens: completion.usage?.prompt_tokens,
        outputTokens: completion.usage?.completion_tokens,
        latencyMs,
        success: true,
        promptVersion: opts.promptVersion,
      });

      return {
        success: true,
        data: parsed,
        raw,
        latencyMs,
        usage: completion.usage,
      };
    } catch (err) {
      const latencyMs = Date.now() - start;
      const isAbort = (err as Error)?.name === 'AbortError';
      const reason: 'timeout' | 'http' | 'parse' = isAbort
        ? 'timeout'
        : (err as { code?: string })?.code === 'ECONNABORTED'
          ? 'timeout'
          : 'http';
      const msg = (err as Error)?.message ?? String(err);
      lastErr = { success: false, reason, latencyMs, error: msg };
      await logLLMCall({
        companionId: opts.companionId,
        callType: opts.callType,
        model,
        latencyMs,
        success: false,
        failReason: reason,
        promptVersion: opts.promptVersion,
      });
      // 继续重试（除非已达上限）
    }
  }
  return lastErr ?? {
    success: false,
    reason: 'http',
    latencyMs: 0,
    error: 'unknown',
  };
}
