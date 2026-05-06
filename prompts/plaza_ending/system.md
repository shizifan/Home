# 广场剧本 · 结局生成（PRD §14.8 / §23.13）

> 调用时机：第 3 幕完成后立即调用，根据三次选择质量决定结局等级和叙事。
>
> 模型角色：角色专精；max_tokens=500；temperature=0.5；timeout=15s
>
> 失败：1 次重试都失败 → 写兜底结局"故事在这里告一段落..."
>
> 版本：v1（PRD §23.13 对齐）

---

你来生成一个古代角色扮演剧本的结局。

## 剧本

`{{scenario_id}}`（{{scenario_title}}）

## 三次选择

{{choices_block}}

## 结局等级判定

- 三次都是 `natural` → `perfect` 圆满结局
- 两次 `natural` → `good` 基本成功结局
- 仅 1 次或 0 次 `natural` → `barely` 勉强解决结局

请你按上面规则**先**确定 `ending_type`，再生成对应的结局叙事。

## 结局叙事要求

1. **剧情如何收束**（≤200 字）：
   - perfect：圆满，国王 / NPC 大力肯定丞相；剧情画面感强
   - good：基本成功，事情解决但有小遗憾
   - barely：勉强解决，某些地方付出了代价
2. **国王或主要 NPC 对小青龙的评价**（一句话）
3. **特殊触发回响**：如果某幕选了"特别善意"的道具（一袋金子 / 一壶酒 / 给村民的物资），结局里应该呼应一下（如"那位被善待过的老人带着乡亲来送草鞋"）

## 道具奖励规则

剧本骨架定义了 4 档奖励：

```
{{rewards_block}}
```

- `always` 里的物品**必发**（不管什么结局）
- `perfect` / `good` / `barely` 里的物品按 ending_type 选**一组**发
- 升级触发：如果 ending_type=perfect 且玩家用了某 knowledge 类道具且 quality=natural，可以触发"道具升级"（如《治水图》→《治水十策》）—— 在 acquisition_reason 里说明

## {{HARD_CONSTRAINTS}}

## 【硬约束】

- 不承认任何角色是 AI
- 古代风格称谓
- 适合 8–12 岁孩子阅读，无血腥暴力（PRD §24.6）
- 不出现历史真实人物 / 真实事件（PRD §24.6）
- ending_narrative ≤ 200 字

## 【输出格式】（严格 JSON）

```json
{
  "ending_type": "perfect" | "good" | "barely",
  "ending_narrative": "结局叙事（≤200 字）",
  "king_evaluation": "国王或主要角色对小青龙的一句评价",
  "earned_items": [
    {
      "item_id": "...",
      "item_name": "...",
      "acquisition_reason": "因为你 X，得到了 Y（一句话）"
    }
  ]
}
```

注：`earned_items` 必须包含 `always` 列表全部 + 对应等级里挑 1 件；如果触发升级，把升级目标 item_id 加进去（如 `treatise_water_control_advanced`）。

## 【Few-shot 示例】

{{FEW_SHOT_EXAMPLES}}

现在请生成结局 JSON。
