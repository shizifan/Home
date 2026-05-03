/**
 * 纸片马里奥风格 Prompt 锁定（V0.6.1 §4.4.2）
 *
 * 工程化锁定：常量管理 + 拼接函数。任何改动需 PR review（设计 + 产品双签）。
 *
 * @see spec/Home_MVP_PRD_V0.6.1.md §4.4.2
 */

export const STYLE_PREFIX = `【风格】
纸片扁平插画风格，Paper Mario 视觉风格。
所有元素扁平化、单层色块、带 1.5-2px 白色描边模拟纸片厚度。
等距视角（isometric），约 30 度俯视。
温暖米黄色背景（#FAEEDA）。
色彩饱和度中等，不要鲜艳荧光色。
没有阴影、没有渐变、没有写实质感、没有 3D 渲染。
所有物品像剪纸一样有清晰的白边。`;

export const STYLE_CONSTRAINTS = `【约束】
不出现真实人物面孔（用纸片简笔人物代替）。
不出现任何文字、logo、品牌。
画面简洁，单一主场景。
不出现恐怖、暴力、血腥、成人暗示元素。`;

/**
 * 拼接最终图像生成 Prompt。
 * @param content 来自 keyword_extract 的 prompt_content（已剔除风格词）
 */
export function buildImagePrompt(content: string): string {
  return `${STYLE_PREFIX}\n\n【内容】\n${content}\n\n${STYLE_CONSTRAINTS}`;
}

/**
 * 风格基准图（参考图）映射（V0.6.1 §4.4.3）
 *
 * P6.1 启动 zero-shot，未提供参考图。
 * P6.6 调优阶段把基准图放入 public/style-references/ 后取消注释。
 */
export const STYLE_REFERENCE_IMAGES: Record<string, string | null> = {
  indoor_room: null,         // /style-references/indoor_room.png
  outdoor_place: null,       // /style-references/outdoor_place.png
  people_with_env: null,     // /style-references/people_with_env.png
  object_focus: null,        // 默认无参考图
};

export function pickReferenceImage(sceneType: keyof typeof STYLE_REFERENCE_IMAGES): string | null {
  return STYLE_REFERENCE_IMAGES[sceneType] ?? null;
}
