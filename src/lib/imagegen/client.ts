/**
 * 图像生成 Client — 通义万相 (DashScope)
 *
 * 同步流程：提交 → 轮询 → 拿结果，最多等 25 秒。
 * 失败：返回 null。
 */

import 'server-only';

import { logLLMCall } from '@/lib/db/repos';

export interface ImageGenInput {
  /** 完整 prompt（已含 STYLE_PREFIX + 内容 + STYLE_CONSTRAINTS）*/
  prompt: string;
  /** 参考图 URL（如有，PRD §4.4.3）*/
  referenceImageUrl?: string | null;
  /** 输出尺寸 */
  size?: '512*512' | '768*768' | '1024*1024';
}

export interface ImageGenResult {
  imageUrl: string;
  rawResponse: unknown;
  latencyMs: number;
  /** 图像来源标识 */
  source: 'dashscope' | 'minimax';
}

const SUBMIT_URL =
  process.env.DASHSCOPE_IMAGEGEN_BASE_URL ??
  'https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis';
const TASK_URL = 'https://dashscope.aliyuncs.com/api/v1/tasks';
const DEFAULT_MODEL = process.env.DASHSCOPE_IMAGEGEN_MODEL ?? 'wanx2.1-t2i-turbo';
const TOTAL_TIMEOUT_MS = 25_000;
const POLL_INTERVAL_MS = 1_000;

const MOCK_RESULT: ImageGenResult = {
  imageUrl: 'https://example.com/mock-card.png',
  rawResponse: { mock: true },
  latencyMs: 0,
  source: 'dashscope',
};

export async function generateImageDashScope(
  input: ImageGenInput,
  companionId?: string,
): Promise<ImageGenResult | null> {
  if (process.env.TEST_LLM_MODE === 'mock') {
    return MOCK_RESULT;
  }

  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    console.error('[imagegen] DASHSCOPE_API_KEY not set');
    return null;
  }

  const start = Date.now();
  try {
    // 1. 提交任务
    const submitRes = await fetch(SUBMIT_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-DashScope-Async': 'enable',
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        input: {
          prompt: input.prompt,
          ...(input.referenceImageUrl ? { ref_img: input.referenceImageUrl } : {}),
        },
        parameters: {
          size: input.size ?? '768*768',
          n: 1,
        },
      }),
    });

    if (!submitRes.ok) {
      const text = await submitRes.text();
      throw new Error(`submit ${submitRes.status}: ${text.slice(0, 200)}`);
    }
    const submitJson = (await submitRes.json()) as {
      output?: { task_id?: string; task_status?: string };
    };
    const taskId = submitJson.output?.task_id;
    if (!taskId) throw new Error('no task_id in submit response');

    // 2. 轮询直到 SUCCEEDED 或超时
    let pollResult: unknown = null;
    let imageUrl: string | undefined;
    while (Date.now() - start < TOTAL_TIMEOUT_MS) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      const pollRes = await fetch(`${TASK_URL}/${taskId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!pollRes.ok) continue;
      const pollJson = (await pollRes.json()) as {
        output?: {
          task_status?: string;
          results?: Array<{ url?: string }>;
        };
      };
      pollResult = pollJson;
      const status = pollJson.output?.task_status;
      if (status === 'SUCCEEDED') {
        imageUrl = pollJson.output?.results?.[0]?.url;
        break;
      }
      if (status === 'FAILED' || status === 'UNKNOWN') {
        throw new Error(`task ${status}`);
      }
    }

    const latencyMs = Date.now() - start;
    if (!imageUrl) {
      await logLLMCall({
        companionId,
        callType: 'imagegen',
        model: DEFAULT_MODEL,
        latencyMs,
        success: false,
        failReason: 'timeout',
      });
      return null;
    }

    await logLLMCall({
      companionId,
      callType: 'imagegen',
      model: DEFAULT_MODEL,
      latencyMs,
      success: true,
    });

    return { imageUrl, rawResponse: pollResult, latencyMs, source: 'dashscope' };
  } catch (err) {
    const latencyMs = Date.now() - start;
    await logLLMCall({
      companionId,
      callType: 'imagegen',
      model: DEFAULT_MODEL,
      latencyMs,
      success: false,
      failReason: 'http',
    });
    console.error('[imagegen:dashscope]', (err as Error)?.message ?? err);
    return null;
  }
}
