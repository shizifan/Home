/**
 * 统一 LLM 客户端 — Claude (Anthropic SDK) + DeepSeek 兼容过渡
 *
 * V1.0 切换：DeepSeek-V3 → Claude Sonnet 4.5 作为主模型
 * 通过 LLM_PROVIDER 环境变量切换：anthropic（默认）/ deepseek（过渡期）
 *
 * 13 个调用点（V0.6.1 的 7 个 + V1.0 新增 4 个 + content_audit 1 个）：
 *   pass1 / pass2 / concept_detail / correction / day7 / keyword_extract / free_chat
 *   visit / school / plaza_act / plaza_ending / content_audit (Vision)
 *
 * 失败行为：本层只做 1 次重试 + 透传错误；降级（备用文案 / set_aside 写入）由调用方处理。
 */

import 'server-only';

import Anthropic from '@anthropic-ai/sdk';
import { logLLMCall } from '@/lib/db/repos';

export type LLMCallType =
  // V0.6.1 已有
  | 'pass1'
  | 'pass2'
  | 'concept_detail'
  | 'correction'
  | 'day7'
  | 'keyword_extract'
  | 'free_chat'
  // V1.0 新增
  | 'visit'
  | 'school'
  | 'plaza_act'
  | 'plaza_ending'
  | 'content_audit';

interface ParamSet {
  model: string;
  maxTokens: number;
  temperature: number;
  timeoutMs: number;
}

// PRD §23 + V1.0 Plan_01 §5.2.1 Claude 参数表
const PARAMS: Record<LLMCallType, ParamSet> = {
  pass1:            { model: 'claude-sonnet-4-5-20250929', maxTokens: 300,  temperature: 0.3, timeoutMs: 6000 },
  pass2:            { model: 'claude-sonnet-4-5-20250929', maxTokens: 200,  temperature: 0.7, timeoutMs: 8000 },
  concept_detail:   { model: 'claude-sonnet-4-5-20250929', maxTokens: 400,  temperature: 0.5, timeoutMs: 10000 },
  correction:       { model: 'claude-sonnet-4-5-20250929', maxTokens: 150,  temperature: 0.4, timeoutMs: 6000 },
  day7:             { model: 'claude-sonnet-4-5-20250929', maxTokens: 2000, temperature: 0.7, timeoutMs: 30000 },
  keyword_extract:  { model: 'claude-sonnet-4-5-20250929', maxTokens: 400,  temperature: 0.2, timeoutMs: 6000 },
  free_chat:        { model: 'claude-sonnet-4-5-20250929', maxTokens: 120,  temperature: 0.6, timeoutMs: 8000 },
  visit:            { model: 'claude-sonnet-4-5-20250929', maxTokens: 500,  temperature: 0.7, timeoutMs: 15000 },
  school:           { model: 'claude-sonnet-4-5-20250929', maxTokens: 800,  temperature: 0.7, timeoutMs: 15000 },
  plaza_act:        { model: 'claude-sonnet-4-5-20250929', maxTokens: 600,  temperature: 0.8, timeoutMs: 12000 },
  plaza_ending:     { model: 'claude-sonnet-4-5-20250929', maxTokens: 800,  temperature: 0.7, timeoutMs: 15000 },
  content_audit:    { model: 'claude-sonnet-4-5-20250929', maxTokens: 200,  temperature: 0.1, timeoutMs: 8000 },
};

// -- Anthropic SDK singleton --
let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (_anthropic) return _anthropic;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');
  _anthropic = new Anthropic({ apiKey });
  return _anthropic;
}

// -- DeepSeek (OpenAI SDK) singleton — 过渡期保留 --
let _deepseek: import('openai').default | null = null;
function getDeepSeek(): import('openai').default {
  if (_deepseek) return _deepseek;
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const baseURL = process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com/v1';
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY is not set');
  // 动态加载避免 openai 包在纯 Anthropic 模式下仍需安装
  const OpenAI: typeof import('openai').default = require('openai');
  _deepseek = new OpenAI({ apiKey, baseURL });
  return _deepseek;
}

