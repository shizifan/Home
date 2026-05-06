# Home 实施方案（基于 PRD V1.0.2）

**文档目的**：把 PRD V1.0.2 与当前工程（master @ V0.6.1）的差距拆成可独立交付的阶段，作为后续每周开发的执行依据。
**配套文档**：[Home_MVP_PRD_V1.0.2.md](Home_MVP_PRD_V1.0.2.md)
**版本**：方案 v1（2026-05-05 创建）

---

## 0. 现状基线（V0.6.1 + P1 + P2 + Day 1-7 + P3 + P4 + P5 广场剧本完整闭环）

### 0.1 已完成

| 模块 | 关键产物 |
|---|---|
| 7 天主循环 | 选伙伴 / 命名 / Day 1‑7 任务流转 / Day 7 档案 / 毕业卡 |
| 30 秒引导 | `/intro` 4 张卡片 + 横向滑入 0.4s 动效 + 跳过 + 设置中"重看引导" |
| 描述卡片管线 | `src/lib/orchestrate/processDescribe.ts`：关键词提取 → 双源图像生成（DashScope + MiniMax 并行）→ 风格审核 → Pass1 归类 → Pass2 回应 |
| 描述前端 6 页 | `/describe/{voice,text,confirm-text,generating,confirm-card,revise}` |
| 记忆面板 | `/memory`、`/memory/concept/[id]`、`/memory/clarify/[id]` + 4 区块 + restore/dismiss/clarify/rename/merge/inform/withhold |
| 语音/ASR | `VoiceRecorder.tsx` + DashScope Paraformer 流式识别 |
| 自由聊天 | `/api/chat/ask` + `freeChat.ts`（V0.6.1 新增） |
| Day 5 双选择题 | Q1 → Q2 基于 Q1+答案动态生成（PRD §5.6） |
| 跳过机制 | 三档浮层（首次 / Day 5 / Day 6 二选一）+ 8 伙伴预设跳过台词短路 LLM + skip 写 set_aside（PRD §16.4 模板） |
| LLM 降级链 | 7 调用点全部对齐 PRD §25.2，[client.ts](src/lib/llm/client.ts) 顶部有总览注释 |
| 家长中心 | `/parent` 6 Tab（概览/历史/记忆/纠正/Day7/设置）+ 算术题软门槛（PRD §20.14）+ Overview 卡片 gallery + LLM 绩效页 `/parent/monitor` |
| 8 个伙伴预设 | `prompts/shared/companions.json` + `prompts/shared/fallbacks.json::skip_response_by_companion` 全 8 条 |
| 数据库 | MySQL 8 + 3 个迁移；`users / companions / companion_presets / memories / memory_bank / cards / conversations / worldview_cards / llm_call_log` |
| LLM 适配 | `src/lib/llm/{client,pass1,pass2,day5Questions,day7,keywordExtract,styleAudit,conceptDetail,correction,unknownConcepts,freeChat,fallbacks,validators,promptLoader}.ts` |
| Few-shot 数据 | Pass1 11 + Pass2 24 + 概念详情 2 + 纠正 24 + Day7 1 = 62 条（达 PRD §23.15 最小集）|
| E2E 基建 | Playwright 配置 + `tests/e2e/00_smoke.spec.ts` 3 个用例（启动→引导→选伙伴 / 4 卡推进 / 跳过引导）|
| TaskDef.theme | 新增字段，串起跳过 set_aside 的 concept_name |
| 已删除 | V0.5 拍照流程 `/api/photo/upload` + `client.ts::submitPhoto` |
| 修复 | `ws` / `@types/ws` 依赖（V0.6.1 ASR client 漏装）|
| **P2 驿站基础** | `/station` 地图 + 朋友家完整闭环（4 目的 / 4 系统预设伙伴 / 二手知识 / 等你一天 greeting）|
| 数据库（P2） | 迁移 0004：`trips` 表 + `companions.last_active_at/graduated_at` 写入 + `memory_bank.source_type/source_companion_id` |
| 出行 API | `POST /api/station/depart`（fire-and-forget）+ `GET /api/station/trip/[id]`（轮询）+ `POST /api/station/memory/import`（二手知识入库）+ `GET /api/station/status`（解锁/限流）|
| LLM 调用 | 新增 `visit` / `opening_line` callType；`prompts/visit/` + `prompts/opening_line/` |
| db:migrate 修复 | 旧 script 只跑 0001，已改为按序 cat 全部迁移；0004 改用 stored procedure 实现 idempotent |
| **Day 1-7 PRD 全量对齐** | 任务文案对齐 §5.6/§18.3；Day 5 选项语义改"是/不是/一半一半"；Day 2-6 LLM 生成开场白；Day 4 语音输入；Day 6 进面板做纠正才算完成；Day 7 直接进 worldview 看完即完成；Day 7 档案对跳过差异化（§9.4）；主页 missed_day/session_resume/has_pending_clarifications/should_hint_brain_panel 四档 greeting；TranscriptionConfirm < 10 字温和追问 |
| 新 API | `POST /api/task/complete`（Day 6/7 任务完成的非跳过路径）|
| 新 TaskKind | `memory_correct`（Day 6）+ `worldview_view`（Day 7）替代旧 `memory_review` |
| **P3 学校** | `/station/school/{prepare,question}` + `/station/report/school` + 40 题系统题库 + 20 条教学时刻 + 班级轮换（visitor 必入 + 1 系统预设 + 2-3 主角） |
| LLM 调用 | 加 `school` callType；`prompts/school/{system.md,examples.json}` 4 目的 Few-shot |
| 出题安全 | depart route ask_my_question 分支前置 `filterChildInput`，触发返回"这个问题我不太好传达..." |
| 教育张力 | "小青龙不会答"分支：visitor 答案含"不知道"等关键词 → 课堂回放底部"现在告诉它"按钮跳记忆面板（PRD §13.6）|
| 拜访池 | 12 只（4 系统预设 + 8 主角"另一个孩子"版），visit/school 共用；visitor 自己排除 |
| **P4 行囊 + 广场基础** | 迁移 0005（inventory_items + plaza_plays）+ 27 件道具池 + 5 剧本骨架 + 新手礼包逻辑 |
| 行囊系统 | `/inventory` + `/inventory/[id]` + 4 类分组 + 适用剧本标签 + 来源记录 |
| 广场准备 | `/station/plaza/prepare`：今日剧本（按哈希 + 排除最近 2 次）+ 角色分配 + 选 3 道具（适用项 ● 高亮）|
| 主页变化 | BottomNav 玩过 1 次广场后多"行囊"第 5 Tab；state API 加 `has_played_plaza` 字段 |
| **关键说明** | P4 完成的是行囊基础与广场入口；剧本进行流程（3 幕 + 结局 + 道具奖励）留给 P5 |
| **P5 广场剧本** | 5 剧本完整 3 幕 + 结局 + 奖励落库 + 升级触发；剧本进行页 `/station/plaza/play/[id]/act/[n]` + 结局页 `/ending`；占位插画 SVG（P7 替换真资产）|
| LLM | 加 `plaza_act` + `plaza_ending` callType + 5 剧本各 1 条 Few-shot；act 模式 max=500/temp=0.6/12s，ending 模式 max=600/temp=0.5/15s |
| 道具升级 | rewardEngine 检测 perfect + natural + upgrade_to → 自动把基础版替换升级版（如《治水图》→《治水十策》）|
| 复玩台词 | 第 2 次"这次试试不一样的道具？"/ 第 3 次"我每次都能想出不同的办法"（PRD §14.5.3）|

