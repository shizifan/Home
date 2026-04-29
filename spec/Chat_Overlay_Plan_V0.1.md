# 对话历史 Overlay · 实施方案

**项目代号** Home
**配套文档** [PRD V0.5](Home_MVP_PRD_V0.5.md) · [实施计划 V0.1](Home_MVP_Implementation_Plan_V0.1.md)
**版本** V0.1
**状态** 待评审 → 实施
**预计工日** 2.0
**作者** Codegen
**日期** 2026-04-29

---

## 0. 文档定位

针对 P2 阶段暴露的 **UX 漏洞**——主页只显示伙伴最新一句台词，无法回看历史——的专项优化。

采用 **方案 A**：保留主页"房间为主角"的设计，新增一个**全屏可关闭的聊天 overlay**，点对话气泡即可展开看完整时间线。

本方案位于 PRD 已规定的范围**之外**——属于 V0.5 阶段未明确细化的 UX 增强；落地后建议以**附录**形式回写到 PRD V0.6。

---

## 1. 设计目标

### 1.1 必达
- 用户能看到"伙伴说过的所有话"+"自己做过的所有事（拍照/文字/跳过）"，按时间序双向气泡展示。
- 跨 7 天数据均可回看；带 Day 分隔。
- 入口：从主页对话气泡一键展开，可关闭返回。

### 1.2 不做
- 不做即时新增消息推送（onSubmit 完成后下次进入面板才刷新）
- 不做消息删除/编辑
- 不做家长视角的纠正动作入口（家长中心保留，PRD §10.6）
- 不做语音消息、表情、@ 等复杂 IM 能力

### 1.3 与 PRD 的边界
- **保持** PRD §10.2 主页布局（HUD + 房间 + 单气泡 + 底部 4 Tab）不变
- **新增** 在对话气泡上加一个明显的"展开"指示
- **不改** 底部 4 Tab 文案与跳转

---

## 2. 数据模型

### 2.1 数据来源（已就绪）

| 表 | 字段 | 用途 |
|---|------|------|
| `conversations` | role='companion' / day / content / source / created_at | 伙伴所有发言 |
| `memories` | type / photo_url / user_text / day / vision_tags / task_id / created_at | 孩子所有输入 |

不需要新建表。

### 2.2 派生：TimelineItem 类型

```typescript
type TimelineItem =
  | { kind: 'day_break'; day: 1|2|3|4|5|6|7; title: string }
  | { kind: 'companion'; id: string; content: string; source: string; day: number; at: string }
  | { kind: 'child_photo'; id: string; photo_url: string; tags?: string[]; user_text?: string; day: number; at: string }
  | { kind: 'child_text'; id: string; text: string; day: number; at: string }
  | { kind: 'child_skip'; id: string; day: number; at: string };
```

### 2.3 后端合流逻辑（`/api/conversation/timeline`）

```pseudo
1. 拉 conversations where companion_id = $cid order by created_at asc
2. 拉 memories where companion_id = $cid order by created_at asc
3. 双指针归并（按 created_at），插入 day_break 标记
4. 返回数组（不分页；MVP 7 天总量上限 ~30 条，无需分页）
```

**省略**：vision_tags JSON 只取 `objects` 字段拼成"标签摘要"，避免污染前端。

---

## 3. API 设计

### 3.1 GET /api/conversation/timeline

**Query**：`companion_id`（可选；缺省取当前 single-user 的最新 companion）

**Response**：
```json
{
  "companion_display_name": "青青",
  "preset_id": "xiaoqinglong",
  "items": [
    { "kind": "day_break", "day": 1, "title": "搬家日" },
    { "kind": "companion", "id": "...", "content": "今天...有什么新鲜事吗？",
      "source": "preset_open_day1", "day": 1, "at": "2026-04-29T15:27:40.395Z" },
    { "kind": "child_photo", "id": "...", "photo_url": "/uploads/.../小青龙.jpg",
      "tags": ["毛绒玩具", "牛"], "user_text": null, "day": 1, "at": "..." },
    { "kind": "companion", "id": "...", "content": "...你的毛绒牛，看起来很柔软。",
      "source": "pass2", "day": 1, "at": "..." }
  ]
}
```

