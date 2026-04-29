# Phase 1 骨架周 · 完成确认

**日期** 2026-04-29
**状态** 工程侧 100% · 运行时验证通过
**对应计划** [Home_MVP_Implementation_Plan_V0.1.md](Home_MVP_Implementation_Plan_V0.1.md) §5

---

## 1. 已交付

### 1.1 路由地图（15 个 + 1 个 not-found）

| 路由 | 文件 | 状态 |
|------|------|------|
| `/` 启动页 | [src/app/page.tsx](../src/app/page.tsx) | ✅ 真实装 |
| `/intro` 30 秒引导 | [src/app/intro/page.tsx](../src/app/intro/page.tsx) | ✅ 4 张卡片可滑动 |
| `/auth` 家长授权 | [src/app/auth/page.tsx](../src/app/auth/page.tsx) | ✅ LocalStorage stub |
| `/onboarding/choose` 选伙伴 | [src/app/onboarding/choose/page.tsx](../src/app/onboarding/choose/page.tsx) | ✅ 8 个真稿/占位 + 确认弹层 |
| `/onboarding/name` 命名 | [src/app/onboarding/name/page.tsx](../src/app/onboarding/name/page.tsx) | ✅ 输入框 + 默认名称 CTA |
| `/home` 主页·小家 | [src/app/home/page.tsx](../src/app/home/page.tsx) | ✅ HUD + 房间 + 对话 + 4 Tab + 路由守卫 |
| `/memory` 记忆面板 | [src/app/memory/page.tsx](../src/app/memory/page.tsx) | ✅ 4 区块 mock 数据 |
| `/memory/concept/[id]` 概念详情 | stub | P3 |
| `/memory/clarify/[id]` 澄清对话 | stub | P3 |
| `/capture` 拍照 | stub | P2 |
| `/answer` 文字回答 | stub | P2 |
| `/day7/worldview` 档案 | stub | P5 |
| `/day7/graduation` 毕业卡 | stub | P5 |
| `/parent` 家长中心 | [src/app/parent/page.tsx](../src/app/parent/page.tsx) | ✅ 模块清单 + 重置按钮（P6 实装真数据）|

### 1.2 通用组件

| 文件 | 用途 |
|------|------|
| [src/components/ui/MobileShell.tsx](../src/components/ui/MobileShell.tsx) | 视口锁 430px 居中 + iOS 9:41 状态栏 |
| [src/components/ui/Button.tsx](../src/components/ui/Button.tsx) | primary / ghost / amber / danger 4 变体 |
| [src/components/ui/StubPage.tsx](../src/components/ui/StubPage.tsx) | 占位页统一组件 |
| [src/components/nav/TopHUD.tsx](../src/components/nav/TopHUD.tsx) | 主页顶部进度 |
| [src/components/nav/BottomNav.tsx](../src/components/nav/BottomNav.tsx) | 4 Tab + 红点 + 任务徽章 |
| [src/components/speech/SpeechBubble.tsx](../src/components/speech/SpeechBubble.tsx) | 伙伴对话气泡（带尖角尾巴）|
| [src/components/task/TaskOverlay.tsx](../src/components/task/TaskOverlay.tsx) | 任务卡浮层 · 4 种交互区（photo/text/photo+text/choice/memory_review）|
| [src/components/memory/cards.tsx](../src/components/memory/cards.tsx) | ConceptCard / UncertainCard / SetAsideCard / UnknownCard / SectionHeader / PanelHeader |

### 1.3 状态与数据

| 文件 | 用途 |
|------|------|
| [src/types/index.ts](../src/types/index.ts) | 业务层全部类型（与 SQL schema 同源） |
| [src/stores/companionStore.ts](../src/stores/companionStore.ts) | user + companion + introCompleted；Zustand persist |
| [src/stores/uiStore.ts](../src/stores/uiStore.ts) | overlay + 红点；不持久化 |
| [src/lib/storage/local.ts](../src/lib/storage/local.ts) | LocalStorage adapter |
| [src/lib/companionPresets.ts](../src/lib/companionPresets.ts) | 客户端引用 prompts/shared/companions.json |
| [src/lib/tasks/index.ts](../src/lib/tasks/index.ts) | 7 天 TASKS 静态定义 |

---

## 2. 运行时验证

### 2.1 类型检查
```
npm run type-check  →  0 errors
```

### 2.2 路由 walk-through（dev server，端口 3030）
```
14 个路由全部 HTTP 200
启动页文案命中：Home / 给你最喜欢的玩具一个数字小家 / 开始
引导页文案命中：跳过引导 / 往下看 / 这里是 Home
选伙伴页：8 个伙伴名全部命中
记忆面板：4 个区块标题 + mock 数据正常渲染
```

### 2.3 Production build
```
✓ Compiled successfully in 2.3s
✓ Generating static pages (15/15)
First Load JS shared = 102 KB
最大单页 /home = 114 KB
```

---

## 3. P1 退出条件 checklist（对照计划 §5.2）

- [x] 用户从启动页一路点到主页（伙伴静态站立、空对话框、空任务卡）
- [x] 8 个伙伴可选可命名，进入主页时显示对应立绘
- [x] 路由刷新不丢，进度状态可读取（Zustand persist + LocalStorage）
- [x] 设计系统全 lint 通过
- [x] type-check 通过
- [x] production build 通过

---

## 4. P1 已知限制（预期，不算缺陷）

- 任务卡的"完成"按钮目前只关闭浮层，**不写后端**——P2 接 `/api/photo/upload` 与 `/api/text/submit`
- 伙伴对话是从 `personality_examples[0]` 取的固定文案，**不调 LLM**——P2 接 Pass 2
- 记忆面板内容是硬编 mock，**纠正动作只 console.log**——P3 接 `/api/memory/correct`
- 鉴权是 LocalStorage stub，刷新会保留但无 token 验证——P2 接 Supabase Auth
- 路由守卫在 SSR 时返回 null（客户端水合后再 redirect），SSR 时看到的是空白；这是 Next.js App Router + 客户端 store 的预期行为
- 7 个非小青龙伙伴还是占位剪影——等设计真稿到位后替换 `src/components/characters/Companion.tsx` 的 dispatch

---

## 5. 验证方法

```bash
PORT=3030 npm run dev
```

完整走查路径：

```
/ (启动页)
  ↓ 点「开始」
/intro (4 张卡片)
  ↓ 点 4 次「往下看」/「带它回家」
/auth (家长授权)
  ↓ 输入 13800000000 + 任意 6 位
/onboarding/choose (选伙伴)
  ↓ 选小青龙 → 确认
/onboarding/name (命名)
  ↓ 直接「就叫小青龙」
/home (主页·小家)
  ├ 点「今日任务」→ 任务卡浮层（拍照型）→ 跳过/完成 → 关闭
  ├ 点「它的脑袋」→ /memory（4 区块 + mock 卡片）
  ├ 点「日记」→ /parent（家长中心）
  └ 点「设置」→ /parent#settings
```

刷新任意页面 → Zustand 从 LocalStorage 恢复 → 不丢进度。

家长中心底部「清空并重新开始」按钮可一键重置整个流程，方便反复验证。

---

## 6. 下一步

进入 **Phase 2 · Day 1 端到端切片**（计划 §6），第 2 周。

P2 的关键工作：
- 拍照 → 上传 → Vision 分析（**MiniMax**）→ Pass 1（**DeepSeek**）→ Pass 2（**DeepSeek**）→ 主页反应
- 关键依赖：**Supabase 项目 key + DeepSeek API key + MiniMax API key**（开工前由你提供）

---

*P1 阶段告一段落。等候你确认是否进入 P2。*
