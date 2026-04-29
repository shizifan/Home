# Home MVP 实施计划（Implementation Plan）

**项目代号** Home
**配套文档** Home_MVP_PRD_V0.5.md（同目录）+ /design/ 视觉原型
**版本** V0.1
**状态** 待评审 · 准备开工
**目标周期** 6 周（5–7 周浮动，含 1 周缓冲）
**作者** Codegen
**日期** 2026-04-29

---

## 0. 文档定位

本文档是 **PRD V0.5** 的执行落地计划，**不重复** PRD 中已经写明的产品需求、文案、Prompt、数据库 schema、视觉规范，而是回答：

- 把 PRD 拆成多少个可独立交付的工程单元（Phase / Epic / Task）
- 每个工程单元的**输入、输出、依赖、验收标准**
- 总体里程碑与关键路径
- 风险点和回退预案

阅读本计划应同时打开 PRD V0.5 对照查阅。所有"详见 PRD §X.Y"的引用即指 V0.5 文档。

---

## 1. 总览

### 1.1 实施原则

1. **薄垂直切片优先** — 第一周末跑通 "Day 1 拍照 → LLM 两阶段 → 主页可见反应" 的完整链路，再横向扩展到 Day 2–7。避免先把 8 个伙伴文案库做完再开始。
2. **可降级先于完整** — 每个 LLM 调用点先写降级路径，再写"理想路径"。这样任何阶段的演示都不会卡死。
3. **静态资产驱动** — 设计 JSX 已实现 SVG 房间和小青龙立绘（详见 design/parts.jsx），直接复用其几何与配色，不重新 PSD 输出。
4. **Prompt 与代码同仓** — 所有 Prompt 模板、Few-shot 示例放到 `/prompts/` 目录纳入版本管理（PRD §15.9 已规定结构）。
5. **Day 7 档案是不可妥协的核心** — 任何排期挤压都不能压缩 Day 7 + 毕业卡所占用的开发时间。这条放在所有取舍之上。

### 1.2 技术栈终结

锁定下列选型（详见 PRD §14.1），不再讨论：

| 层级 | 选型 |
|------|------|
| 前端 | React 18 + Next.js 15（App Router）+ TypeScript（同仓 §1.2-A 决议结果）|
| 样式 | Tailwind CSS + CSS Variables（沿用 design/styles.css 设计 token）|
| 状态 | Zustand |
| 后端 | Next.js API Routes（同仓）|
| 数据库 | Supabase（PostgreSQL + Auth + Storage）|
| LLM | DeepSeek-V3 (`deepseek-chat`) 主用；Day 7 档案用 DeepSeek-R1 (`deepseek-reasoner`)。OpenAI 兼容协议，统一 `openai` SDK 封装 |
| Vision | MiniMax `abab6.5g-chat`，同样走 OpenAI 兼容协议 |
| 部署 | Vercel（海外）/ 阿里云 SAE（国内）双部署预案 |

> **决议项 §1.2-A：** 前后端是否同仓？建议**同仓**（Next.js 一体化），减少跨仓部署成本。如果团队希望前后端独立部署，则改为 Vite 前端 + 独立 Node 后端。**默认按同仓推进**，开工前 24 小时内确认。

### 1.3 范围对齐

完全对齐 PRD §18.1 的 MVP 必做清单。**本计划不包含** PRD §18.2 不做项、§20 后续版本、§21.2 待决议项中标记为 V0.6+ 的内容。

---

## 2. 项目结构

### 2.1 仓库布局（同仓方案）