**Cache**：`Cache-Control: no-store`（数据频繁更新）。

---

## 4. 前端组件结构

```
src/
├── components/
│   └── chat/
│       ├── ChatOverlay.tsx        # 半屏弹层壳 + 关闭手柄 + 滚到底
│       ├── ChatList.tsx           # 时间线渲染 + 跨天分隔
│       ├── BubbleCompanion.tsx    # 左侧伙伴气泡 + 头像
│       ├── BubbleChild.tsx        # 右侧孩子气泡（4 子类）
│       ├── DayBreak.tsx           # 中央分隔线
│       ├── PhotoLightbox.tsx      # 点缩略图全屏预览
│       └── timeFormat.ts          # 跨 30 分钟才显示时间戳的工具
├── lib/api/client.ts              # +getTimeline()
├── stores/uiStore.ts              # overlay 类型加 'chat'
└── app/
    ├── api/conversation/timeline/route.ts
    └── home/page.tsx              # 改：气泡 onTap 打开 chat overlay
```

### 4.1 组件 API

```typescript
<ChatOverlay onClose={() => closeOverlay()} />
  // 内部自己 fetch /api/conversation/timeline；展示 loading / 空态 / 列表

<ChatList items={TimelineItem[]} companionPresetId="..." companionName="..." />
  // 纯展示；自动按 day 分组；自动插入 timestamp（跨 30 分钟）

<BubbleCompanion content source companionPresetId companionName showAvatar at? />
<BubbleChild kind='photo'|'text'|'skip' payload at? />
<DayBreak day title />
<PhotoLightbox url onClose />
```

### 4.2 状态变更

```diff
// stores/uiStore.ts
- export type Overlay = 'task' | 'memory' | 'skip-warning' | null;
+ export type Overlay = 'task' | 'memory' | 'chat' | 'skip-warning' | null;
```

### 4.3 主页改动

```diff
// app/home/page.tsx
- <SpeechBubble text=... by={c.display_name} />
+ <SpeechBubble
+   text=...
+   by={c.display_name}
+   expandable
+   onTap={() => openOverlay('chat')}
+ />

  {overlay === 'task' && task && <TaskOverlay ... />}
+ {overlay === 'chat' && <ChatOverlay onClose={closeOverlay} />}
```

`SpeechBubble` 新增 `expandable` prop：右下角加一个 ↕ 小图标 + 整气泡可点。

---

## 5. 视觉规范

完全沿用 PRD §9.2 的 design token。

### 5.1 Overlay 容器

| 项 | 值 |
|---|---|
| 触发动画 | 从底部上滑 0.3s（同 TaskOverlay） |
| 高度 | 88% 视口 |
| 圆角 | 顶部 24px |
| 背景遮罩 | rgba(44, 44, 42, 0.35) |
| 关闭手柄 | 顶部居中 44×5px 灰色横条（同 sheet 标准） |

### 5.2 气泡

| 角色 | 对齐 | 背景 | 描边 | 文字 |
|------|------|------|------|------|
| 伙伴 (preset) | 左 | `#FFF8EA`（米白）| 1.2px `#5F5E5A` | `#2C2C2A` |
| 伙伴 (pass2) | 左 | 白色 | 1.2px `#5F5E5A` | `#2C2C2A` |
| 伙伴 (fallback) | 左 | 白色 | 虚线描边 + 小注"（它有点累）" | `#5F5E5A` |
| 孩子 · 文字 | 右 | `#FAC775`（暖琥珀浅）| 1px `#A8773D` | `#633806` |
| 孩子 · 照片 | 右 | 同上，含 80×80 缩略图 + 标签 chip | 同上 | 同上 |
| 孩子 · 跳过 | 右 | 透明 | 无描边 | `#888780` 灰色斜体 |