### 0.2 缺口（按 PRD V1.0.2 对照，P1 收口后）

| 模块 | 状态 |
|---|---|
| Day 4 语音输入（PRD §5.6 / §7.11） | 当前文字 only — **已挪 P7‑T8** |
| 整天没打开"等了你一天"（PRD §16.3 末段） | 未实现 — **schema + greeting 已并入 P2‑T1 / P2‑T8** |
| 驿站地图 / 朋友家 / 学校 / 广场 | 全部 0%（`src/components/station/` 为空目录）— P2-P5 |
| 行囊系统（PRD §14.3） | 0% — P4 |
| 道具池 / 5 剧本 / 系统题库 / 二手知识 | 数据资产与代码均缺失 — P3-P5 |
| 临时上线（昵称软隔离 / `/admin` 看板 / IP 限流） | 0% — P6 |
| 阿里云生产部署 / Redis / OSS / 监控 | 0% — P6 |
| IP 角色替换（琳娜贝尔、藤藤蛇） | 未替换 — P7 |
| 朋友家 / 学校 / 广场 few-shot 示例 | 0 条 — P2/P3/P5 |

### 0.3 关键约束

1. **测试策略**：不做视觉回归，E2E 仅验证流程节点完整性。
2. **DB**：继续使用 MySQL 8（PRD V1.0.1/V1.0.2 已确定，弃用 PG / Supabase）。
3. **LLM 适配**：业务代码按"模型角色"调用，不绑定具体厂商；映射在 `src/lib/llm/client.ts` 内。
4. **开发节奏**：每阶段独立可交付，每阶段末做 1 次小范围真实用户 Demo。

---

## 1. 总体策略

1. **先稳后扩**：先收口主流程的引导、家长中心、降级路径（P1），再扩驿站。
2. **解锁路径决定阶段顺序**：朋友家 → 学校 → 广场，与 PRD §11.3 解锁条件一致。
3. **代码与资产并行**：视觉资产、剧本骨架、Few‑shot 与代码同期推进。
4. **临时上线提前**：昵称软隔离 + `/admin?key=` 看板可在驿站完成前上线邀测。
5. **模型分档**：所有新增 LLM 调用必须显式声明模型角色（轻量 / 主力 / 角色专精 / 多模态视觉）。

---

## 2. 阶段总览

| 阶段 | 主题 | 估时 | 交付里程碑 |
|---|---|---|---|
| **P1** | 主循环收口 & 稳定化 | ~1 周 | 邀请朋友试用的 7 天主流程稳定版 |
| **P2** | 驿站基础 + 朋友家 | ~1 周 | 毕业用户可"出门"完成 4 种目的拜访 |
| **P3** | 学校 | ~4–5 天 | 拜访 2 次后解锁，体验"同题不同答" |
| **P4** | 行囊 + 广场基础 | ~1 周 | 上学 1 次后解锁广场入口；行囊查看 |
| **P5** | 广场剧本进行流程 | ~1 周 | 5 剧本 × 3 幕 + 结局 + 道具奖励 |
| **P6** | 临时上线 + 阿里云部署 | ~4–5 天 | 5–10 个真实用户在公网试用 |
| **P7** | 验收 / 打磨 / 资产收口 | ~1 周 | 达到 PRD §28 验收指标 |

总周期：**串行约 6–7 周**，与 PRD §26 的 7 周节奏一致。

---

## 3. 阶段详细方案

### P1 · 主循环收口 & 稳定化

#### P1.1 目标

把 V0.6.1 的"7 天主流程已通"升级为"边角清晰、降级齐全、可邀请试用"的稳定版本，作为后续所有阶段的基线。

#### P1.2 任务清单

**P1‑T1 · 30 秒引导落实**（PRD §17.2）
- 替换 `src/app/intro/page.tsx` 的 Stub 为 4 张引导卡片
- 横向滑入动效 0.4s，右上角"跳过引导"
- 设置中保留"重看引导"入口
- 仅首次启动展示，状态写 localStorage
- **产物**：`src/app/intro/IntroCarousel.tsx`、`src/app/intro/page.tsx` 重写

**P1‑T2 · 家长中心实装**（PRD §20.13、§20.14）
- ✅ 审计现状：`/parent/page.tsx` 已 524 行成熟实现，6 个 Tab（概览/历史/记忆/纠正/Day7/设置）+ `/parent/monitor` LLM 绩效页
- ✅ PRD §20.13 七模块对应：
  - 进度概览 → 概览 Tab
  - 内容回顾（孩子说话）→ 历史 Tab（ChatList 渲染 child_text/child_photo/child_skip）
  - 伙伴回应 → 历史 Tab（同上，含 companion 行）
  - 记忆面板查看 → 记忆 Tab（4 区块只读）
  - 纠正历史 → 纠正 Tab（user_correction_history 展开）
  - 第 7 天档案 → 档案 Tab
  - 删除 / 重置 → 设置 Tab（带二次确认）
- ✅ **新增**：算术题软门槛（PRD §20.14）— `_guard.tsx`，sessionStorage 缓存通过状态，答错换题
- ✅ **新增**：设置 Tab "重看引导"按钮（用 `useCompanionStore.resetIntro()` + 跳 `/intro`）
- ✅ **新增**：Overview Tab 卡片 mini gallery（V0.6.1 描述卡片家长可见）
- 出门记录 / 行囊 → P2 / P4 阶段做
- **产物**：
  - 新增 `src/app/parent/_guard.tsx`
  - 改 `src/app/parent/page.tsx`（包 ParentGuard、SettingsTab 加重看引导、OverviewTab 加卡片 gallery）

**P1‑T3 · Day 4 / Day 5 流程完整化**
- ✅ Day 5 双选择题：Q1 → 孩子答 → 基于 Q1+答案动态生成 Q2（PRD §5.6）
- ✅ Day 5 跳过的特殊二选一提示（在 T4 完成）
- ✅ Day 5 API 拆为 GET（Q1）+ POST（Q2，需 q1+a1）；客户端 ChoiceFlow 重写为两阶段状态机
- ✅ `seed-graduate.ts` 跟进新接口
- ⏸ **T3‑followup → 已挪至 P7 打磨阶段**：Day 4 语音输入支持（PRD §5.6 / §7.11 "语音/文字" 双模式）— 当前仅文字。涉及 UI 改动需小朋友实测调优，与 P7 用户测试合并执行
- **产物**：
  - 改 `src/lib/llm/day5Questions.ts`（拆 runDay5Q1 / runDay5Q2 + 新 prompt）
  - 改 `src/app/api/task/day5-questions/route.ts`（GET/POST 双模式）
  - 改 `src/lib/api/client.ts`（`getDay5Q1` / `getDay5Q2`）
  - 改 `src/components/task/TaskOverlay.tsx`（ChoiceFlow 状态机重写）