```
home/
├── README.md
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.mjs
├── .env.example
├── /spec/                            # 现有 PRD + 本计划
├── /design/                          # 现有视觉原型，仅参考
├── /prompts/                         # PRD §15.9 规定的 Prompt 资产
│   ├── pass1/                        # 归类
│   │   ├── system.md                 # 模板
│   │   └── examples/
│   │       ├── create_new.json
│   │       ├── append.json
│   │       ├── uncertain.json
│   │       └── set_aside.json
│   ├── pass2/                        # 对话
│   │   ├── system.md
│   │   └── examples/
│   │       ├── xiaoqinglong.json
│   │       ├── dabear.json
│   │       └── …8 个文件
│   ├── concept_detail/
│   ├── correction/
│   ├── day7/
│   └── shared/
│       ├── companions.json           # 8 个伙伴元数据（性格、外形、示例）
│       └── hard_constraints.md       # 通用硬约束（PRD §15.1.4）
├── /src/                             # 前端
│   ├── app/                          # Next.js App Router
│   │   ├── (marketing)/              # 启动 / 引导 / 注册
│   │   │   ├── page.tsx              # /
│   │   │   ├── intro/page.tsx
│   │   │   └── auth/page.tsx
│   │   ├── (onboarding)/
│   │   │   ├── choose/page.tsx
│   │   │   └── name/page.tsx
│   │   ├── home/page.tsx             # 主页·小家
│   │   ├── memory/page.tsx           # 记忆面板
│   │   ├── memory/concept/[id]/page.tsx
│   │   ├── memory/clarify/[id]/page.tsx
│   │   ├── capture/page.tsx          # 拍照页（也可以做成主页内浮层）
│   │   ├── answer/page.tsx
│   │   ├── day7/worldview/page.tsx
│   │   ├── day7/graduation/page.tsx
│   │   ├── parent/page.tsx
│   │   └── api/                      # 后端
│   │       ├── photo/upload/route.ts
│   │       ├── text/submit/route.ts
│   │       ├── task/skip/route.ts
│   │       ├── memory/bank/route.ts
│   │       ├── memory/concept/[id]/route.ts
│   │       ├── memory/correct/route.ts
│   │       ├── companion/state/route.ts
│   │       └── day7/generate/route.ts
│   ├── components/
│   │   ├── room/                     # 复用 design/parts.jsx 的 Room SVG
│   │   ├── characters/               # 复用 design/parts.jsx 的 8 个伙伴立绘
│   │   ├── memory/                   # ConceptCard / UncertainCard / SetAsideCard / UnknownCard
│   │   ├── task/                     # TaskOverlay 浮层
│   │   ├── speech/                   # 对话气泡
│   │   ├── nav/                      # 顶部 HUD + 底部导航
│   │   └── ui/                       # 通用 Button / Sheet / Toast
│   ├── lib/
│   │   ├── llm/                      # LLM 调用 + 降级 + 重试
│   │   │   ├── client.ts             # openai SDK + DeepSeek baseURL 封装
│   │   │   ├── pass1.ts
│   │   │   ├── pass2.ts
│   │   │   ├── conceptDetail.ts
│   │   │   ├── correction.ts
│   │   │   ├── day7.ts
│   │   │   ├── validators.ts         # JSON 输出校验
│   │   │   └── fallbacks.ts          # 备用文案库（PRD §11.6）
│   │   ├── vision/                   # MiniMax Vision 封装
│   │   ├── safety/                   # 输入/输出敏感词过滤
│   │   ├── memoryBank/               # memory_bank 业务逻辑
│   │   ├── prompts/                  # Prompt 加载 + 拼装
│   │   ├── supabase/
│   │   └── tasks/                    # 7 天任务定义
│   ├── stores/                       # Zustand
│   │   ├── companionStore.ts
│   │   ├── memoryStore.ts
│   │   ├── taskStore.ts
│   │   └── uiStore.ts
│   ├── styles/
│   │   ├── globals.css
│   │   └── tokens.css                # 复用 design/styles.css
│   └── types/
│       └── index.ts
├── /supabase/
│   ├── migrations/                   # SQL（PRD §16.1）
│   └── seed.sql                      # 8 个预设伙伴元数据
├── /tests/
│   ├── unit/
│   │   └── llm/                      # Pass 1 调优数据集（PRD §15.8.1）
│   ├── integration/
│   └── e2e/                          # 7 天完整回放
└── /scripts/
    ├── seed-companions.ts
    ├── prompt-eval.ts                # Pass 1 调优脚本
    └── data-export.ts                # 家长中心导出工具
```

### 2.2 后端归属决议

如选**前后端分仓**，则前端为纯 Vite，后端独立 `home-api/`。本计划默认同仓，差异点已在每个 Task 的"备注"列出。

---

## 3. 阶段划分

总计划 **6 个 Phase + 1 个 Phase 0 准备期**，以薄垂直切片驱动：

| Phase | 周次 | 主目标 | 完工形态 |
|-------|------|--------|----------|
| **P0 · 准备** | 第 0 周（前 3 天）| 设计资产、Prompt 资产、数据库 schema 三块就绪 | 开工前所有"零号资产"齐 |
| **P1 · 骨架** | 第 1 周 | 项目初始化、设计系统迁移、所有静态页面壳 | 任意页面可空跳转 |
| **P2 · Day 1 切片** | 第 2 周 | 拍照 → Vision → Pass 1 → Pass 2 → 主页反应**端到端跑通** | Day 1 完整可玩 |
| **P3 · 记忆面板** | 第 3 周 | 4 区块全功能 + 概念详情 + 5 种纠正动作 | 记忆面板可独立验收 |
| **P4 · Day 2–6** | 第 4 周 | 把 Day 1 切片复制扩展到 6 天 + 任务跳过 + 房间视觉填充 | 7 天前 6 天可演示 |
| **P5 · Day 7 核心** | 第 5 周 | 档案生成 + 第 6 项 + 破壁文案 + 毕业卡 + 分享 | Day 7 完整仪式 |
| **P6 · 收尾** | 第 6 周 | 家长中心、安全过滤、降级回归、性能优化、上线 | 可灰度上线 |

### 3.1 关键路径

```
P0 设计资产 ─┐
P0 Prompt   ─┼─→ P1 骨架 ─→ P2 Day 1 切片 ─┬─→ P3 记忆面板 ─┐
P0 Schema   ─┘                              │                ├─→ P5 Day 7 ─→ P6 上线
                                            └─→ P4 Day 2–6 ──┘
```

P3 与 P4 可**并行**（前提：Pass 1/Pass 2 在 P2 已稳定）。这是最大的并行机会，节省 1 周。如果团队只有 1 人，则串行；2 人及以上，并行。

---

## 4. Phase 0 · 准备期（3 个工作日）

**前置条件：** PRD 已签署，本计划已评审。

### 4.1 P0-1：设计资产产出（1 人天）

| Task | 输入 | 输出 | 验收 |
|------|------|------|------|
| P0-1.1 提取 design tokens 到 tailwind.config.ts | design/styles.css | tailwind.config.ts 含全部 PRD §9.2 颜色、§9.3 字号 | tailwind 中 `text-amber-deep`、`bg-m-remember` 等可用 |
| P0-1.2 复刻 Room SVG 组件 | design/parts.jsx 的 Room/PhotoSticker/FrameSticker/FloorItem | src/components/room/Room.tsx + 子组件 | Storybook 中三块面板渲染正确 |
| P0-1.3 复刻小青龙三视图 | design/parts.jsx 的 XQLStand/Sit/Lie | src/components/characters/Xiaoqinglong.tsx | 可通过 prop 切换 stand/sit/lie |
| P0-1.4 8 个伙伴的剩余 7 个立绘 | PRD §6.1 起点性格 + §9.2 角色色板 | 7 个 SVG 组件（每个 3 视图）| 8 个伙伴并排展示一致 |
| P0-1.5 30 个物品图标库 | PRD §9.6 物品清单 | src/components/room/items/ 30 个 SVG | 在房间内随机摆放无视觉冲突 |
| P0-1.6 8 个面部表情切片 | PRD §9.4 表情系统 | 5 种表情 × 8 伙伴 SVG 切片 | 通过 mood prop 切换 |