### 5.3 头像

- 仅伙伴一侧显示，不渲染孩子头像
- 头像 = 当前伙伴 `<Companion pose="stand" size={36} />` 直接复用
- 同一连续伙伴气泡组只在最后一个气泡顶端显示一次（节省视觉噪音）

### 5.4 Day 分隔

```
─────  Day 2 · 这是我们家  ─────
```

- 字号 12px / `font-num` / `tracking-[0.16em]`
- 颜色 `#888780`
- 横线 1px `rgba(95,94,90,0.15)` 双侧延伸

### 5.5 时间戳

- 仅在跨 30 分钟时显示一次
- 居中置于两条消息之间
- 字号 11px `#888780`
- 格式：`HH:mm`（同一天内）；跨天由 day_break 接管

### 5.6 照片缩略图

- 缩略图 80×80px，圆角 8px
- 标签 chip：`vision_tags.objects` 前 3 个，背景 `#FFF`，文字 `#5F5E5A`
- 点缩略图 → `PhotoLightbox` 全屏预览（黑色背景 + 居中图 + 右上 ✕）

---

## 6. 交互细节（11 个边界）

| # | 场景 | 处理 |
|---|------|------|
| 1 | 没有任何对话（刚选完伙伴还没开场白）| 显示空态："你和{伙伴}还没说过话呢" |
| 2 | 列表很长（7 天满量约 30+ 条）| 进入时自动滚到底部；提供顶部"回到最新"按钮 |
| 3 | 长文本（孩子 300 字回答）| 默认显示 3 行 + "展开" 链接 |
| 4 | 长台词（理论上不可能，Pass 2 有 50 字截断）| 不处理 |
| 5 | 照片加载失败 | 显示 80×80 灰色框 + "图加载失败" |
| 6 | 同一秒多条消息（理论上不会，但保险）| 按 created_at 升序，同毫秒按 id 排 |
| 7 | 关闭 overlay 时 chat 列表内有未读？ | MVP 不做"未读"概念；关闭即关闭 |
| 8 | 进入 overlay 时正在 fetch | 显示 "整理对话…" loading 文案（< 1s） |
| 9 | fetch 失败 | "暂时拉不到对话历史，再试一次" + 重试按钮 |
| 10 | 用户左右滑动是否切日 | **不做**（避免冲突 sheet 关闭手势）|
| 11 | iOS Safari 输入法弹起 | 不影响（overlay 内不需要输入）|

---

## 7. Task 分解

| ID | Task | 工日 | 依赖 | 输出 |
|----|------|------|------|------|
| C-1 | 后端：`GET /api/conversation/timeline` 合流 + day_break | 0.3 | P2 | API + 测试 fixture |
| C-2 | 前端 API client：`getTimeline()` + 类型 | 0.1 | C-1 | types + fetch |
| C-3 | `timeFormat.ts`：跨 30 分钟时间戳规则 | 0.1 | — | 工具函数 |
| C-4 | `BubbleCompanion` / `BubbleChild` / `DayBreak` 组件 | 0.5 | — | 4 子组件 |
| C-5 | `ChatList` 编排 + 自动滚到底 + 跨天插分隔 | 0.3 | C-3, C-4 | 列表组件 |
| C-6 | `ChatOverlay` 壳 + sheet 动画 + loading/error/empty | 0.3 | C-5 | 顶层组件 |
| C-7 | `PhotoLightbox` 全屏预览 | 0.1 | — | 子组件 |
| C-8 | `SpeechBubble.expandable` + 右下角 ↕ icon | 0.1 | — | 改 SpeechBubble |
| C-9 | `uiStore` 加 'chat' overlay；主页接入 onTap | 0.1 | C-8 | 改 stores + 主页 |
| C-10 | 走查 + 类型 + 跨页验证 | 0.2 | all | 端到端通过 |
| **合计** | | **2.0** | | |