**P1‑T4 · 跳过提示三档 + 跳过台词**（PRD §16.2、§16.3）
- ✅ 首次跳过：浮层 3 秒自动消失
- ✅ 跳过 Day 5：单独提示 + 二选一按钮
- ✅ 跳过 Day 6：单独提示 + 二选一按钮（继续跳过 / 打开看看）
- ✅ 8 伙伴跳过台词回填（已在 `prompts/shared/fallbacks.json::skip_response_by_companion`）
- ✅ skip 路径短路 LLM：`processInput` 对 `inputType='skipped'` 直接写 set_aside（PRD §16.4 模板，concept_name=`关于${TaskDef.theme}`）+ 取预设跳过台词，省 2 次 LLM 调用
- ⏸ **T4‑followup → schema 部分合并到 P2 迁移 0004**："等了你一天" 5 选 1（PRD §16.3 末段）— `companions.last_active_at` 字段加到 P2 的 `0004_trips_and_last_active.sql`；API + 主页 greeting 逻辑在 P2 触达 `/api/companion/state` 时一起改
- **产物**：
  - 改 `src/components/task/TaskOverlay.tsx`（新增 `SkipWarningDay6` 组件）
  - 改 `src/lib/orchestrate/processInput.ts`（skip 短路）
  - 改 `src/types/index.ts` + `src/lib/tasks/index.ts`（TaskDef 加 `theme` 字段）

**T4‑followup 已并入 P2**：见 §P2.2 P2‑T1 迁移与 §P2.2 P2‑T8 主页变化（毕业后）

**P1‑T5 · LLM 降级链全量回填**（PRD §25.2）
- ✅ 审计现有 7 个 LLM 调用点的失败处理：pass1 / pass2 / concept_detail / correction / day7 / keyword_extract / free_chat / day5 — **全部已与 PRD §25.2 一致**：
  - pass1 → maxRetries=1 → `pass1FallbackSetAside`
  - pass2 → maxRetries=1 → `pickFallbackPass2AfterText/Photo`
  - concept_detail → maxRetries=1 → 显示原 evidence 隐 reasoning
  - correction → maxRetries=0 → companion 预设台词
  - day7 → maxRetries=2 → 503 严禁预设替代
  - keyword_extract → maxRetries=1 → `keywordExtractFallback`
  - day5_q1/q2 → maxRetries=1 → `DAY5_FALLBACK_Q1/Q2`
- ✅ skipped 输入短路（T4 已完成）：根本不调 LLM
- ✅ 在 `client.ts` 顶部落降级链总览注释，作为后续新增调用点的对照表
- ⚠️ **决策点（非 bug）**：`freeChat` 当前按 spec/Free_Chat_Implementation V0.2 设计抛 5xx，与 PRD §25.6 "异常的产品话语" 略冲突。P7 用户测试时再决定是否切换为 self-state 兜底
- 不需要新增 `callWithFallback` 包装：每个调用点的 fallback 语义不同，集中包装会丢失业务语义
- **产物**：`src/lib/llm/client.ts` 注释补充

**P1‑T6 · Few‑shot 示例补齐到最小集**（PRD §23.15）
- ✅ 审计现有数据：
  - Pass 1：create_new 3 + append 3 + uncertain 2 + set_aside 3 = 11（PRD 最小集 11）✓
  - Pass 2：8 伙伴 × 3 例 = 24（PRD 最小集 24）✓
  - 概念详情：2（PRD 最小集 2）✓
  - 纠正反馈：8 伙伴 × restore/dismiss/clarify = 24（PRD §18.5 仅要求 restore/dismiss 共 16 条；rename/merge 用通用 fallback，不走 LLM，无需 few-shot）✓
  - Day 7 档案：1 个完整示例 ✓
- 朋友家 / 学校 / 广场 few-shot 推迟到 P2 / P3 / P5（不属 P1 范围）
- **结论**：P1 阶段无新增，仅通过本次审计与 promptLoader 调用链确认数据已正确接入 Pass1/Pass2/concept_detail/correction 提示词

**P1‑T7 · 删除 V0.5 拍照遗留**
- `/api/photo/upload` 删除（已确认 `src/app/capture/` 不存在）
- 检查 `memories.type='photo'` 在新代码路径是否仍引用，决定保留枚举但不暴露

**P1‑T8 · Playwright 配置 + 流程节点 spec**
- 添加 `@playwright/test` 依赖与 `playwright.config.ts`
- spec/01_main_loop.spec.ts：Day 1 描述 → Day 5 选择 → Day 7 档案的 happy path
- spec/02_skip_paths.spec.ts：跳过 Day 5 / 跳过 Day 6 / 全程跳 6 次的 Day 7 元反思分支
- spec/03_revision.spec.ts：卡片"不太对" 3 次后降级文字卡片
- 利用 `scripts/seed-graduate.ts` 跨日跳转
- **产物**：`playwright.config.ts`、`tests/e2e/0[1-3]_*.spec.ts`、`package.json` 加 `test:e2e` script

#### P1.3 数据库变更

无 schema 变更。仅校验现有字段：
- `memories.input_method` 枚举确认覆盖 `voice / text / choice / skipped`
- `memory_bank.user_correction_history` JSON 结构约定写到代码注释

#### P1.4 验收标准（DoD）

- [x] 新用户从 `/` → 引导 → 选伙伴 → 命名 → Day 1 任务，全程无 Stub（T1）
- [x] 跳过任意任务三种文案差异化展示（首次 / Day 5 / Day 6）（T4）
- [x] LLM 降级链审计完成、`client.ts` 注释化（T5）
- [x] 家长中心 6 Tab + 算术题软门槛 + 重看引导 + 卡片 gallery（T2）
- [x] Playwright 配置 + 3 个 smoke spec 可被列出 / `tsc` 全绿（T8）
- [ ] 完整跑完 Day 1‑7 真实 LLM（用 `seed-graduate.ts` mock 模式加速），毕业卡可保存 — 待人工跑
- [ ] 关闭网络模拟 LLM 失败，Pass 2 / 纠正 / 概念详情 / Day 7 全部走预设兜底 — 待人工跑
- [ ] Pass 1 在 30 个本地样本上准确率 ≥ 85%（`npm run prompt:eval`）— 待人工跑

---

### P2 · 驿站基础 + 朋友家

#### P2.1 目标

毕业（`current_day >= 7`）后，孩子可在地图选朋友家、选 4 种目的、出发、看到拜访汇报。

#### P2.2 任务清单

**P2‑T1 · 数据库迁移 0004：trips + companions.last_active_at（合并 P1‑T4‑fu）**
- 新增 `trips` 表（PRD §22.1.8 完整字段）
- `companions` 加 `last_active_at TIMESTAMP NULL DEFAULT NULL`（P1‑T4‑fu 合并进来；用于 PRD §16.3 "等了你一天"）
- `memory_bank` 字段确认 `source_type ENUM('firsthand','secondhand') / source_companion_id` 已存在；不存在则补 ALTER
- **产物**：`db/migrations/0004_trips_and_last_active.sql`

