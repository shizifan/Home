# 广场剧本 · 单幕生成（PRD §14 / §23.12）

> 调用时机：孩子在准备页选完 3 道具 → 进剧本第 1 幕 → 选道具 → 调本提示生成第 1 幕产物。
>            第 1 幕完成后第 2 / 3 幕同样调用，每幕注入 previous_acts 摘要。
>
> 模型角色：角色专精；max_tokens=400；temperature=0.6；timeout=12s
>
> 失败：1 次重试都失败 → 写占位"剧情卡了一下，再来一遍？"
>
> 版本：v1（PRD §23.12 对齐）

---

你来生成一个古代角色扮演剧本中的一幕。

## 剧本元信息

- 剧本：`{{scenario_id}}`（{{scenario_title}}）
- 当前是：第 {{act_number}} 幕（共 3 幕）

## 剧本背景

{{scenario_background}}

## 在场角色（含小青龙）

{{roles_block}}

## 前面发生了什么

{{previous_acts_summary}}

## 这一幕的剧情骨架

{{act_skeleton}}

## 孩子刚刚为小青龙选择的道具

- 道具：`{{selected_item_id}}`
- 名称：「{{selected_item_name}}」
- 说明：{{selected_item_description}}

`{{selected_item_id}}` 也可能是字符串 `"none"`，表示孩子选择"不用道具，凭直觉"。

## 你需要生成的内容

为这一幕产生：
1. **scene_narrative** — 这一幕的完整叙事（设定 + 角色对话 + 小青龙的发言 + 收尾）；不超过 200 字
2. **small_blue_dragon_speech** — 抽出小青龙在这一幕的核心台词（一句话，便于卡片高亮）
3. **other_response** — 其他角色（国王 / 武将 / 大臣...）对小青龙台词的反应；一句话
4. **next_act_hook** — 为下一幕埋下的种子；非最终幕（act_number < 3）必填，否则可置空字符串
5. **item_use_quality** — `'natural'` / `'stretched'` / `'skipped'`

## {{HARD_CONSTRAINTS}}

## 【硬约束 · 广场专用】

- 不承认任何角色是 AI、模型、程序
- **优先让孩子选的道具自然出现**：如果剧情和道具能呼应，就让小青龙明显使用它
- **道具实在用不上时**：让小青龙说一句"我本来想拿出 X，但好像和这件事没关系"，然后凭直觉答；item_use_quality 标 `'stretched'`
- 孩子选 `selected_item_id="none"` 时：小青龙凭直觉发言；item_use_quality 标 `'skipped'`
- 全程古代风格的称谓（陛下、臣、诸位、丞相等）
- 适合 8–12 岁孩子阅读，不要太古文，不要血腥暴力（PRD §24.6）
- scene_narrative + 小青龙台词 + 其他角色反应 总共 ≤ 200 字
- 必须给出"对小青龙台词的反应"或"剧情下一步的引子"（next_act_hook，最终幕除外）

## 【item_use_quality 判断标准】

- `natural`：道具和剧情天然呼应，使用感顺畅（如水患剧本里用《治水图》）
- `stretched`：道具能勉强用上，但小青龙需要绕一下（如水患里用《邻国风物志》）
- `skipped`：孩子选了"不用道具"或道具完全用不上（小青龙明确说"我本来想拿出 X，但好像没关系"）

## 【输出格式】（严格 JSON）

```json
{
  "scene_narrative": "这一幕的完整叙事（≤200 字）",
  "small_blue_dragon_speech": "小青龙这一幕的核心台词（一句话）",
  "other_response": "其他主要角色的反应（一句话）",
  "next_act_hook": "为下一幕埋下的种子（最终幕可空字符串）",
  "item_use_quality": "natural" | "stretched" | "skipped"
}
```

## 【Few-shot 示例】

{{FEW_SHOT_EXAMPLES}}

现在请生成本幕的 JSON。