---

## 8. 实施顺序（建议）

1. **后端切片打通**（C-1 → C-2）：API 先就绪，curl 看到合流 JSON
2. **气泡构件**（C-3 → C-4 → C-7）：单独的可视组件，可在 storybook-like 页面预览
3. **列表 + Overlay**（C-5 → C-6）：装配
4. **主页接入**（C-8 → C-9）：改 SpeechBubble + uiStore
5. **走查**（C-10）：清空数据库 → 跑一遍 Day 1 拍照 + 跳过 → 打开 overlay 看效果

---

## 9. 验收清单

- [ ] 后端 `/api/conversation/timeline` 返回包含 `day_break` + 双向交替的有序列表
- [ ] 进入 overlay 时自动滚到底部
- [ ] 伙伴左 / 孩子右气泡视觉清晰区分
- [ ] 拍照气泡内嵌 80×80 缩略图，含 ≤3 个 tag chip
- [ ] 跳过显示为右侧灰色斜体"（今天先过）"
- [ ] 同一伙伴连续多条只显示一次头像
- [ ] 跨日有 "Day N · 主题" 分隔
- [ ] 跨 30 分钟显示一次时间戳
- [ ] 长文本（>3 行）默认折叠，点"展开"完整显示
- [ ] 点照片缩略图全屏预览，可关闭
- [ ] 空态文案合理（首日刚开场前）
- [ ] type-check + production build 0 error
- [ ] iOS Safari + 微信内嵌浏览器实机验证 sheet 滑动正常

---

## 10. 与 PRD 的对齐 + 后续

### 10.1 与 PRD 关系

PRD V0.5 §10.2 主页设计单气泡；本方案 **新增** overlay 不删除单气泡。同时：

- 主页气泡仍然显示**最新一句**伙伴回应（保留 PRD 设计意图）
- overlay 是"看历史"的额外能力，不是主体交互

建议 PRD V0.6 在 §10.2 末尾增加一段"对话历史回看"，作为单气泡的扩展。

### 10.2 后续演进（V0.6+，本计划不做）

| 功能 | 说明 |
|------|------|
| 长按气泡复制文本 | 工程量小，待用户反馈是否需要 |
| 对话搜索 | 7 天范围内全文 grep，找出"妈妈"相关所有对话 |
| 家长视角导出 | 把 timeline 导出为 PDF/图片，作为成长档案 |
| 实时新增 | 当用户在主页提交任务时，overlay 内 SSE 实时增量 |
| 长按消息纠正 | 接到记忆面板纠正流程（"这条记错了"）|

---

## 11. 风险

| 风险 | 等级 | 应对 |
|------|------|------|
| 主页气泡变得"可点"会被误触 | 🟢 低 | 加视觉提示（↕ 图标 + 整气泡 hover/active 反馈）|
| 7 天后历史超长滚动卡顿 | 🟢 低 | MVP 数据量小（< 50 条），不优化 |
| 缩略图加载慢 | 🟡 中 | 用 `<img loading="lazy">` + 缓存头 |
| 跨天连续展示导致主题理解混乱 | 🟢 低 | day_break 明显标识，且每天主题文案已在 §3.1 |

---

## 12. 决议项

| # | 项 | 默认 | 待确认 |
|---|----|------|--------|
| 1 | overlay 高度 | 88% 视口 | 是否需要全屏（100%）？ |
| 2 | 触发方式 | 整气泡可点 | 是否还要在 BottomNav 加快捷入口？ |
| 3 | 孩子头像 | 不显示 | 是否上传孩子头像？默认 N |
| 4 | 长文本默认折叠阈值 | 3 行 | |
| 5 | 时间戳间隔 | 30 分钟 | |
| 6 | 跳过显示文案 | "（今天先过）" | |

如无异议则按默认推进。

---

*V0.1 · 2026-04-29 · 待你确认后开工*