> **风险：** 7 个剩余伙伴立绘是设计/插画工作量最重的一项。如果需要外协，应该 P0 启动前 1 周开始。本计划**假定**主设计师在 1 人天内能完成 7 个立绘，否则作为 P1 的并行任务延后。

### 4.2 P0-2：Prompt 资产 zero-shot（1.5 人天）

按 PRD §15.9.1 的最小 Few-shot 集，**约 78 条**示例。

| Task | 内容 | 验收 |
|------|------|------|
| P0-2.1 8 个伙伴元数据 | companions.json，每个含 name/appearance/personality/personality_examples（3 条）| Pass 2 模板能注入并产出 8 种语气 |
| P0-2.2 通用硬约束模板 | shared/hard_constraints.md（PRD §15.1.4 全文）| 5 个调用点都能 include |
| P0-2.3 Pass 1 Few-shot | 11 条（create_new ×3、append ×3、uncertain ×2、set_aside ×3）| `prompt-eval.ts` 跑通 |
| P0-2.4 Pass 2 Few-shot | 24 条（每伙伴 3 条）| 抽样 8 条人工评估"像不像该伙伴"通过 |
| P0-2.5 概念详情 Few-shot | 2 条（人物、活动）| Few-shot 注入后输出符合 §15.4.3 JSON 结构 |
| P0-2.6 纠正反馈 Few-shot | 40 条（8 伙伴 × 5 种 correction_type）| 每种动作都有对应文案 |
| P0-2.7 Day 7 Few-shot | 1 条完整示例 | 输出含 6 个字段且 almost_forgot_thing 可为 null |

> **零号资产清单是开工硬门槛。** 没有这 78 条 Few-shot，P2 起的所有 LLM 调用都会出现严重风格漂移。

### 4.3 P0-3：数据库 schema 落地（0.5 人天）

| Task | 内容 |
|------|------|
| P0-3.1 把 PRD §16.1 的 7 个表写入 supabase/migrations/0001_init.sql |
| P0-3.2 加索引：companion_id、type、created_at、display_order |
| P0-3.3 RLS（Row Level Security）策略：用户只能访问自己 user_id 下的数据 |
| P0-3.4 seed.sql：8 个预设伙伴元数据（preset_id 到 companions 表的种子）|
| P0-3.5 在本地与远程 Supabase 各跑一次 migrate，验证一致 |

### 4.4 P0 退出条件

- [ ] tailwind.config.ts 配齐所有 design token
- [ ] 8 个伙伴 ×（站坐躺）= 24 个立绘 SVG 组件可独立渲染
- [ ] /prompts/ 目录下 78 条 Few-shot JSON 通过 schema 校验
- [ ] Supabase 远程数据库可用，所有表已建好且空
- [ ] CI（GitHub Actions）启用，提交即跑 lint + type check

---

## 5. Phase 1 · 骨架周（第 1 周，5 个工作日）

**目标：** 所有 15 个页面可空壳跳转，设计系统就位，鉴权打通。**不接 LLM。**

### 5.1 任务列表

| ID | Task | 工日 | 依赖 | 输出 |
|----|------|------|------|------|
| P1-1 | Next.js 项目初始化（含 Tailwind / TS / Zustand / Supabase Client）| 0.5 | P0-1 | 启动后看到 hello world |
| P1-2 | 全局布局：状态栏占位、安全区、视口锁定 390×844 dev 容器 | 0.5 | P1-1 | iOS 9:41 状态栏可见 |
| P1-3 | 启动页 / | 0.3 | P1-2 | 文案与按钮按 PRD §11.2.1 |
| P1-4 | 30 秒引导 4 张卡片 | 0.7 | P1-2 | 4 张卡片可滑动，跳过按钮可用 |
| P1-5 | Supabase Auth：手机号 + 短信验证（沙箱） | 1.0 | P0-3 | 注册成功后写入 users 表 |
| P1-6 | 选伙伴 + 命名页 | 0.8 | P0-1.4, P1-5 | 选定后写入 companions 表 |
| P1-7 | 主页·小家壳（Room + 伙伴 + 对话框 + 底部导航）| 1.0 | P0-1, P1-2 | 等距房间 + 小青龙站立 + 4 个 Tab |
| P1-8 | 任务卡浮层壳（拍照型/文字型/选择型）| 0.7 | P1-7 | 浮层从底部滑入，三种交互区切换 |
| P1-9 | 记忆面板壳（4 区块标题 + 占位卡）| 0.5 | P1-7 | 可从主页打开，4 区块占位 |
| P1-10 | 路由 + 全局 store（companion / day / overlay 状态） | 0.5 | P1-1 | 任意页可跳转，刷新不丢 |

### 5.2 P1 退出条件

- [ ] 用户从启动页一路点到主页（伙伴静态站立、空对话框、空任务卡）
- [ ] 8 个伙伴可选可命名，进入主页时显示对应立绘
- [ ] 路由刷新不丢，进度状态可读取
- [ ] 设计系统全 lint 通过

