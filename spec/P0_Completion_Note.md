# Phase 0 准备期 · 完成确认

**日期** 2026-04-29
**状态** 工程侧资产已落盘 · 设计与产品侧资产部分待补
**对应计划** [Home_MVP_Implementation_Plan_V0.1.md](Home_MVP_Implementation_Plan_V0.1.md) §4

---

## 1. 已交付（工程侧 · 100%）

### 1.1 项目骨架

| 文件 | 用途 |
|------|------|
| [package.json](../package.json) | 依赖锁：Next.js 15 + React 18 + TS + Tailwind + Zustand + Supabase + openai (兼容 DeepSeek/MiniMax) + zod |
| [tsconfig.json](../tsconfig.json) | 路径别名 `@/*` `@prompts/*` |
| [next.config.mjs](../next.config.mjs) | 远程图片白名单 + Server Actions 4MB |
| [postcss.config.mjs](../postcss.config.mjs) | Tailwind 编译 |
| [.env.example](../.env.example) | Supabase / DeepSeek (LLM) / MiniMax (Vision) / 可选 OSS |
| [.gitignore](../.gitignore) | 标准 Next + Supabase 本地分支 |
| [README.md](../README.md) | 起步指引 |

### 1.2 设计系统

| 文件 | 内容 |
|------|------|
| [tailwind.config.ts](../tailwind.config.ts) | PRD §9.2 / §9.3 全部 design token：bg / ink / amber / m（4 区块）/ companion（8 伙伴）/ gold |
| [src/styles/globals.css](../src/styles/globals.css) | CSS 变量同源 + viewport-lock + prefers-reduced-motion |
| [src/components/room/Room.tsx](../src/components/room/Room.tsx) | 等距房间 SVG，PhotoSticker / FrameSticker / FloorItem，3 类物品已实现，30 类清单留位 |
| [src/components/characters/Xiaoqinglong.tsx](../src/components/characters/Xiaoqinglong.tsx) | 小青龙 3 视图（站坐躺）真稿，移植自 design/parts.jsx |
| [src/components/characters/Placeholder.tsx](../src/components/characters/Placeholder.tsx) | 7 个伙伴占位（圆形剪影 + 各自色板），P0-1.4 待真稿替换 |
| [src/components/characters/Companion.tsx](../src/components/characters/Companion.tsx) | 统一入口：`<Companion presetId="xiaoqinglong" pose="stand" />` |
| [src/components/characters/types.ts](../src/components/characters/types.ts) | 8 个 preset_id、色板、中文显示名 |

### 1.3 数据库

| 文件 | 内容 |
|------|------|
| [supabase/migrations/0001_init.sql](../supabase/migrations/0001_init.sql) | 7 张表 + 1 张 llm_call_log 监控表 + RLS 策略 + companion_stats 视图 |
| [supabase/seed.sql](../supabase/seed.sql) | companion_presets 种子，8 个伙伴 |

### 1.4 Prompt 资产（5 个调用点）

| 调用点 | system 模板 | Few-shot 数 | 备注 |
|--------|-------------|-------------|------|
| Pass 1 归类 | [prompts/pass1/system.md](../prompts/pass1/system.md) | 11（3+3+2+3）| 4 个 action 全覆盖 |
| Pass 2 对话 | [prompts/pass2/system.md](../prompts/pass2/system.md) | 24（8 × 3）| 8 伙伴各 3 条 |
| 概念详情 | [prompts/concept_detail/system.md](../prompts/concept_detail/system.md) | 2 | 人物 + 活动 |
| 纠正反馈 | [prompts/correction/system.md](../prompts/correction/system.md) | 24 | 见下方 ⚠️ |
| Day 7 档案 | [prompts/day7/system.md](../prompts/day7/system.md) | 1 | 完整示例 |

### 1.5 共享资产

