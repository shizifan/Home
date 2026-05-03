/**
 * 关键词提取 LLM 调用（V0.6.1 §4.5 + Plan §5.5）
 *
 * 输入：孩子的描述文字（来自 ASR 或直接打字）
 * 输出：scene_type / main_subjects / visual_attributes / atmosphere / prompt_content / excluded_details
 *
 * 与 Pass 1 并行触发。失败时返回 null，调用方走"用任务主题作为兜底 prompt_content"。
 */

import 'server-only';

import { callLLM } from './client';
import { KeywordExtractSchema, parseJsonStrict, type KeywordExtractOutput } from './validators';
import { renderPrompt, loadFewShotJSON } from './promptLoader';

interface KeywordExtractInput {
  descriptionText: string;
  taskTopic: string;
}

const FEW_SHOT_FILE = 'keyword_extract/examples.json';

/** 代码层预处理（V0.6.1 §16.2）：去 ASR 噪音、语气词、长度截断 */
const FILLER_WORDS = ['嗯', '啊', '呢', '那个', '就是说', '然后呢', '哎'];
const MAX_LEN = 500;
const TRUNCATE_TO = 300;

export function preprocessDescription(raw: string): string {
  let s = raw.trim();
  // 去语气词（仅去单字/短词，不破坏意思）
  for (const w of FILLER_WORDS) {
    s = s.split(w).join('');
  }
  // 去重复空白
  s = s.replace(/\s+/g, ' ');
  // 长度截断
  if (s.length > MAX_LEN) s = s.slice(0, TRUNCATE_TO);
  return s.trim();
}

export async function runKeywordExtract(
  input: KeywordExtractInput,
  companionId?: string,
): Promise<KeywordExtractOutput | null> {
  const cleaned = preprocessDescription(input.descriptionText);
  if (!cleaned) return null;

  const fewShot = (() => {
    try { return loadFewShotJSON(FEW_SHOT_FILE); } catch { return undefined; }
  })();

  const systemPrompt = renderPrompt(
    'keyword_extract',
    {
      description_text: cleaned,
      task_topic: input.taskTopic,
    },
    fewShot,
  );

  const result = await callLLM<KeywordExtractOutput>({
    callType: 'keyword_extract',
    systemPrompt,
    userPrompt: `请按格式输出 JSON。`,
    parse: (raw) => parseJsonStrict(raw, KeywordExtractSchema),
    expectJson: true,
    companionId,
    promptVersion: 'v1',
  });

  return result.success ? result.data : null;
}

/** 失败兜底：直接用任务主题做最低 prompt_content */
export function keywordExtractFallback(taskTopic: string): KeywordExtractOutput {
  return {
    scene_type: 'object_focus',
    main_subjects: [taskTopic],
    visual_attributes: [],
    atmosphere: '温馨',
    prompt_content: taskTopic,
    excluded_details: [],
  };
}