function getProvider(): 'anthropic' | 'deepseek' {
  return (process.env.LLM_PROVIDER as 'anthropic' | 'deepseek') ?? 'anthropic';
}

// -- Mock 应答 --
const MOCK_RAWS: Record<string, string> = {
  pass1: JSON.stringify({
    topic: '今天的天气',
    keyword: '阳光',
    companion_line: '今天阳光真好，你喜欢太阳吗？',
  }),
  pass2: JSON.stringify({
    introduction: '太阳很温暖，照在大地上',
    relation: '阳光让植物生长',
    question: '你知道太阳为什么会发光吗？',
  }),
  concept_detail: JSON.stringify({
    concept_name: '太阳',
    category: 'object',
    ai_summary: '小青龙知道太阳是温暖的，喜欢有太阳的天气',
    ai_reasoning: '从孩子的描述"阳光"推断出对太阳有正面认知',
    confidence: 0.8,
    type: 'remembered',
  }),
  correction: JSON.stringify({
    action: 'clarify',
    message: '你说的对，太阳确实很重要',
  }),
  day7: JSON.stringify({
    most_important_person: '妈妈',
    most_fun_thing: '去公园玩',
    most_delicious_thing: '草莓蛋糕',
    most_scary_thing: '天黑',
    unknown_thing: '星星为什么会闪',
    almost_forgot_thing: '奶奶煮的汤',
  }),
  keyword_extract: JSON.stringify({
    scene_type: 'outdoor_place',
    main_subjects: ['太阳', '草地'],
    visual_attributes: ['温暖', '明亮'],
    atmosphere: '温暖愉快',
    prompt_content: '阳光下的绿色草地，温暖明亮',
    excluded_details: ['人类面孔'],
  }),
  free_chat: '这个问题很有趣！让我想想...',
  visit: JSON.stringify({
    scene_narrative: '小青龙敲了敲大熊家的门。大熊慢吞吞地开了门，屋里全是森林和户外的画。',
    observation: '大熊眼里最多的是树、鱼和泥地——它从没提过城市里的东西。',
    new_word: {
      concept: '钓鱼',
      source_type: 'secondhand',
      source_companion: '大熊',
      confidence: 0.3,
    },
  }),
  school: JSON.stringify({
    question: '什么样的人通常当医生？',
    answers: [
      { companion: '小青龙', answer: '温柔、会照顾人的人。', basis: '你跟我说过奶奶很温柔' },
      { companion: '大熊', answer: '穿白大褂、不怕血的人。', basis: '' },
    ],
    highlight: '每只伙伴的答案都来自它自己的经历',
    teaching_moment: 'AI 回答不同的问题，是因为它们见过的东西不一样。',
  }),
  plaza_act: JSON.stringify({
    scene_narrative: '洪水冲垮了堤坝，百姓在哭喊。丞相在朝堂上召集大臣商议对策。',
    companion_speech: '（展开《治水图》）依图所示，应在上游开渠分流，下游加固堤坝。',
    reactions: '大将军点头赞同，户部尚书却面露难色——开渠需要大量银两。',
    item_use_quality: 'clever',
  }),
  plaza_ending: JSON.stringify({
    ending_type: 'good',
    narrative: '洪水终于退去。虽然耗尽了国库，但百姓保住了家园。小青龙因为善用《治水图》被皇帝嘉奖。',
    earned_items: [{ item_id: 'jade_seal', item_name: '皇帝赐的玉印', category: 'gift' }],
  }),
  content_audit: JSON.stringify({
    passed: true,
    labels: [],
  }),
};

// ============================================================
// 类型定义
// ============================================================

export interface ClaudeUsage {
  input_tokens: number;
  output_tokens: number;
}

export type LLMResult<T> =
  | { success: true; data: T; raw: string; latencyMs: number; usage?: ClaudeUsage }
  | {
      success: false;
      reason: 'timeout' | 'parse' | 'validate' | 'safety' | 'http';
      raw?: string;
      latencyMs: number;
      error?: string;
    };