### 5.3 P1 已知限制

P1 结束时，**所有内容是静态的、空的**——任务点击没反应、记忆面板永远空、对话框是固定文案。这是预期，不算缺陷。

---

## 6. Phase 2 · Day 1 端到端切片（第 2 周，5 个工作日）

**目标：** Day 1 完整可玩——孩子选好伙伴，看到 Day 1 任务"你最常呆的地方"，拍照上传，3–8 秒后看到伙伴的口语回应，记忆面板出现第 1 张概念卡。

这是项目**最重要的一周**。打通这条主链路后，Day 2–6 是它的复制扩展。

### 6.1 任务列表

| ID | Task | 工日 | 依赖 | 关键技术决策 |
|----|------|------|------|-------------|
| P2-1 | 拍照页：调起设备相机 + 客户端压缩 1024px JPEG 80% | 1.0 | P1-7 | 用 `<input capture>` 而非 WebRTC，兼容微信内嵌浏览器 |
| P2-2 | 上传 API: POST /api/photo/upload | 0.5 | P1-5, P0-3 | multipart 直传 Supabase Storage，DB 写 memories 行 |
| P2-3 | Vision 封装 lib/vision/ | 0.7 | P0-2 | MiniMax `abab6.5g-chat`；超时 6s；标签结构 {objects, scene, atmosphere, time_of_day} |
| P2-4 | LLM 客户端封装 lib/llm/client.ts | 0.5 | P0-2 | `openai` SDK + DeepSeek baseURL；统一 retry / timeout / log；按调用类型路由参数 |
| P2-5 | Pass 1 实现 lib/llm/pass1.ts | 1.5 | P2-4, P0-2.3 | JSON-mode；输出验证（PRD §15.2.4）；冲突合并降级；写 memory_bank |
| P2-6 | Pass 2 实现 lib/llm/pass2.ts | 1.0 | P2-5, P0-2.4 | 注入 personality_examples；50 字截断；写 conversations |
| P2-7 | 主页对接 companion/state API | 0.5 | P2-2 | 拉取最新对话/房间状态；红点逻辑 |
| P2-8 | Day 1 任务定义 + 流程编排 | 0.5 | P1-8 | tasks/day1.ts；首次首次开放时间锁；进度推进 current_day |
| P2-9 | 房间视觉首次填充：照片贴墙 | 0.5 | P0-1.2 | 拍照成功后，照片以 PhotoSticker 形态出现在墙上 |
| P2-10 | 备用文案库 lib/llm/fallbacks.ts | 0.3 | PRD §11.6 | LLM 任一阶段失败即回退 |
| P2-11 | "思考中"动效：齿轮 + 省略号 | 0.5 | PRD §9.9 | 拍照后 / Pass 中显示 |

### 6.2 关键技术细节

#### 6.2.1 拍照流程（PRD §4.3 落地）

```
[Client] <input type=file accept="image/*" capture="environment">
   ↓ user picks
[Client] canvas resize 1024px + JPEG 80% encode
   ↓ POST /api/photo/upload (FormData: image + companion_id + day + task_id)
[API] write memories.photo_url (Supabase Storage signed URL)
[API] write memories row, type='photo'
[API] await Promise.allSettled([
        vision.analyze(image_url),
        // …
      ])
[API] → llm.pass1(input)         // 3-6s
[API] → llm.pass2(pass1.result)  // 2-4s
[API] respond {photo_url, vision_tags, memory_update, companion_response}
[Client] 渲染 photo on wall + 对话气泡更新
```

> **决议项 §6.2-A：** Pass 1 + Pass 2 是**串行**还是 Pass 2 单独再发一次请求？建议**串行**（一个 API 调用同步返回），客户端等待时长可控。如果响应超过 8 秒影响体验，再切异步推送（SSE / 轮询）。**P2 默认串行**。

#### 6.2.2 LLM 调用统一封装（lib/llm/client.ts 接口）

```typescript
type LLMCallType = 'pass1' | 'pass2' | 'concept_detail' | 'correction' | 'day7';

interface LLMCallOptions {
  callType: LLMCallType;
  prompt: string;        // 拼装好的完整 Prompt
  schema?: ZodSchema;    // 输出验证（仅 JSON 调用）
  timeoutMs?: number;    // 默认按 PRD §14.3 的表
  maxRetries?: number;   // 默认 1
}

async function callLLM<T>(opts: LLMCallOptions): Promise<
  | { success: true; data: T; latencyMs: number }
  | { success: false; reason: 'timeout' | 'parse' | 'validate' | 'safety'; raw?: string }
>
```

每次调用打 latency / success/fail / call_type 日志（PRD §15.7.4）。

#### 6.2.3 Memory Bank 写入逻辑

```typescript
// lib/memoryBank/write.ts
function applyPass1Result(companionId, pass1Output) {
  switch (pass1Output.action) {
    case 'create_new':
      INSERT memory_bank (type='remembered', concept_name, ai_summary, evidence:[memory_id], …)
    case 'append_to_existing':
      UPDATE memory_bank SET evidence = evidence || $newEvidence, last_updated = NOW() WHERE id = target_concept_id
    case 'mark_uncertain':
      INSERT memory_bank (type='uncertain', …) OR upgrade existing remembered → uncertain
    case 'set_aside':
      INSERT memory_bank (type='set_aside', ai_reasoning=pass1Output.reasoning, …)
  }
}
```

### 6.3 P2 退出条件