**P2‑T2 · 系统预设伙伴的 memory_bank 快照**（PRD §12.3）
- 4 只：小鱼（海边）、土豆（农村）、星星（城市）、阿木（英文动画）
- 每只 8–12 条 `memory_bank` 记录的 JSON 快照
- 加载时按需注入 LLM Prompt（不入主库表，避免污染统计）
- **产物**：`data/preset_companions/{xiaoyu,tudou,xingxing,amu}.json`、`src/lib/station/presetCompanions.ts`

**P2‑T3 · 驿站地图页**
- 路由 `/station`
- 三场景图标：朋友家（亮）、学校（灰 + 锁，未拜访 2 次）、广场（灰 + 锁，未上学 1 次）
- "今天还可以出门 1 次"提示
- **产物**：`src/app/station/page.tsx`、`src/components/station/StationMap.tsx`

**P2‑T4 · 朋友家准备页 + 出发页 + 等待页**
- `/station/visit/prepare`：4 个目的单选 + "去问问题"分支输入框（复用 VoiceRecorder）
- `/station/traveling`：叙事化等待动画
- 后端实际 3‑5s 完成生成；客户端轮询 `/api/station/trip/[id]`
- **产物**：
  - `src/app/station/visit/prepare/page.tsx`
  - `src/app/station/traveling/page.tsx`
  - `src/components/station/PurposePicker.tsx`、`TravelingAnimation.tsx`

**P2‑T5 · 拜访汇报页**
- `/station/report/visit`：4 种目的对应 4 种版式（PRD §12.6）
- 二手知识展示按钮 → 跳记忆面板高亮该项
- **产物**：`src/app/station/report/visit/page.tsx`、`src/components/station/VisitReport.tsx`

**P2‑T6 · 出行 API**
- `POST /api/station/depart`：创建 trip、调用 LLM、写入 trip.report_data、返回 trip_id
- `GET /api/station/trip/[id]`：查 trip 状态与 report
- `POST /api/station/memory/import`：把 trip.report_data.new_word 写入 memory_bank（source_type='secondhand'）
- 出行限流：每 companion 每天 1 次（按 `trips.created_at` 同日去重）
- **产物**：
  - `src/app/api/station/{depart,trip/[id],memory/import}/route.ts`
  - `src/lib/orchestrate/processVisit.ts`

**P2‑T7 · 朋友家 LLM Prompt + Few‑shot**（PRD §23.10）
- `prompts/visit/system.md` + 4 目的的 examples.json
- `src/lib/llm/visit.ts`：模型角色 = 主力推理；max_tokens=400 / temp=0.7 / 超时 12s
- 硬约束：拜访者与被拜访者均不得凭空发明 memory_bank 之外内容
- **产物**：`prompts/visit/`、`src/lib/llm/visit.ts`

**P2‑T8 · 主页变化（毕业后 + 合并 P1‑T4‑fu greeting）**
- `current_day >= 7` 时主页底部出现 🚪 出门探索按钮
- 朋友家解锁台词（PRD §17.6 / §18.6 八伙伴各 1 条，已在 companions.json 雏形）
- 解锁场景的 2 张引导卡（PRD §17.6 末尾）
- **合并 P1‑T4‑fu**：`/api/companion/state` 内 bump `last_active_at = now()`；返回新字段 `missed_yesterday: boolean`（旧值 < 今天 0 点）
- **合并 P1‑T4‑fu**：主页 SpeechBubble 渲染逻辑：`missed_yesterday` 时优先取 `pickMissedDayLine()`，否则按现状取 `last_companion_line`
- 加 E2E 单元覆盖："等了你一天"分支台词出现（mock 数据库 last_active_at 拨到昨天）
- **产物**：增强 `src/components/home/*`、新增 `src/components/station/UnlockHint.tsx`、改 `src/app/api/companion/state/route.ts`

**P2‑T9 · 二手知识在记忆面板的视觉**
- `ConceptCard.tsx` 检测 `source_type='secondhand'` 时显示来源伙伴名 + "可能不一定准"
- **产物**：增强 `src/components/memory/ConceptCard.tsx`

**P2‑T10 · E2E**
- spec/04_visit_flow.spec.ts：毕业用户 → 选目的 4 → 出发 → 看到二手知识"大海"在记忆面板的 secondhand 标识

#### P2.3 风险与依赖

- 4 只系统预设伙伴的形象资产 → P7 之前可用现有 8 伙伴形象占位
- LLM 越界（编造记忆外内容）→ Prompt 中加严格约束 + 输出验证（关键词在双方 memory_bank 中可溯源）

#### P2.4 验收标准

- [x] T1 迁移 0004：trips + companions.last_active_at + memory_bank.source_type
- [x] T2 4 只系统预设伙伴 JSON + loader（小鱼/土豆/星星/阿木）
- [x] T3 /station 地图页 + 状态 API + 解锁/限流闸门（assertCanDepart）
- [x] T4 朋友家准备 + 等待 + fire-and-forget 异步出行
- [x] T5 拜访汇报页 + 二手知识导入按钮
- [x] T6 出行 API（depart / trip[id] / memory/import）+ processVisit（startVisit + finishVisit 拆分）
- [x] T7 visit LLM Prompt + 4 目的 Few-shot；client.ts 加 'visit' callType + 降级链注释
- [x] T8 毕业后主页 🚪 出门按钮 + missed_day_greeting 优先显示 + last_active_at bump
- [x] T9 ConceptCard 加 secondhandFrom badge + memory bank API 返回 source_type
- [x] T10 E2E spec/04_visit_flow：3 个流程节点用例 + 1 个 happy-path（skipped 待手动启用）
- [ ] 毕业用户可完成 4 种目的中至少 3 种（认识 / 看家 / 问问题）— 待人工跑
- [ ] 同日二次出门被拒绝 — 待人工跑（API 层 assertCanDepart 已实现）
- [ ] LLM 失败 2 次后展示"它好像还没回来......明天再来看看？"— 待人工跑（finishVisit fallback 已实现）

---

### P3 · 学校

#### P3.1 目标

`companions.visit_count >= 2` 后解锁学校；孩子可看到 3‑5 只伙伴对同一问题的差异化回答。

#### P3.2 任务清单

**P3‑T1 · 系统题库**（PRD §13.4）
- A 类（AI 素养导向）24 题
- B 类（趣味探索）16 题
- 每题字段：`{id, category:'A'|'B', text, intent}`
- **产物**：`data/system_questions.json`

**P3‑T2 · 学校准备页**
- `/station/school/prepare`：4 个目的（上课 / 出题 / 观察 / 学新东西）
- `/station/school/question`：孩子出题（VoiceRecorder + 敏感词过滤前置）
- **产物**：`src/app/station/school/{prepare,question}/page.tsx`

**P3‑T3 · 课堂回放页**
- `/station/report/school`
- 3‑5 只伙伴答案逐条出现（每条 0.6s 间隔）
- 偶发"小蓝字教学时刻"（每 3 次出 1 次，从 20 条池子随机）
- "小青龙不会答"分支：底部"现在告诉它"按钮跳记忆面板 unknown 区
- **产物**：`src/app/station/report/school/page.tsx`、`src/components/station/ClassroomReport.tsx`