export interface CallOptions<T> {
  callType: LLMCallType;
  systemPrompt: string;
  userPrompt: string;
  parse: (raw: string) => T | null;
  /** 期望 JSON 输出 → 在 system prompt 中追加 JSON 指令（Anthropic 无 response_format） */
  expectJson?: boolean;
  companionId?: string;
  promptVersion?: string;
  overrides?: Partial<ParamSet>;
  maxRetries?: number;
  /** V1.0 Vision: 图片 base64 或 URL */
  imageContent?: { type: 'base64'; media_type: 'image/jpeg' | 'image/png'; data: string } | { type: 'url'; url: string };
}

// ============================================================
// 调用入口
// ============================================================

export async function callLLM<T>(opts: CallOptions<T>): Promise<LLMResult<T>> {
  if (process.env.TEST_LLM_MODE === 'mock') {
    return mockCall<T>(opts);
  }

  const provider = getProvider();
  if (provider === 'deepseek') {
    return callDeepSeekLLM<T>(opts);
  }
  return callClaudeLLM<T>(opts);
}

// ============================================================
// Claude 调用（Anthropic SDK）
// ============================================================

async function callClaudeLLM<T>(opts: CallOptions<T>): Promise<LLMResult<T>> {
  const params = { ...PARAMS[opts.callType], ...opts.overrides };
  const model = params.model;
  const maxRetries = opts.maxRetries ?? 1;
  const anthropic = getAnthropic();

  // 构建 system prompt（Claude 需要 JSON 格式时在 system 中显式要求）
  let system = opts.systemPrompt;
  if (opts.expectJson) {
    system = `${system}\n\nYou must respond with valid JSON only. No markdown code fences, no preamble, no explanation.`;
  }

  // 构建 user content（支持纯文本或多模态 vision）
  const userContent = buildClaudeUserContent(opts);

  let lastErr: LLMResult<T> | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const start = Date.now();
    try {
      const msg = await withTimeout(
        anthropic.messages.create({
          model,
          max_tokens: params.maxTokens,
          temperature: params.temperature,
          system,
          messages: [{ role: 'user' as const, content: userContent }],
        }),
        params.timeoutMs,
      );

      const raw = extractTextContent(msg);
      const latencyMs = Date.now() - start;

      const parsed = opts.parse(raw);
      if (parsed == null) {
        lastErr = { success: false, reason: 'validate', raw, latencyMs, error: 'parse() returned null' };
        await logLLMCall({
          companionId: opts.companionId, callType: opts.callType, model,
          inputTokens: msg.usage.input_tokens, outputTokens: msg.usage.output_tokens,
          latencyMs, success: false, failReason: 'validate', promptVersion: opts.promptVersion,
        });
        continue;
      }

      await logLLMCall({
        companionId: opts.companionId, callType: opts.callType, model,
        inputTokens: msg.usage.input_tokens, outputTokens: msg.usage.output_tokens,
        latencyMs, success: true, promptVersion: opts.promptVersion,
      });

      return {
        success: true, data: parsed, raw, latencyMs,
        usage: { input_tokens: msg.usage.input_tokens, output_tokens: msg.usage.output_tokens },
      };
    } catch (err) {
      const latencyMs = Date.now() - start;
      const reason = classifyError(err);
      lastErr = { success: false, reason, latencyMs, error: (err as Error)?.message ?? String(err) };
      await logLLMCall({
        companionId: opts.companionId, callType: opts.callType, model,
        latencyMs, success: false, failReason: reason, promptVersion: opts.promptVersion,
      });
    }
  }
  return lastErr ?? { success: false, reason: 'http', latencyMs: 0, error: 'unknown' };
}

function buildClaudeUserContent(opts: CallOptions<unknown>): Anthropic.Messages.ContentBlockParam[] {
  const blocks: Anthropic.Messages.ContentBlockParam[] = [];

  if (opts.imageContent) {
    if (opts.imageContent.type === 'base64') {
      blocks.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: opts.imageContent.media_type,
          data: opts.imageContent.data,
        },
      });
    } else {
      blocks.push({
        type: 'image',
        source: {
          type: 'url',
          url: opts.imageContent.url,
        },
      });
    }
  }

  blocks.push({ type: 'text', text: opts.userPrompt });
  return blocks;
}