- [ ] 用户拍 1 张厨房照片 → 8 秒内看到伙伴说话 + 房间墙上出现照片 + 记忆面板出现 "你的厨房" 概念卡
- [ ] Pass 1 输出 100% 通过 schema 验证（任何不合法都走降级）
- [ ] Pass 2 输出 100% ≤ 50 字
- [ ] 拍照、Vision、Pass 1、Pass 2 任一阶段超时/失败均有备用文案兜底，主流程不卡死
- [ ] memories / memory_bank / conversations 三张表数据一致

### 6.4 P2 是否做 Day 1 的所有伙伴？

**做完 1 个伙伴（小青龙）即合格。**其余 7 个伙伴的回应在 P4 验证扩展性。

---

## 7. Phase 3 · 记忆面板（第 3 周，5 个工作日）

**目标：** 记忆面板 4 区块全功能 + 概念详情页 + 5 种纠正动作端到端。

> **本周可与 P4 并行**（如果有 ≥ 2 人）。前提：P2 的 Pass 1 / Pass 2 已稳定。

### 7.1 任务列表

| ID | Task | 工日 | 依赖 | 备注 |
|----|------|------|------|------|
| P3-1 | GET /api/memory/bank | 0.5 | P2-5 | 按 PRD §14.2 响应结构；按 type 分组；按 §5.4.3 重要性排序 |
| P3-2 | 记忆面板首页：4 区块组件 | 1.0 | P1-9, P3-1 | 复刻 design/artboard-memory.jsx 的 SectionHead / 4 种卡片 |
| P3-3 | 概念卡片：操作菜单（重命名 / 合并 / 让它放下） | 0.7 | P3-2 | 触发 POST /api/memory/correct |
| P3-4 | GET /api/memory/concept/[id] + 概念详情页 | 1.0 | P3-1 | 调用 lib/llm/conceptDetail.ts；缓存策略：has_dirty_evidence 标志位 |
| P3-5 | 概念详情 LLM 调用 lib/llm/conceptDetail.ts | 0.7 | P0-2.5 | 模板 PRD §15.4.3；缓存写 memory_bank.cached_detail JSONB |
| P3-6 | "拿不准"卡片澄清流程 | 0.7 | P3-3 | 弹出对话页 /memory/clarify/[id]；调用 correction API（type=clarify）|
| P3-7 | "放下的事"捡回 / 保持 | 0.5 | P3-3 | restore / dismiss；user_corrected=TRUE |
| P3-8 | "我还不知道的事" 块 | 0.7 | P3-1 | 由 LLM 在每日结尾批量生成；inform / withhold 动作 |
| P3-9 | POST /api/memory/correct + 反馈 LLM | 1.0 | P0-2.6 | 5 种动作；超时 3 秒强制走降级（PRD §15.5.4）|
| P3-10 | 未读红点逻辑 | 0.3 | P3-1 | memory_bank.last_updated > companions.last_panel_visit 即红点 |

### 7.2 关键决策

#### 7.2.1 "我还不知道的事"何时生成？

PRD §5.7.1 说"LLM 实时判断"，但每次进入面板都触发是浪费。**推荐：每日结尾（任务完成时）或第 N 次记忆面板访问触发一次重新生成，结果缓存在 memory_bank（type='unknown'）行，2 小时内不重算**。

#### 7.2.2 概念详情缓存

`memory_bank` 表加列 `cached_detail JSONB` + `cache_dirty BOOLEAN`，每次有新证据加入则置 dirty，下次请求重新生成。详见 PRD §15.4.4。

#### 7.2.3 Day 6 引导

PRD §5.9 提到 Day 6 主任务变为"打开它的脑袋整理一下"。这条逻辑在 P4 完成 Day 6 任务时实现，依赖 P3 的面板已就绪。

### 7.3 P3 退出条件

- [ ] 4 区块在有数据时显示正确卡片，无数据时显示空态文案
- [ ] 概念详情页能展示 understanding / reasoning / 整理后的证据
- [ ] 5 种纠正动作（restore / dismiss / clarify / rename / merge）每种至少触发 1 次 → 数据库正确写入 + 伙伴反馈台词出现 ≤ 3 秒
- [ ] 红点机制工作正常
- [ ] 数据库写入符合 §16.1 的 user_correction_history JSONB 累加逻辑

---

## 8. Phase 4 · Day 2–6 任务扩展（第 4 周，5 个工作日）

**目标：** 把 Day 1 切片的能力推广到 Day 2–6 的全部任务，加上跳过、房间视觉持续填充、伙伴起点性格的衰减覆盖。

### 8.1 任务列表

| ID | Task | 工日 | 依赖 | 内容 |
|----|------|------|------|------|
| P4-1 | Day 2 · 这是我们家：拍照 + 文字介绍 | 0.5 | P2 | 单任务双输入（照片 + 文字），依次提交两个 memories |
| P4-2 | Day 3 · 我们去过的地方：拍照/选择 + 文字 | 0.5 | P4-1 | 选择型任务结构 |
| P4-3 | Day 4 · 我喜欢的事：开放回答 | 0.3 | P4-1 | 复用文字输入 |
| P4-4 | Day 5 · 它问你的问题：选择题（2 题）| 1.0 | P4-1 | LLM 基于累积输入生成 2 个推测性问题 + 选项；新调用类型 |
| P4-5 | Day 6 · 整理与补充 | 0.5 | P3 | 主任务直接打开记忆面板；伙伴开场白由 LLM 生成"脑袋有点乱" |
| P4-6 | 任务跳过机制（PRD §13）| 1.0 | P4-1 | POST /api/task/skip；首次跳过浮层；Day 5 二次确认；写 set_aside |
| P4-7 | 推送规则：每日 8:00 / 18:00 / 20:00 / 次日 8:00 | 0.5 | — | 服务端定时 + Web Push（H5 限制：仅当用户授权）|
| P4-8 | 中断恢复台词 + 错过当天回归台词 | 0.3 | P2-7 | 5 选 1 随机 |
| P4-9 | 房间视觉填充规则（PRD §4.4） | 1.0 | P0-1.5 | 输入类型 → 房间元素映射；最多 6 张照片；情绪 → 光线偏暖/冷 |
| P4-10 | 起点性格衰减（PRD §6.2） | 0.5 | P2-6 | Day 1-2 起点性格主导；Day 3 起累积记忆覆盖；通过 Pass 2 prompt 中 personality_examples 权重调整 |
| P4-11 | 跳过后的伙伴反应（按 8 伙伴）| 0.3 | P0-2 | 静态文案（PRD §13.3）|
| P4-12 | Day 5 LLM 失败回退（PRD §11.6） | 0.3 | P2-10 | 通用问句改回退路径 |