**P3‑T4 · 班级轮换**
- 池子 = 8 预设伙伴 + 4 系统预设 + 已毕业其他用户伙伴
- 用 `(companion_id + date)` 哈希种子选 3‑5 只，保证当天稳定但每天轮换
- **产物**：`src/lib/station/classRoster.ts`

**P3‑T5 · 学校 API + LLM**（PRD §23.11）
- 复用 `POST /api/station/depart`（按 destination_type='school' 分支）
- `src/lib/llm/school.ts`：主力推理；max_tokens=500 / temp=0.5 / 超时 12s
- 硬约束：每只伙伴的回答必须严格基于其 memory_bank；无依据则输出"我不知道"
- **产物**：`prompts/school/{system.md,examples.json}`、`src/lib/llm/school.ts`、`src/lib/orchestrate/processSchool.ts`

**P3‑T6 · 出题敏感词过滤**
- 复用 `src/lib/safety/filters.ts` 在 `/api/station/depart` 入口拦截
- 触发后返回"这个问题我不太好传达，换一个试试？"

**P3‑T7 · 学校解锁逻辑**
- 解锁条件检查：`companions.visit_count >= 2`
- 解锁台词 + 2 张引导卡

**P3‑T8 · E2E**
- spec/05_school_flow.spec.ts：拜访 2 次后地图学校亮 → 出题 → 回放显示"小青龙不知道公园"分支可用

#### P3.3 验收标准

- [x] T1 系统题库 40 题（A 24 + B 16）+ 教学时刻 20 条（PRD §13.4 / §13.5）
- [x] T4 班级轮换 `pickClassRoster`：visitor 必入 + 1 系统预设 + 2-3 主角
- [x] T5 学校 LLM Prompt + 4 目的 Few-shot（`prompts/school/`）+ `src/lib/llm/school.ts`（callType='school'）
- [x] T6 学校 API：扩 `depart` route 加 school 分支 + 出题 `filterChildInput` 敏感词过滤
- [x] T2 学校准备页 + 出题页（4 目的，ask_my_question 跳出题页）
- [x] T3 课堂回放页：答案逐条 600ms 出现 + highlight + 教学小蓝字 + visitor_doesnt_know "现在告诉它"入口
- [x] T7 解锁路径：visit_count>=2 已在 P2-T3 status 实现；traveling 页 returned 跳转扩支持 school
- [x] T8 E2E spec/05_school_flow：2 流程节点 + 2 happy-path（skipped 待手动启用）
- [ ] 学校在拜访 2 次后才亮起 — 待人工跑
- [ ] A/B 类题目交替出现（dayOfYear%3 切换池）— 待人工跑多日验证
- [ ] 题目击中盲区 → "现在告诉它"入口可用 — 待人工跑

---

### P4 · 行囊 + 广场基础

#### P4.1 目标

完成行囊系统、广场准备页、5 个剧本骨架数据、角色分配逻辑。剧本进行流程留到 P5。

#### P4.2 任务清单

**P4‑T1 · 数据库迁移 0005：inventory + plaza**
- `inventory_items`（PRD §22.1.9）
- `plaza_plays`（PRD §22.1.10）
- **产物**：`db/migrations/0005_inventory_plaza.sql`

**P4‑T2 · 道具池数据资产**（PRD 附录 D）
- 知识类 8 + 物品类 7 + 礼物类 6 + 能力类 6 = 27 件
- 每件字段：`{id, name, category, subcategory, description, detailed_description, applicable_scenarios, upgrade_to}`
- **产物**：`data/items/{knowledge,object,gift,ability}.json`

**P4‑T3 · 5 个剧本骨架**（PRD 附录 B + §14.5.2）
- water_disaster（详细版本，作为标杆样本）
- envoy_visit / plague_outbreak / court_intrigue / border_alarm（骨架版）
- 每个剧本 800–1200 字，结构：`{id, title, type, background, acts:[{number,scene,decision_prompt,适配道具},...], adaptive_items, reward_logic}`
- **产物**：`data/scenarios/{water_disaster,envoy_visit,plague_outbreak,court_intrigue,border_alarm}.json`

**P4‑T4 · 行囊页 + 详情页**
- `/inventory`：4 类分组 + 使用次数 + 来源
- `/inventory/[item_id]`：道具详情（用过哪几个剧本）
- 主入口：玩过 1 次广场后底部多"行囊"
- **产物**：`src/app/inventory/{page,[item_id]/page}.tsx`、`src/components/inventory/{ItemList,ItemDetail}.tsx`

**P4‑T5 · 行囊 API**
- `GET /api/inventory`：按类别分组返回该 companion 的全部道具
- `GET /api/inventory/[id]`：含使用历史
- **产物**：`src/app/api/inventory/{route,[id]/route}.ts`、`src/lib/db/inventoryRepo.ts`

**P4‑T6 · 新手大礼包**
- 第一次进入广场前发放 3 件基础道具：《治水图》+ 一袋金子 + 一壶酒
- 在 `processPlazaPrepare` 中检查 `plaza_count == 0` 触发
- **产物**：`src/lib/station/inventoryGrant.ts`

**P4‑T7 · 广场准备页**
- `/station/plaza/prepare`：剧本简介 + 角色分配（小青龙 + 2‑4 只其他伙伴）+ 选 3 道具
- 角色分配按 PRD §14.4 性格倾向 + 当日剧本类型匹配
- 道具选择弹层 `/station/plaza/inventory-select`
- **产物**：
  - `src/app/station/plaza/{prepare,inventory-select}/page.tsx`
  - `src/lib/station/scenarioPicker.ts`（选今日剧本，避免连续 2 次同剧本）
  - `src/lib/station/roleAssigner.ts`

**P4‑T8 · 广场解锁逻辑**
- 解锁条件：`companions.school_count >= 1`
- 解锁台词 + 2 张引导卡

**P4‑T9 · E2E**
- spec/06_plaza_prepare.spec.ts：上学 1 次后地图广场亮 → 准备页能选 3 道具 → 出发按钮可点（剧本进行留 P5）

#### P4.3 验收标准

- [x] T1 迁移 0005：inventory_items + plaza_plays（幂等 stored procedure 风格 + check constraints）
- [x] T2 道具池 27 件 JSON 资产（知识 8 + 物品 7 + 礼物 6 + 能力 6）
- [x] T3 5 个剧本骨架 JSON（水患 / 使节 / 瘟疫 / 朝堂 / 边境）
- [x] T4 行囊页 + 道具详情页（按 4 类分组 + 适用剧本标签）
- [x] T5 行囊 API：GET /api/inventory + GET /api/inventory/[id]
- [x] T6 新手礼包：第一次进 plaza/prepare 自动发 3 件基础道具（《治水图》+ 一袋金子 + 一壶酒）+ 角色分配（剧本骨架 roles 字段直读）
- [x] T7 广场准备页：剧本简介 + 角色 + 选 3 道具（applicable_item_ids 高亮 ●）+ 出发按钮置灰直到选满
- [x] T8 解锁路径：school_count≥1 已在 P2-T3 status 实现；BottomNav 加 "行囊" 第 5 个 Tab（玩过 1 次广场后出现）
- [x] T9 E2E spec/06_plaza_prepare：1 路由节点 + 2 happy-path（skipped 待手动启用）
- [ ] 27 件道具全部入库可查 — 待人工跑（grant 流通后）
- [ ] 5 个剧本 JSON 可被 LLM Prompt 拼接成功 — 待 P5 实装剧本 LLM 后验证
- [ ] 角色分配合理 — P5 实装角色分配 LLM 时再做更动态的分配；当前剧本骨架预定 roles