function extractTextContent(msg: Anthropic.Messages.Message): string {
  for (const block of msg.content) {
    if (block.type === 'text') return block.text.trim();
  }
  return '';
}

// ============================================================
// DeepSeek 调用（OpenAI 兼容 SDK）— 过渡期保留
// ============================================================

async function callDeepSeekLLM<T>(opts: CallOptions<T>): Promise<LLMResult<T>> {
  const params = { ...PARAMS[opts.callType], ...opts.overrides };
  // DeepSeek 过渡期使用对应的 deepseek 模型名
  const model =
    params.model === 'claude-sonnet-4-5-20250929'
      ? process.env.DEEPSEEK_MODEL ?? 'deepseek-chat'
      : params.model;
  const maxRetries = opts.maxRetries ?? 1;
  const deepseek = getDeepSeek();

  let lastErr: LLMResult<T> | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const start = Date.now();
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), params.timeoutMs);

      const completion = await deepseek.chat.completions.create(
        {
          model,
          temperature: params.temperature,
          max_tokens: params.maxTokens,
          messages: [
            { role: 'system', content: opts.systemPrompt },
            { role: 'user', content: opts.userPrompt },
          ],
          ...(opts.expectJson ? { response_format: { type: 'json_object' as const } } : {}),
        },
        { signal: ctrl.signal },
      );
      clearTimeout(timer);

      const raw = completion.choices?.[0]?.message?.content?.trim() ?? '';
      const latencyMs = Date.now() - start;

      const parsed = opts.parse(raw);
      if (parsed == null) {
        lastErr = { success: false, reason: 'validate', raw, latencyMs, error: 'parse() returned null' };
        await logLLMCall({
          companionId: opts.companionId, callType: opts.callType, model,
          inputTokens: completion.usage?.prompt_tokens, outputTokens: completion.usage?.completion_tokens,
          latencyMs, success: false, failReason: 'validate', promptVersion: opts.promptVersion,
        });
        continue;
      }

      await logLLMCall({
        companionId: opts.companionId, callType: opts.callType, model,
        inputTokens: completion.usage?.prompt_tokens, outputTokens: completion.usage?.completion_tokens,
        latencyMs, success: true, promptVersion: opts.promptVersion,
      });

      return {
        success: true, data: parsed, raw, latencyMs,
        usage: completion.usage
          ? { input_tokens: completion.usage.prompt_tokens, output_tokens: completion.usage.completion_tokens }
          : undefined,
      };
    } catch (err) {
      const latencyMs = Date.now() - start;
      const reason = classifyError(err);
      lastErr = { success: false, reason, latencyMs, error: (err as Error)?.message ?? String(err) };
      await logLLMCall({
        companionId: opts.companionId, callType: opts.callType, model,
        latencyMs, success: false, failReason: reason, promptVersion: opts.promptVersion,
      });
    }
  }
  return lastErr ?? { success: false, reason: 'http', latencyMs: 0, error: 'unknown' };
}

// ============================================================
// Mock 模式
// ============================================================

function mockCall<T>(opts: CallOptions<T>): LLMResult<T> {
  const raw = MOCK_RAWS[opts.callType] ?? '{}';
  const parsed = opts.parse(raw);
  if (parsed == null) {
    return { success: false, reason: 'validate', raw, latencyMs: 0, error: 'mock parse returned null' };
  }
  return { success: true, data: parsed, raw, latencyMs: 0 };
}

// ============================================================
// 辅助函数
// ============================================================

function classifyError(err: unknown): 'timeout' | 'http' {
  if (err instanceof Error) {
    if (err.name === 'AbortError' || err.message.includes('timed out') || err.message.includes('Timeout')) {
      return 'timeout';
    }
    if ('status' in err && typeof (err as { status: number }).status === 'number') {
      return 'http';
    }
  }
  return 'http';
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('LLM request timed out')), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}