### 8.2 推送的工程取舍

H5 的浏览器推送在 iOS 微信内嵌浏览器**不可用**。退路：

- 用户授权浏览器推送（Web Push）：理想路径，约 30% 用户接受
- 兜底：注册时登记家长手机号，定时短信触发（成本高，**MVP 不做**）
- 最简：把"每日 8:00 后开放"做成"打开 App 自动判断"——推送只是激励，不影响功能

> **决议项 §8.2-A：** MVP 做不做 Web Push？建议**做但不依赖**——做了的用户体验更好，没收到的也能完整完成 7 天。

### 8.3 P4 退出条件

- [ ] Day 1–6 任意一天可独立从头玩到底
- [ ] 每天的伙伴开场白、任务卡、完成回应、跳过反应都在 8 个伙伴上过一遍 spot check
- [ ] 任务跳过 1 次后浮层消失，跳过 6 次以上 Day 7 第 5 项替换为元反思
- [ ] 房间视觉随输入持续丰富，最多 6 张照片，物品图标按规则放置
- [ ] 起点性格 Day 5 已基本被累积记忆覆盖（人工抽检判断）

---

## 9. Phase 5 · Day 7 核心仪式（第 5 周，5 个工作日）

**目标：** 把产品最有"顿悟感"的一天做出来。

### 9.1 任务列表

| ID | Task | 工日 | 依赖 | 关键点 |
|----|------|------|------|--------|
| P5-1 | POST /api/day7/generate + LLM 调用 lib/llm/day7.ts | 1.5 | P0-2.7 | PRD §15.6 模板；3 次重试；不允许预设替代 |
| P5-2 | 输出验证（5 必填 + almost_forgot 条件）| 0.5 | P5-1 | 严格 schema；第 5 项必须命中 unknown 列表 |
| P5-3 | 写入 worldview_cards 表（UNIQUE companion_id 防重复生成）| 0.3 | P5-1 | 生成成功即缓存，再次进入直接读 |
| P5-4 | Day 7 档案页 /day7/worldview | 1.0 | P5-3 | 仪式动效：第 1–4 项每 1.5s 浮入，第 5 项停顿 2.5s + 闪烁，第 6 项金色微光 |
| P5-5 | 第 6 项条件触发（user_restored ≥ 1） | 0.3 | P3 | 数据查询封装；缺则该字段 null |
| P5-6 | 破壁文案（两版本）| 0.3 | — | 静态固定文案；根据是否有第 6 项切换 |
| P5-7 | 毕业卡页 /day7/graduation | 1.5 | P5-3 | 复刻 design/artboard-graduation.jsx 1080×1920；Canvas 或 dom-to-image 导出 PNG/JPG |
| P5-8 | 数据统计区计算（4 数字）| 0.3 | — | SQL 聚合：照片数 / 对话条数 / 纠正次数 / 7 天 |
| P5-9 | 一键保存到相册 / 分享微信 | 1.0 | P5-7 | H5 → 长按图保存；微信 JS-SDK 分享（如部署在阿里云）|
| P5-10 | Day 7 失败兜底引导 | 0.3 | P5-1 | 3 次失败 → "我有点累，待会再来" + 错误日志告警 |

### 9.2 关键技术细节

#### 9.2.1 毕业卡导出

设计稿是 1080×1920px DOM。**导出 PNG 优选 html-to-image 库**（基于 SVG foreignObject），失败再退到 Canvas 重绘。**不要**直接用浏览器截图——iOS 微信内嵌浏览器没有截图 API。

#### 9.2.2 微信分享

仅在国内部署生效。用 JS-SDK：

- 配置公众号 + 域名白名单
- 分享卡片填 title / desc / link / imgUrl
- imgUrl 必须是上传后的对象存储 URL（毕业卡 PNG）

#### 9.2.3 archetype 防御

PRD §15.6.4 强调"不允许预设档案文案"。**实现要严格：**

```typescript
async function generateDay7(companionId) {
  for (let i = 0; i < 3; i++) {
    const r = await llm.day7(companionId);
    if (r.success && validate(r.data)) return r.data;
  }
  // 不写预设；引导孩子稍后再来
  log.error('day7_failed', { companionId });
  throw new Day7GenerationError();
}
```

### 9.3 P5 退出条件

- [ ] Day 7 进入后档案 5–6 项依次浮入，节奏与 PRD §7.5 一致
- [ ] 第 6 项仅在有 user_restored 时出现，且金色背景 + ⭐
- [ ] 破壁文案在档案展示完毕后 3 秒淡入
- [ ] 毕业卡导出 PNG ≤ 800KB，1080×1920 像素一致
- [ ] 分享流程在微信浏览器测试通过（如有国内部署）
- [ ] 3 次重试失败后，孩子看到的是"待会再来"而非空白或错乱