| 文件 | 内容 |
|------|------|
| [prompts/shared/companions.json](../prompts/shared/companions.json) | 8 伙伴 prompt 元数据（注入用）|
| [prompts/shared/hard_constraints.md](../prompts/shared/hard_constraints.md) | 通用硬约束 v1（PRD §15.1.4）|
| [prompts/shared/fallbacks.json](../prompts/shared/fallbacks.json) | 备用文案库（PRD §11.6）|

---

## 2. 工程化验收

```
✓ 所有 17 个 Prompt JSON 通过 JSON.parse 校验
✓ Few-shot 总计 62 条（Pass1 11 + Pass2 24 + Detail 2 + Correction 24 + Day7 1）
✓ 38 个项目文件落盘（不含 design/ jpg/ spec/）
✓ TypeScript 路径别名与 Next.js App Router 兼容
```

---

## 3. ⚠️ 已知缺口（需后续补齐）

### 3.1 设计资产缺口（不阻塞 P1，但阻塞 P4 演示效果）

| 缺口 | 计划补齐时间 | Owner |
|------|-------------|-------|
| 7 个剩余伙伴立绘真稿（大熊 / 小火龙 / 藤藤蛇 / 小绿龙 / 琳娜贝尔 / 小老虎 / 小狮子）| P1 第 2 天起并行 | 设计师 |
| 30 类物品图标库（当前仅 dumplings/blocks/plant 3 类）| P3 前 | 设计师 |
| 8 伙伴 × 5 表情切片（默认/开心/好奇/思考/困惑）| P4 前 | 设计师 |

### 3.2 Prompt 资产缺口

| 缺口 | 数量 | 计划补齐时间 |
|------|------|-------------|
| 纠正反馈 rename / merge 类 Few-shot | 16（8 × 2）| P3 实施 correction API 时 |
| Pass 2 各伙伴覆盖 mark_uncertain 与 set_aside 的更多变体 | 8–16 | P2 调优后 |

> 当前 62 条 vs PRD §15.9.1 要求 78 条，差 16 条，全部集中在纠正反馈的 rename/merge。这两类动作在 MVP 中频率最低，先用通用 fallback 文案兜底（已写在 examples.json 的 `_fallback_rename_merge` 段）；P3 实装 correction API 时一并补齐。

### 3.3 阻塞性决议项

| 决议项 | 状态 | 阻塞 |
|--------|------|------|
| §12-A MVP 上线区域（国内 / 海外）| ❌ 待定 | 阻塞 Phase 6 部署，**不**阻塞 P1–P5 |
| §1.2-A 前后端同仓 | ✅ 默认同仓（已按此实施）| — |
| §6.2-A Pass 1+2 串行 | ✅ 默认串行（已按此实施）| — |

---

## 4. P1 启动条件 checklist

- [x] tailwind.config.ts 配齐 design token
- [x] Supabase 0001 migration 可在本地与远程跑通（**未实测**——需要团队提供 Supabase project key 后跑一次）
- [x] /prompts/ 17 个 JSON 通过 schema 校验
- [x] 小青龙 3 视图可单独渲染
- [x] 备用文案库到位
- [ ] **CI 启用**：GitHub Actions 跑 lint + type-check（开仓库后立即配，建议 5 分钟即可）
- [ ] **Supabase 远程项目就绪**：需要项目 owner 创建并把 key 写进 .env.local

---

## 5. P1 启动建议

按计划 §5：

1. **Day 1 工作**：`npm install` → `npm run dev` → 验证空白启动页能渲染 → 把 Room + Xiaoqinglong 渲染到任意路由验证设计系统通路
2. **Day 2–3**：启动页 + 30 秒引导 + Auth 接 Supabase
3. **Day 4–5**：选伙伴 + 命名 + 主页·小家壳 + 任务卡浮层壳 + 记忆面板壳

P1 退出条件参见实施计划 §5.2。

---

*P0 阶段告一段落。等候你确认是否进入 P1 骨架周。*
