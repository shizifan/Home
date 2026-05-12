# E2E 主干流程测试方案 V0.1

> 适用范围：本方案只覆盖 7 天主循环 happy-path。`/station`（拜访 / 学校 / 广场）支线、跳过路径、卡片 revision、错误回归等均不在本期。

## 1. 目标

跑通**唯一一条**用户路径：从启动页一路点 UI，经过 Day 1 → Day 7 主循环，最终进入 `/day7/worldview` 看到 LLM 生成的世界观文案，且 `/home` 顶部出现"出门探索"入口。

通过条件：

- 每一步 URL 跳转符合预期。
- 每一步关键文案/按钮可见。
- LLM 真实生成的内容（卡片说明、Day 5 题目、世界观）能渲染出来（断言其存在，不断言具体措辞）。
- 整个 spec 运行结束时，DB 中该 companion 的 `graduated = 1`、`current_day = 7`。

不验证：

- 视觉回归（沿用既定测试偏好）。
- 卡片图像质量 / 内容审核。
- 文案是否"好"——交给 `npm run prompt:eval`，与 E2E 互补。

## 2. 模式与外部依赖

| 依赖 | 模式 | 说明 |
|---|---|---|
| 文本 LLM（DeepSeek） | **真实** | 需 `.env.local` 里有 `DEEPSEEK_API_KEY` |
| 图像生成（MiniMax） | mock | 设 `TEST_LLM_MODE=mock`；E2E 不验图像质量，避免审核失败导致流程波动 |
| 风格审核 / 内容审核 | mock | 同上，跟随 `TEST_LLM_MODE=mock` |
| ASR | 不触发 | 全程走 `/describe/text`、`TaskOverlay` 文字模式，不打 ASR 链路 |

启动方式：

```bash
TEST_LLM_MODE=mock npm run dev    # 终端 A，端口 3001
npx playwright test 01_main_loop  # 终端 B
```

`playwright.config.ts` 的 `webServer` 段已经默认带 `TEST_LLM_MODE=mock`，直接 `npm run test:e2e -- -g main_loop` 也可，前提是 `.env.local` 里有 DeepSeek key（dev server 会读取）。

## 3. 主干节点清单

每个节点 = 一个 step。spec 用 `test.step()` 分块，方便失败定位。

| # | 起点 URL | 操作 | 断言 | 超时 |
|---|---|---|---|---|
| 0 | — | `POST /api/dev/reset` 清空旧 companion | 200 OK | 5s |
| 1 | `/` | 点 `开始` 链接 | URL 跳到 `/intro` | 5s |
| 2 | `/intro` | 点 `跳过引导` | URL 跳到 `/onboarding/choose` | 5s |
| 3 | `/onboarding/choose` | 点小青龙卡片 → 点 `选 小青龙 一起开始 7 天` → 弹层中点确认（"确认"按钮文案需运行时核对） | URL 跳到 `/onboarding/name` 或 `/home` | 10s |
| 4a | `/home` | 若在 `/onboarding/name`，输入名字 / 跳过 → 进 `/home` | 顶部出现 `DAY 1`，下方有 `今日任务` 角标 | 10s |
| 4b | `/home` | 点底部 `今日任务` 进 TaskOverlay | overlay 内出现 `DAY 1` 标题 | 5s |
| 5 | TaskOverlay (Day 1 describe) | 点 `用打字` | URL 跳到 `/describe/text?task_id=...` | 5s |
| 6 | `/describe/text` | textarea 填 Day 1 文本 → 点 `生成卡片 ▷` | URL 跳到 `/describe/generating` | 5s |
| 7 | `/describe/generating` | 等待 LLM + 图像（mock 图片）→ 自动跳确认卡 | URL 含 `/describe/confirm-card` | **60s** |
| 8 | `/describe/confirm-card` | 点 `就是这样` | URL 回到 `/home`，墙上多出 1 张卡 | 15s |
| 9 | `/home` | 顶部出现 `去 Day 2 →`，点之 | URL 仍在 `/home`，`current_day` 变 2 | 10s |
| 10–17 | 重复 5–9 | Day 2、Day 3（仍是 describe） | 每天结束后 `current_day +1` | 同上 |
| 18 | `/home` (Day 4) | 点 `今日任务` | overlay 内是 text 类（输入框直接在 overlay 里） | 5s |
| 19 | overlay (text) | 填文本 → 点 `提交` | overlay 走 reply stage 然后关闭，回 `/home`，`current_day = 5` 待推进 | 30s |
| 20 | `/home` | 点 `去 Day 5 →` | `current_day = 5` | 10s |
| 21 | `/home` (Day 5) | 点 `今日任务` | overlay 内显示 LLM 生成的 Q1 + 选项 | **20s**（LLM 拉题）|
| 22 | overlay (choice) | 选第一个选项 → 提交；等 Q2 → 选第一个 → 提交 | overlay 关闭，`current_day = 6` 待推进 | **40s** |
| 23 | `/home` (Day 6) | 点 `去 Day 6 →` → `今日任务` → 进 memory_review 流程，按 UI 走完（最坏情况调 `POST /api/task/skip` 兜底，但 happy-path 优先点 UI） | `current_day = 7` 待推进 | 15s |
| 24 | `/home` (Day 7) | 点 `去 Day 7 →` → 顶部出现 `看 小青龙 眼中的世界 →` → 点之 | URL 跳 `/day7/worldview` | 10s |
| 25 | `/day7/worldview` | 等动画 + LLM 世界观 → 出现 `生成毕业卡 →` | "它眼中的世界" 标题可见，且世界观正文非空 | **60s** |
| 26 | `/home`（回 home 后） | 出现 `🚪 出门探索` 入口 | 元素可见且可点 | 5s |