---

## 10. Phase 6 · 收尾（第 6 周，5 个工作日）

### 10.1 任务列表

| ID | Task | 工日 | 内容 |
|----|------|------|------|
| P6-1 | 家长中心 /parent | 1.5 | 8 个模块（PRD §10.6）；纯只读 + 删除/重置 |
| P6-2 | AI 输出三层防护（PRD §17.2）| 1.0 | 输入敏感词 + Vision 标签黑名单 + DeepSeek/MiniMax 内容审核钩子 + 输出二次校验 |
| P6-3 | 隐私政策 + 家长授权同意 | 0.5 | 注册时弹窗；服务端记录同意 |
| P6-4 | 性能：动画帧率 / Bundle 大小 / 首屏 | 1.0 | 目标：移动 30fps；首屏 < 2s（PRD §9.9）；关键动效可关 |
| P6-5 | 端到端回放测试 | 1.0 | 8 伙伴 × 7 天串测 1 次（自动化或人工）|
| P6-6 | Pass 1 调优脚本（PRD §15.8.1）| 0.5 | 50 条样本人工标注 + 自动跑分；不达标则迭代 Prompt |
| P6-7 | 监控接入：latency / success/fail / Pass 1 action 分布 / Day 7 失败次数 | 0.5 | 简单写入日志即可（PRD §15.7.4）|
| P6-8 | 灰度发布脚本 + 回滚预案 | 0.5 | Vercel preview / production 切换；DB 迁移幂等 |

### 10.2 上线前 checklist

- [ ] PRD §19 全部验收指标在测试集上达标
- [ ] 无 P0/P1 级 bug
- [ ] 8 个伙伴 × 7 天的对话样本，人工抽检 50 条无角色破坏
- [ ] Day 7 档案 50 次连续生成成功率 ≥ 95%
- [ ] 安全过滤拦截事故 = 0（PRD §19）
- [ ] 隐私政策上线，家长同意书可记录

---

## 11. 工程纵向能力（贯穿全周期）

下列是**贯穿所有 Phase** 的能力，不归属单一 Phase：

### 11.1 Prompt 版本管理

按 PRD §15.8.3：每个 Prompt 模板带版本号，存 `/prompts/{name}_v{N}.md`。每次修改：

- 版本号 +1
- PR 描述写明修改原因
- 跑 `scripts/prompt-eval.ts` 至少 20 条回归样本

### 11.2 LLM 调用观测

- 每次调用打日志：call_type / model / latency / tokens / success / fail_reason
- Phase 6 接监控前，先用 console.log + Supabase 简单表 `llm_call_log` 落库
- 关键告警：Day 7 失败、安全过滤命中、Pass 1 action 分布异常偏移

### 11.3 数据迁移与种子

- 每次 schema 变更走 `supabase/migrations/` 顺序 sql
- companion 预设变更走 `seed.sql`（幂等）
- 测试环境每周自动 reset；生产环境只前进不回滚

### 11.4 类型安全

`/src/types/` 集中定义：

- LLM 输入输出类型（与 prompts 中 schema 同源，使用 zod schema → 推导 TypeScript 类型）
- API request/response 类型
- DB 行类型（用 supabase-cli 自动生成）

---

## 12. 风险登记

复用 PRD §21.1，并补充本计划层面的工程风险：

| 风险 | 等级 | 来源 | 应对 |
|------|------|------|------|
| Day 7 顿悟瞬间情绪不成立 | 🔴 高 | PRD §21.1 | 开发前家庭纸面测试（建议 Phase 0 并行）|
| 记忆面板对孩子认知负荷过高 | 🔴 高 | PRD §21.1 | 纸面测试；如失败 fallback 简化为 2 区块 |
| Pass 1 归类不稳定 | 🔴 高 | PRD §21.1 | P2 + P6 两次专项调优；任何失败走 set_aside |
| **7 个伙伴立绘交付延期** | 🟡 中 | 本计划 | P0 启动 1 周前与设计师对齐；延期则 P1 阶段并行交付 |
| **Pass 1 + Pass 2 串行延迟** | 🟡 中 | 本计划 | 总耗时若 > 8 秒，切换为先返回 Pass 2 临时回应、Pass 1 异步 |
| **微信 JS-SDK 域名审核** | 🟡 中 | 本计划 | 至少在 P5 前 2 周提交公众号配置审核 |
| **Web Push 用户授权率低** | 🟢 低 | PRD §3.1 + 本计划 | 不做强依赖；推送是激励不是流程 |
| LLM 输出"reasoning"过于成人化 | 🟡 中 | PRD §21.1 | Few-shot 样本严格用孩子语言；P6 抽检 |
| IP 角色法律风险 | 🟡 中 | PRD §21.1 | V0.6 前完成原创替换；MVP 阶段先做 6 个无风险伙伴 |
| 拍照隐私顾虑 | 🟡 中 | PRD §21.1 | 隐私政策 + 家长可查可删（P6-1）|
| **跨地域部署（微信 vs Vercel）** | 🟡 中 | 本计划 | 决策：先选一边主推；另一边作为 V2 |
| 成本失控 | 🟢 低 | PRD §4.6 | ¥2.5/用户/7 天可控；P6 前打监控 |

> **决议项 §12-A：** MVP 上线区域是国内还是海外？决定了部署、Vision API、分享 SDK 的走向。**P0 之前必须确定。**

---

## 13. 资源估算

