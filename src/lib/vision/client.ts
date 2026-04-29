/**
 * Vision API — 阿里 DashScope Qwen-VL
 *
 * OpenAI 兼容协议，baseURL = https://dashscope.aliyuncs.com/compatible-mode/v1
 * 不需要 GroupId，纯 Bearer token 鉴权。
 *
 * 输入：本地文件路径 → base64 → image_url 数据 URI
 * 输出：结构化 VisionTags（PRD §4.3）
 *
 * 失败：返回 null + 调用方走 LLM 备用文案。
 */

import 'server-only';

import OpenAI from 'openai';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { logLLMCall } from '@/lib/db/repos';
import type { VisionTags } from '@/types';

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

const VISION_PROMPT = `你是一个图像识别助手。请分析这张照片，返回严格的 JSON 对象：

{
  "objects": ["最多 6 个主体物体或场景关键词，用简短中文"],
  "scene": "场景描述（如 厨房 / 卧室 / 公园 / 餐桌），1 个中文词",
  "atmosphere": "氛围（如 温馨 / 热闹 / 安静 / 模糊），1 个中文词",
  "time_of_day": "白天 | 夜晚 | 不确定 中的一个"
}

要点：
- 用孩子能听懂的中文（不要英文标签）
- 不要解读情绪、不要评论人物
- 如果照片模糊或看不清，objects 给 ["看不清"]，atmosphere = "模糊"
- 仅输出 JSON，不要其他文字、不要 markdown 代码块`;

export async function analyzeImageFile(
  filePath: string,
  companionId?: string,
): Promise<VisionTags | null> {
  const start = Date.now();
  const model = process.env.DASHSCOPE_VISION_MODEL ?? 'qwen-vl-plus';

  try {
    const buf = await readFile(filePath);
    const base64 = buf.toString('base64');
    const ext = path.extname(filePath).slice(1).toLowerCase() || 'jpeg';
    const dataUri = `data:image/${ext === 'jpg' ? 'jpeg' : ext};base64,${base64}`;

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);

    const completion = await getClient().chat.completions.create(
      {
        model,
        temperature: 0.2,
        max_tokens: 300,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: VISION_PROMPT },
              { type: 'image_url', image_url: { url: dataUri } },
            ],
          },
        ],
      },
      { signal: ctrl.signal },
    );
    clearTimeout(timer);

    const raw = completion.choices?.[0]?.message?.content?.trim() ?? '';
    const latencyMs = Date.now() - start;

    let parsed: VisionTags | null = null;
    try {
      const cleaned = raw
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim();
      // 兜底：抽取首个 { ... }
      const start_ = cleaned.indexOf('{');
      const end_ = cleaned.lastIndexOf('}');
      if (start_ < 0 || end_ <= start_) throw new Error('no json object');
      const obj = JSON.parse(cleaned.slice(start_, end_ + 1));
      if (obj && typeof obj === 'object' && Array.isArray(obj.objects)) {
        parsed = {
          objects: obj.objects.map(String).slice(0, 6),
          scene: obj.scene ? String(obj.scene) : undefined,
          atmosphere: obj.atmosphere ? String(obj.atmosphere) : undefined,
          time_of_day: obj.time_of_day ? String(obj.time_of_day) : undefined,
        };
      }
    } catch {
      parsed = null;
    }

    await logLLMCall({
      companionId,
      callType: 'vision',
      model,
      inputTokens: completion.usage?.prompt_tokens,
      outputTokens: completion.usage?.completion_tokens,
      latencyMs,
      success: parsed != null,
      failReason: parsed ? undefined : 'parse',
    });

    return parsed;
  } catch (err) {
    const latencyMs = Date.now() - start;
    const reason =
      (err as Error)?.name === 'AbortError' ? 'timeout' : 'http';
    await logLLMCall({
      companionId,
      callType: 'vision',
      model,
      latencyMs,
      success: false,
      failReason: reason,
    });
    console.error('[vision]', (err as Error)?.message ?? err);
    return null;
  }
}
