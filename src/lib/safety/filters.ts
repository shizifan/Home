/**
 * AI 输入 / 输出安全过滤层（PRD §17）
 *
 * 三层防护中，本文件覆盖第 1 层（输入）+ 第 5 层（输出二次校验）。
 * 中间层（Pass1/2 prompt 硬约束）已经在 prompts/shared/hard_constraints.md。
 *
 * 过滤策略：
 *   - 输入：识别危险/暴力/色情/医疗自伤等关键词 → 拒绝（返回友好提示）
 *   - 输出：识别 AI 自我暴露 / 评价家人 / 危险建议 → 用备用文案替换
 */

const INPUT_BLOCKED_PATTERNS: Array<{ test: RegExp; reason: string }> = [
  { test: /自杀|跳楼|割腕|想死/, reason: 'self_harm' },
  { test: /杀.{0,2}(他|她|你|妈|爸)/, reason: 'violence' },
  { test: /色情|做爱|裸|做.{0,1}爱|脱光/, reason: 'sexual' },
  { test: /操(你|他|她)|妈的|傻逼|滚/, reason: 'profanity' },
];

const OUTPUT_BLOCKED_PATTERNS: Array<{ test: RegExp; reason: string }> = [
  // AI 自我暴露
  { test: /作为(?:AI|人工智能|语言模型|程序|机器人)/, reason: 'ai_disclosure' },
  { test: /我是.{0,3}(AI|人工智能|GPT|大模型|程序|机器人)/, reason: 'ai_disclosure' },
  { test: /很高兴(为你|帮你|能够帮)/, reason: 'ai_pleasantry' },
  // 评价家人 / 介入家庭关系
  { test: /(妈妈|爸爸|爷爷|奶奶|外婆|外公).{0,8}(不爱|不好|讨厌|不疼|严厉)/, reason: 'family_judgment' },
  { test: /如果.{0,5}(妈妈|爸爸).{0,8}(不|没).{0,4}(爱|疼|给|理)/, reason: 'family_intervention' },
  // 医疗 / 心理诊断建议
  { test: /(抑郁|焦虑|多动|自闭|心理疾病|精神病)/, reason: 'medical' },
  { test: /建议.{0,5}(看医生|去医院|心理咨询)/, reason: 'medical_advice' },
  // 鼓励危险行为
  { test: /(独自).{0,5}(出去|外出|过马路)/, reason: 'unsafe' },
];

export interface FilterResult {
  ok: boolean;
  reason?: string;
}

/**
 * 检查孩子的文字输入是否安全。
 * 命中 → 返回 { ok: false, reason }
 */
export function filterChildInput(text: string): FilterResult {
  if (!text) return { ok: true };
  for (const { test, reason } of INPUT_BLOCKED_PATTERNS) {
    if (test.test(text)) {
      return { ok: false, reason };
    }
  }
  return { ok: true };
}

/**
 * 检查 LLM 输出是否安全。
 * 命中 → 返回 { ok: false, reason }
 */
export function filterCompanionOutput(text: string): FilterResult {
  if (!text) return { ok: true };
  for (const { test, reason } of OUTPUT_BLOCKED_PATTERNS) {
    if (test.test(text)) {
      return { ok: false, reason };
    }
  }
  return { ok: true };
}

/**
 * 输入被拒绝时给孩子的友好提示
 */
export function getInputRejectionLine(reason: string): string {
  switch (reason) {
    case 'self_harm':
      return '这件事对我来说有点太重了。要不要找一个能帮你的大人聊一聊？';
    case 'violence':
      return '这个我们换个方式说，好吗？';
    case 'sexual':
    case 'profanity':
      return '换种说法告诉我吧，慢慢来。';
    default:
      return '这个我先放一放，下次再说吧。';
  }
}

/**
 * Vision 标签黑名单（PRD §17.2）
 * Vision API 返回的 objects 中包含黑名单词 → 不传给 Pass 1
 */
const VISION_BLOCKED_TAGS = /^(裸体|血|武器|刀|枪|尸体|nude|weapon|blood|knife|gun)$/i;

export function filterVisionTags(tags: { objects: string[] } | null): {
  objects: string[];
} | null {
  if (!tags) return null;
  const filtered = (tags.objects ?? []).filter((t) => !VISION_BLOCKED_TAGS.test(t));
  if (filtered.length < (tags.objects?.length ?? 0)) {
    // 有标签被过滤掉 → 整张图当作"看不清"处理
    return { objects: ['看不清'] };
  }
  return { ...tags, objects: filtered };
}