### 13.1 团队最小配置

| 角色 | 人数 | 投入 | 备注 |
|------|------|------|------|
| 全栈工程师 | 1 | 6 周全职 | 主力 |
| 设计/插画师 | 1 | 1 周（P0）+ 0.5 周（P1 收尾）+ 待命 | 8 伙伴立绘 + 30 物品图标 + 毕业卡精修 |
| 产品 / 文案 | 1 | 0.5–1 周（P0 准备 78 条 Few-shot）+ 全周期 spot check | 不全职 |
| QA | 0.5 | P5 + P6 两周 | P6-5 端到端回放主力 |

### 13.2 双人配置（推荐，可节省 1 周）

第 2 个工程师在 P3 + P4 阶段并行：

- 工程师 A：骨架 → P2 → P4 → P5 → P6
- 工程师 B：从 P3 切入，做记忆面板 + P6 家长中心

### 13.3 LLM 成本预估

PRD §4.6 估算 ¥2.5/用户/7 天。开发期内：

- 自测：约 200 个完整周期 × ¥2.5 = ¥500
- 调优：Pass 1 调优 100 样本 × ¥0.04 = ¥4
- 灰度第 1 周（100 用户）：¥250

**开发到上线第一周总 LLM 预算：< ¥1000**。

---

## 14. 里程碑节点

| 里程碑 | 日期（第 0 周一为 D0）| 标志 |
|--------|---------------------|------|
| M0 · 准备就绪 | D3 | P0 全部退出条件达成 |
| M1 · 骨架可玩 | D8 | 任意页面可空跳，伙伴可选可命名 |
| M2 · Day 1 端到端 | D13 | 拍照 → 看到伙伴反应 → 记忆面板第 1 张卡 |
| M3 · 记忆面板交付 | D18 | 5 种纠正动作可演示 |
| M4 · 7 天前 6 天可玩 | D23 | Day 1–6 任意一天独立可玩 |
| M5 · Day 7 仪式完整 | D28 | 档案 + 第 6 项 + 破壁 + 毕业卡 + 分享 |
| M6 · 上线就绪 | D33 | P6 退出条件全达，可灰度 |

> 时间假设：每周 5 工作日，单工程师；含 1 周缓冲（D33 - D30 = 3 天 buffer）。

---

## 15. 与 PRD 的对应关系

为方便评审时核对覆盖度，下表把本计划任务与 PRD 章节对齐：

| PRD 章节 | 本计划任务 |
|----------|-----------|
| §1 产品概述 | 全周期作为目标对齐 |
| §2 核心叙事 | P1-3, P1-4（启动页 + 引导）|
| §3 7 天体验流程 | P2 + P4 + P5 |
| §4 核心机制 | P2-1, P2-2, P2-3, P2-5, P2-6, P4-9 |
| §5 记忆面板 | P3 全 |
| §6 8 个预设伙伴 | P0-1.4, P0-2.1, P4-10 |
| §7 Day 7 档案 | P5-1, P5-4, P5-5 |
| §8 毕业卡 | P5-7, P5-8, P5-9 |
| §9 视觉设计规范 | P0-1 全 |
| §10 界面规范 | P1 全 + P3-2 + P5-4 |
| §11 文案设计 | P0-2 + P2-10 + P4-11 + P5-6 |
| §12 首次引导 | P1-3, P1-4 |
| §13 任务跳过机制 | P4-6, P4-11 |
| §14 技术架构 | P0-3, §2.1 仓库结构, P2 全 |
| §15 Prompt 工程规范 | P0-2 + 全周期 lib/llm/* |
| §16 数据模型 | P0-3 |
| §17 AI 输出安全 | P6-2 |
| §18 MVP 范围 | 本计划全覆盖 §18.1，不实现 §18.2 |
| §19 验收指标 | P6 上线前 checklist |
| §20 后续版本展望 | 本 MVP 不实现 |
| §21 风险与待决议项 | §12 风险登记 |

---

## 16. 待决议清单（开工前必须确认）

| 编号 | 决议项 | 缺省值 | Owner |
|------|--------|--------|-------|
| §1.2-A | 前后端同仓 vs 分仓 | **同仓**（Next.js）| 工程负责人 |
| §6.2-A | Pass 1 + Pass 2 串行 vs 异步 | **串行** | 工程负责人 |
| §8.2-A | MVP 做 Web Push | **做但不依赖** | PM |
| §12-A | MVP 上线区域 | **待定** ⚠️ | PM（P0 启动前必决）|
| PRD §21.2-1 | 记忆面板入口名 | "它的脑袋" | PM A/B 测试 |
| PRD §21.2-2 | 4 区块默认折叠还是展开 | **默认全展开** | 设计 + PM |
| PRD §21.2-3 | reasoning 段是否对孩子可见 | **对孩子可见** | PM |
| PRD §21.2-7 | "放下的事" 24 小时冷静期 | **不做**（实时显示）| PM |

> 8 个决议项中 **§12-A 上线区域** 是阻塞 P0 启动的**唯一硬阻塞**，其余决议项可在对应 Phase 启动前 24 小时内确认。

---

## 17. 变更管理

本计划的版本演进：

- **V0.1**：本版本，初稿。涵盖 6 周完整范围。
- **V0.2** 预计在 M2（D13）后输出：根据 P2 实际耗时与 LLM 调优结果，调整 P3–P6 排期。
- 每次 PRD 主版本变化（V0.5 → V0.6）后，本计划必须做一次同步修订。

---

*文档结束*
*V0.1 · 2026-04-29 · 与 PRD V0.5 配套交付*