---

### P5 · 广场剧本进行流程

#### P5.1 目标

跑通"3 幕 + 结局 + 道具奖励"完整闭环。

#### P5.2 任务清单

**P5‑T1 · 剧本进行页**
- `/station/plaza/play/[scenario_id]/act/[n]`（n=1..3）
- 每幕：纸片插画 + 叙事文本 + 决策点 + 4 道具选项 + "不用道具"
- 道具点击 → 5–8s 实时生成下一段（伙伴思考动效）
- **产物**：`src/app/station/plaza/play/[scenario_id]/act/[n]/page.tsx`、`src/components/station/PlazaActView.tsx`

**P5‑T2 · 剧本结局页**
- `/station/plaza/play/[scenario_id]/ending`
- 结局叙事 + 国王评价 + 获得道具列表 + "再玩一次 / 回家"
- 道具升级：触发 `inventory_items.is_upgraded_from`（如《治水图》→《治水十策》）
- **产物**：`src/app/station/plaza/play/[scenario_id]/ending/page.tsx`、`src/components/station/PlazaEndingView.tsx`

**P5‑T3 · 广场 LLM**（PRD §23.12 / §23.13）
- 角色：角色专精模型；max_tokens=400 / temp=0.6 / 超时 12s
- 5 个剧本 × 3 幕的 Prompt 模板
- 道具用不上的兜底："我本来想拿出 X，但好像和这件事没关系。"
- 第 N 次玩同剧本的特殊台词（PRD §14.5.3）
- **产物**：
  - `prompts/plaza/{system.md,water_disaster.json,envoy_visit.json,plague_outbreak.json,court_intrigue.json,border_alarm.json}`
  - `src/lib/llm/plaza.ts`
  - `src/lib/orchestrate/processPlazaAct.ts`、`processPlazaEnding.ts`

**P5‑T4 · 广场 API**
- `POST /api/station/plaza/play`：每幕实时调用，传 `{trip_id, act_number, selected_item_id}`
- `POST /api/station/plaza/finish`：综合 3 次选择生成结局 + 写 plaza_plays + 发奖励
- **产物**：`src/app/api/station/plaza/{play,finish}/route.ts`

**P5‑T5 · 道具奖励逻辑**
- 每次必得 1 件基础道具（按剧本类型）
- 表现奖励 1 件特色道具（基于 act_choices.quality）
- 多次玩同类剧本升级（如水患 ≥ 3 次升《治水十策》）
- **产物**：`src/lib/station/rewardEngine.ts`

**P5‑T6 · 剧本插画占位与替换**
- MVP 用 AI 生成 + 设计师挑选 30‑40 张
- 路径约定：`public/scenario_illustrations/{scenario_id}/{act_n}_a.png`（每幕 1‑2 张）
- 缺图时用纸片占位图

**P5‑T7 · E2E**
- spec/07_plaza_full.spec.ts：选剧本 → 选 3 道具 → 走完 3 幕 → 结局获得道具 → `/inventory` 看到新道具

#### P5.3 验收标准

- [x] T3 plaza_act + plaza_ending Prompt + Few-shot 各 5 条；新增 callType 'plaza_act' / 'plaza_ending'
- [x] T5 rewardEngine：computeFinalRewards（合并 LLM + scenario.rewards 兜底）+ grantRewards（落 inventory）+ 升级触发（perfect+natural+upgrade_to）+ getRepeatPlayHint（第 2 次"试试不一样的道具"/ 第 3 次"我每次都能想出不同的办法"）
- [x] T4 API：POST /api/station/plaza/play 三 action（start / act / finish）+ GET 查 state；fire-and-forget LLM；act 强校验"out_of_order_act"
- [x] T1 剧本进行页 `/station/plaza/play/[id]/act/[n]`：插画占位 + scene 文本 + 决策点 + 道具列表（适用项 ● 高亮 + 不用道具凭直觉）+ LLM 回来后渲染 small_blue_dragon_speech 高亮 + others 反应 + stretched/skipped 元台词
- [x] T2 结局页 `/station/plaza/play/[id]/ending`：自动 finish → 结局等级 chip + ending_narrative + 国王评价 + 奖励列表（is_upgrade ✨高亮）+ "再玩一次/回家"双按钮
- [x] T6 插画占位 ScenarioIllustration：5 剧本各自色调 + emoji 标 act；P7 替换真资产时只改 component
- [x] T7 E2E spec/07_plaza_full：2 路由节点 + 1 happy-path（skipped）
- [ ] 5 个剧本各跑通至少 1 次 — 待人工跑
- [ ] 道具升级路径触发正确（手工跑 3 次水患剧本验证）— 待人工跑
- [ ] LLM 失败时降级稳定 — 待人工跑（plazaActFallback / plazaEndingFallback 已实现）

---

### P6 · 临时上线方案 + 阿里云部署

#### P6.1 目标

让 5–10 个真实用户能在公网试用；不依赖广场完成度（可单独切片上线）。

#### P6.2 任务清单

**P6‑T1 · 昵称软隔离用户系统**（PRD §27.2）
- `/start`：欢迎页 → 输入昵称 → 创建/查找用户
- 同昵称冲突按 §27.2.3 分浏览器处理
- "用昵称回来"找回 + 多用户挑选
- 前端写 localStorage `{nickname, user_id, session_token, created_at}`
- 后端 `users` 表用 `nickname + device_fingerprint` 软识别
- **产物**：`src/app/start/page.tsx`、`src/lib/auth/nickname.ts`、`src/lib/auth/fingerprint.ts`

**P6‑T2 · 数据隔离强校验**
- 所有 `/api/*` 入口强制 `assertOwnership(companionId, req.user.id)`
- 跨用户访问试探的 404（不是 403，避免泄露存在性）
- **产物**：`src/lib/auth/ownership.ts`

**P6‑T3 · 管理员看板**
- `/admin?key=$ADMIN_KEY`：用户列表（昵称 / Day / 最近活跃）
- `/admin/users/[id]?key=...`：详情只读（对话、卡片、memory_bank、旅行记录）
- **产物**：`src/app/admin/{page,users/[id]/page}.tsx`、`src/app/api/admin/{users,users/[id]}/route.ts`

**P6‑T4 · 限流**
- IP 限流：1 小时 5 个新用户（Redis incr + expire）
- 全局每日上限：50 新用户
- 单用户日 LLM 调用 ≤ 30 次（在 `client.ts callWithFallback` 入口检查）
- **产物**：`src/lib/auth/rateLimit.ts`、`package.json` 加 `ioredis`

