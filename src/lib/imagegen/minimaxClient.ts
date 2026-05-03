/**
 * 图像生成 Client — MiniMax image-01
 *
 * 同步接口（无需轮询）：POST /v1/image_generation
 * 文档：https://platform.minimaxi.com/document/image_generation
 */

import 'server-only';

import { logLLMCall } from '@/lib/db/repos';
import type { ImageGenInput, ImageGenResult } from './client';

const BASE_URL =
  process.env.MINIMAX_IMAGEGEN_BASE_URL ??
  'https://api.minimaxi.com/v1/image_generation';
const DEFAULT_MODEL = process.env.MINIMAX_IMAGEGEN_MODEL ?? 'image-01';
const TIMEOUT_MS = 30_000;

const MOCK_RESULT: ImageGenResult = {
  imageUrl: 'https://example.com/mock-card-mx.png',
  rawResponse: { mock: true },
  latencyMs: 0,
  source: 'minimax',
};

function sizeToAspect(size?: ImageGenInput['size']): string {
  // image-01 用 aspect_ratio；统一按 1:1
  return '1:1';
}

export async function generateImageMiniMax(
  input: ImageGenInput,
  companionId?: string,
): Promise<ImageGenResult | null> {
  if (process.env.TEST_LLM_MODE === 'mock') {
    return MOCK_RESULT;
  }

  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) {
    console.error('[imagegen:minimax] MINIMAX_API_KEY not set');
    return null;
  }

  const start = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(BASE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        prompt: input.prompt,
        aspect_ratio: sizeToAspect(input.size),
        n: 1,
        prompt_optimizer: false,
        response_format: 'url',
      }),
      signal: ctrl.signal,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`http ${res.status}: ${text.slice(0, 200)}`);
    }
    const json = (await res.json()) as {
      data?: { image_urls?: string[] };
      base_resp?: { status_code?: number; status_msg?: string };
    };

    const code = json.base_resp?.status_code;
    if (code !== undefined && code !== 0) {
      throw new Error(`base_resp ${code}: ${json.base_resp?.status_msg}`);
    }
    const imageUrl = json.data?.image_urls?.[0];
    const latencyMs = Date.now() - start;

    if (!imageUrl) {
      await logLLMCall({
        companionId,
        callType: 'imagegen',
        model: DEFAULT_MODEL,
        latencyMs,
        success: false,
        failReason: 'no_url',
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

    return { imageUrl, rawResponse: json, latencyMs, source: 'minimax' };
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
    console.error('[imagegen:minimax]', (err as Error)?.message ?? err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