注：第 3 步、第 23 步的具体文案/UI 需要在实现 spec 时再次核对（onboarding 弹层 + Day 6 memory_review 这两块文案有可能后续微调过）。先用宽容的正则匹配（`getByText(/确认|开始/)`）兜底。

## 4. 实施清单

### 4.1 新增文件

| 文件 | 说明 |
|---|---|
| `tests/e2e/01_main_loop.spec.ts` | 主 spec，按 §3 的 step 顺序写 |
| `tests/e2e/_helpers/main-loop.ts` | 共用 helpers：`resetDb(request)`、`fillDescribeAndConfirm(page, dayText)`、`advanceDay(page)`、`SAMPLE_TEXTS`（直接挪 `scripts/seed-graduate.ts` 里的 SAMPLE_DESCRIPTIONS）|

### 4.2 不改动的文件

- `playwright.config.ts` —— 已有 `01_main_loop.spec.ts` 的命名计划，配置不动。
- 应用代码 —— 主干已实现，本方案不引入产品改动。

### 4.3 可能要补的小工具

- 如果 onboarding/choose 确认弹层、Day 6 memory_review 的 UI 选择器在跑的时候发现脆弱（文案漂移），允许给关键元素加 `data-testid`。**不主动加**，只有跑挂了再补。

## 5. 运行预算

- 单次跑：5–10 分钟（取决于 DeepSeek 当时响应）。
- DeepSeek token 成本：3 张卡片 + Day 4 + Day 5×2 + worldview ≈ 7 次大调用，单次跑预估 ¥0.5–¥1。
- spec 整体 `test.setTimeout(15 * 60 * 1000)` 给 15 分钟兜底。
- Playwright 配置已是 `workers: 1`，不必担心并发干扰。

## 6. 风险与对策

| 风险 | 对策 |
|---|---|
| LLM 偶发超时 / 限流 | 在调用 LLM 的节点用 `waitForURL` 配 60s 超时；spec 失败时自动 `trace: 'on-first-retry'`，便于回看 |
| LLM 输出选项格式异常导致 Day 5 找不到可点元素 | 用 `locator('button').filter({ hasText: /./ })` 兜底取第一个非空按钮，而不是按文本精确匹配 |
| 文案漂移（产品微调引导/CTA） | 用 `getByText(/.../, { exact: false })` + 正则；只断言"路径走通"，不断言"措辞" |
| Day 6 memory_review 真要走 UI 走不通 | 允许调 `/api/task/skip` 兜底（这是 happy-path 妥协项，要在 spec 注释里写明，后续支线扩展时再补真 UI 流程）|
| dev server 没起 / 端口被占 | spec 启动前 `playwright.config.ts.webServer` 自动起；本机调试时手动起再 `PLAYWRIGHT_NO_WEBSERVER=1` 跑 |

## 7. 不做事项（明确划走）

- ❌ `02_skip_paths.spec.ts`、`03_revision.spec.ts` —— 留到主干稳定后再做。
- ❌ `04_visit_flow.spec.ts` / `05_school_flow.spec.ts` / `07_plaza_full.spec.ts` 中的 `.skip` happy-path —— 同上。
- ❌ `08_full_journey.spec.ts`（贯穿大 spec）—— 主干稳定后再决定要不要。
- ❌ 视觉回归、图像质量、ASR 链路。

## 8. 验收

满足以下两条即视为本期完成：

1. 本地 `npx playwright test 01_main_loop --reporter=list` 连续跑 3 次全过（接受 1 次因 LLM 抖动重试）。
2. spec 跑完后 `mysql ... -e "select current_day, graduated from companions order by created_at desc limit 1"` 返回 `7 | 1`。

---

下一步：照本方案落 `tests/e2e/_helpers/main-loop.ts` 和 `tests/e2e/01_main_loop.spec.ts`。