**P6‑T5 · 阿里云部署**
- ECS 2C4G + RDS MySQL 1C1G + Redis 256M + OSS 桶
- HTTPS 证书 + 域名 + ICP 备案（提前 2 周准备）
- Next.js standalone 构建 + PM2 守护
- 环境变量在 `/etc/home/.env`
- **产物**：`infra/deploy.md`、`infra/nginx.conf`、`infra/pm2.config.cjs`

**P6‑T6 · 数据备份**
- crontab 每日凌晨 3:00：`mysqldump | gzip | aliyun oss cp - oss://home-backup/$(date).sql.gz`
- 保留 30 天
- **产物**：`scripts/backup.sh`、部署文档

**P6‑T7 · 监控最小集**（PRD §25.7）
- 日志聚合：Pino → 文件 → 阿里云 SLS（可选）
- 每日邮件汇总：Day 7 失败次数 / LLM 失败率 / 服务器响应时间 P95
- 实时告警阈值见 §25.7
- **产物**：`scripts/daily-monitor.ts`、cron 任务

**P6‑T8 · 隐私政策 + ToS 简版**
- 落欢迎页底部链接
- **产物**：`src/app/legal/{privacy,tos}/page.tsx`

#### P6.3 验收标准

- [ ] 公网域名可访问
- [ ] 不同浏览器同名昵称数据互不可见
- [ ] `/admin?key=...` 看板可看到 3+ 测试用户
- [ ] 触发 IP 限流后看到友好提示
- [ ] 备份脚本在阿里云上每日凌晨自动跑

---

### P7 · 验收 / 打磨 / 资产收口

#### P7.1 目标

满足 PRD §28 验收指标 + IP 角色替换 + 视觉资产到位。

#### P7.2 任务清单

**P7‑T1 · IP 角色替换**
- 琳娜贝尔 → 原创角色（保留怯生生气质）
- 藤藤蛇 → 原创角色（保留警觉害羞气质）
- 涉及：立绘、`companions.json`、preset 表数据迁移
- **产物**：迁移 `db/migrations/0006_replace_ip_companions.sql`

**P7‑T2 · 视觉资产收口**
- 8 伙伴 × 3 姿态（站 / 坐 / 躺）= 24 张立绘
- 每姿态 5 表情面部局部小图 = 120 张
- 30 个房间物品图标
- 4 系统预设伙伴形象
- 30‑40 张剧本插画
- 7 个广场角色配饰图层

**P7‑T3 · Prompt 调优**（PRD §23.16）
- Pass 1：50‑100 真实样本回归，准确率 ≥ 85%
- Pass 2：每伙伴 10 样本人工评估语气一致性 ≥ 85%
- Day 7：10 样本人工评估"情感到位率" ≥ 80%
- **产物**：`scripts/prompt-eval.ts` 扩展 + 评估报告 `spec/Prompt_Eval_Report.md`

**P7‑T4 · 8 伙伴文案全量回填**
- 跳过台词 / 解锁台词 / 出发台词 / 纠正反馈 / 等待文案变体
- **产物**：完整 `prompts/shared/companions.json`

**P7‑T5 · 用户测试 + 修复**
- 5–10 个孩子完整 7 天 + 至少 1 次驿站
- 按 PRD §28 收集指标
- Bug 修复 1 轮
- **产物**：`spec/UAT_Report.md`

**P7‑T6 · 错误处理回归**
- 按 PRD §25 表格逐项手测一次
- 形成一份回归 checklist

**P7‑T7 · 性能与体验抛光**
- 描述卡片总时长中位数 ≤ 15s（按 PRD §28.4）
- 减少动效开关在设置中可用
- 移动端 30fps 检查

**P7‑T8 · Day 4 语音输入支持（合并 P1‑T3‑fu）**（PRD §5.6 / §7.11）
- TaskOverlay TextZone 加"🎤 改用说话"按钮
- 复用 `VoiceRecorder` + `/api/voice/upload`（不走图像生成）
- ASR 文字回填到 textarea，孩子可继续编辑后提交
- 配套 E2E：spec/08_day4_voice.spec.ts 验证语音/文字两条路径
- **产物**：改 `src/components/task/TaskOverlay.tsx`（TextZone 嵌 VoiceRecorder mini 控件）

#### P7.3 验收标准（参考 PRD §28）

| 类别 | 指标 | 阈值 |
|---|---|---|
| 完成率 | Day 1 完成转化 | ≥ 80% |
| 完成率 | 7 天毕业率 | ≥ 50% |
| 互动深度 | 打开记忆面板 | ≥ 70% |
| 教育价值 | 4 层目标内化 | 各 ≥ 50% |
| 技术 | Pass 1 准确率 | ≥ 85% |
| 技术 | 卡片成功率 | ≥ 90% |
| 技术 | ASR 准确率 | ≥ 90% |
| 技术 | 安全过滤事故 | 0 起 |

---

## 4. 跨阶段并行工作

| 工作流 | 时机 | 阶段 |
|---|---|---|
| 8 伙伴立绘 + 表情系统 | P1 启动后立刻 | P1‑P7 持续 |
| 房间物品图标（30 个） | P1 启动后立刻 | P1‑P3 |
| 4 系统预设伙伴形象 | P2 开始前 | P2 |
| 5 剧本骨架文本创作 | P3 末启动 | P4 |
| 30‑40 张剧本插画 | P4 启动 | P4‑P5 |
| Few‑shot 示例补到 ~100 条 | P1 主，逐阶段补 | P1‑P5 |
| Prompt 版本管理 `_v{N}.md` | 全程 | P1‑P7 |
| IP 角色替换 | P7 前必须完成 | P7 |
| ICP 备案 | 提前 2 周开始 | P6 前置 |

---

## 5. 关键风险登记

| ID | 风险 | 影响 | 应对 | 触发阶段 |
|---|---|---|---|---|
| R1 | Day 7 档案在低输入量下生成失败 | 核心顿悟时刻不成立 | 不允许预设替代；必须重试 3 次后引导稍后再来 | P1 |
| R2 | Pass 1 归类准确率 < 85% | 记忆面板内容质量差 | P1 末必须用 50 样本回归通过；否则不进 P3 | P1 |
| R3 | 系统预设伙伴极端世界观让孩子觉得不真实 | 朋友家体验下降 | 极端设定仅作对照；真实伙伴优先 | P2 |
| R4 | 5 剧本骨架人工创作工作量大 | P4 阻塞 | 先打通水患（标杆），其他可推迟 1‑2 周 | P4 |
| R5 | 8 岁孩子读古代题材跟不上 | 广场参与度下降 | 提前找 5 个孩子读骨架；跟不上则简化用词、增加插画 | P5 用户测试 |
| R6 | 阿里云 ICP 备案延误 | P6 上线推迟 | 提前 2 周开始 | P6 前置 |
| R7 | 4 个系统预设伙伴形象资产没准备好 | P2 仅占位 | 先用 8 主伙伴的小变体占位，P7 替换 | P2 |
| R8 | LLM 调用成本超预算 | 直接经济损失 | 单用户日 30 次上限 + 每日全局成本监控 | P6 |
| R9 | 同昵称冲突时孩子困惑 | 找回失败、放弃 | 找回页给"最近活跃 / 创建时间最近"两个排序按钮 | P6 |
| R10 | 重做循环让孩子陷入完美主义焦虑 | 体验受挫 | 限制 3 次 + 降级文字卡片（已有） | P1 验证 |

---

## 6. 待决议项（按 PRD §29.2，建议在对应阶段前敲定）

### 6.1 P1 决策

- [ ] 30 秒引导是否需要 AI 视频版本（默认否，V2 考虑）
- [ ] 描述字数上限 100 / 200 字（默认 200）
- [ ] 中转页是否设置自动确认（默认否）
- [ ] "再加一段"是否保留（默认保留）
- [ ] 8 岁孩子能否长按语音按钮 vs 点击切换（默认长按 + 设置中可切）

### 6.2 P2 决策

- [ ] 拜访目标匹配算法：随机 / 固定 / 按差异度（默认按差异度，预设伙伴补位）

### 6.3 P3 决策

- [ ] 学校班级稳定性：每天轮换 vs 固定（默认每天轮换）
- [ ] 一天内是否允许 1 次拜访 + 1 次学校（默认仅 1 次出门）

### 6.4 P5 决策

- [ ] 道具数量上限是否需要"整理"功能（V1.0 不限）
- [ ] barely 结局是否惩罚（默认不惩罚，仍奖励 1 件道具）
- [ ] 角色固定 vs 动态（默认动态，性格倾向稳定）

### 6.5 通用

- [ ] "放下的事"是否设置 24 小时冷静期再展示给孩子（默认即时）
- [ ] 家长能否在 Day 7 之前看到内容（默认能）

---

## 7. 资源裁剪预案（按 PRD §26.10）

### 7.1 时间紧张时按以下优先级裁剪

**绝对不裁剪（核心闭环）**
- 7 天主流程（P1）
- 描述卡片机制
- 记忆面板
- Day 7 档案 + 毕业卡

**可延后到 V1.1**
- 学校（P3）
- 广场（P4‑P5）
- 行囊系统
- 4 系统预设伙伴

**可简化**
- 30 秒引导：4 张 → 2 张
- 8 伙伴 → 先上 4 个
- 5 剧本 → 先上 1 个（水患治理）
- 朋友家系统预设伙伴：4 只 → 2 只

### 7.2 仅做核心闭环的最小路径

P1 → P6 → P7（约 3 周），跳过 P2‑P5。
等同于 PRD §26.10 的"V1.0 不上线驿站"方案。

---

## 8. 阶段交接清单

每个阶段末交接给下一阶段时，必须完成：

1. **代码合入主分支**（不留长期 feature branch）
2. **数据库迁移可重放**（`db:reset && db:migrate` 全绿）
3. **新增 API 在 [API.md] 中登记**（建议新建 `spec/API.md` 同步维护）
4. **新增 Prompt 在 `/prompts/` 下有 `system.md` + 至少 1 个 example**
5. **新增 LLM 调用点在 PRD §21.4 表格中可对应到模型角色**
6. **本阶段对应的 E2E spec 全部通过**
7. **README.md 的"运行" / "测试" / "部署"段落同步**
8. **更新本文档"现状基线 0.1"段落**

---

## 9. 文件 / 目录约定

```
src/
  app/
    intro/              # P1 引导
    onboarding/         # 已存在
    home/               # 已存在
    describe/           # 已存在
    memory/             # 已存在
    day7/               # 已存在
    parent/             # P1 重写
    start/              # P6 临时上线入口
    admin/              # P6 管理员
    station/            # P2 新增
      page.tsx                       # 驿站地图
      visit/{prepare,...}/           # P2 朋友家
      school/{prepare,question,...}/ # P3 学校
      plaza/{prepare,inventory-select,play/[id]/act/[n],play/[id]/ending}/  # P4-P5
      traveling/                     # P2 共用
      report/{visit,school}/         # P2-P3
    inventory/          # P4 行囊
    legal/              # P6 隐私 / ToS
    api/
      station/{depart,trip/[id],memory/import,plaza/{play,finish}}/
      inventory/
      admin/
      parent/
  components/
    station/            # P2-P5
    inventory/          # P4
  lib/
    station/            # P2-P5（presetCompanions, classRoster, scenarioPicker, roleAssigner, rewardEngine）
    auth/               # P6（nickname, fingerprint, ownership, rateLimit）
    orchestrate/
      processVisit.ts             # P2
      processSchool.ts            # P3
      processPlazaAct.ts          # P5
      processPlazaEnding.ts       # P5
    llm/
      visit.ts          # P2
      school.ts         # P3
      plaza.ts          # P5

data/
  preset_companions/    # P2
  items/                # P4
  scenarios/            # 已存在但空，P4 填充
  system_questions.json # P3

prompts/
  visit/                # P2
  school/               # P3
  plaza/                # P5

db/migrations/
  0004_trips.sql              # P2
  0005_inventory_plaza.sql    # P4
  0006_replace_ip_companions.sql  # P7

tests/e2e/
  01_main_loop.spec.ts          # P1
  02_skip_paths.spec.ts         # P1
  03_revision.spec.ts           # P1
  04_visit_flow.spec.ts         # P2
  05_school_flow.spec.ts        # P3
  06_plaza_prepare.spec.ts      # P4
  07_plaza_full.spec.ts         # P5

infra/                  # P6
  deploy.md
  nginx.conf
  pm2.config.cjs
scripts/
  backup.sh             # P6
  daily-monitor.ts      # P6
```

---

## 10. 与 PRD 的对照速查表

| PRD 章节 | 实施阶段 |
|---|---|
| §5 7 天总览 | P1 |
| §6 描述卡片 | 已完成（V0.6.1）+ P1 调优 |
| §7 语音输入 | 已完成（V0.6.1） |
| §8 记忆面板 | 已完成 + P1 边角 |
| §9 Day 7 档案 | 已完成 + P1 降级 |
| §10 毕业卡 | 已完成 + P1 静态保持验证 |
| §11 驿站总览 | P2 |
| §12 朋友家 | P2 |
| §13 学校 | P3 |
| §14 小区广场 | P4‑P5 |
| §15 8 伙伴 | P1 文案 + P7 IP 替换 |
| §16 跳过机制 | P1 |
| §17 首次引导 | P1 |
| §18 文案设计 | P1‑P7 持续 |
| §19 视觉规范 | P1‑P7 资产产出 |
| §20 界面规范 | P1‑P5 落地 |
| §21 技术架构 | P1（LLM 客户端）+ P6（基础设施） |
| §22 数据模型 | P2 / P4 / P7 迁移 |
| §23 Prompt 工程 | P1‑P5 各阶段对应 |
| §24 AI 输出安全 | P1 + 各阶段 Prompt 硬约束 |
| §25 错误处理 | P1 + 各阶段补全 |
| §26 实现路径 | 本方案 |
| §27 临时上线 | P6 |
| §28 验收指标 | P7 |
| §29 风险与待决议 | 本方案 §5 / §6 |

---

*实施方案文档结束 · 由本文档驱动后续每周开发任务的拆分与跟踪*
