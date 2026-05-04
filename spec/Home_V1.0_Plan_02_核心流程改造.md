# Home V1.0 实施方案 · 第 2 份 · 核心流程改造

**版本** V0.1
**日期** 2026-05-03
**状态** 待决议
**对应 PRD** [Home_MVP_PRD_V1.0.md](Home_MVP_PRD_V1.0.md) §5–§10、§15–§18、§20
**前置依赖** [Plan_01 · 基础能力与数据层](Home_V1.0_Plan_01_基础能力与数据层.md) 完成

## 文档定位

本文档是 V1.0 实施方案的第二份，聚焦 **7 天主流程的前后端完整改造**：从语音录制到卡片确认的全链路 API 与前端实现，Day 1–7 每日任务编排，记忆面板交互升级，以及房间渲染切 cards。

## PRD 必读索引

> 实施本文档前，AI 必须阅读以下 PRD 章节。方案文档只做工程决策，细节原文在 PRD。

| PRD 章节 | 内容 | 用途 |
|---|---|---|
| §5.1–§5.6 | 7 天每日任务定义（主题、类型、输入方式、输出） | 每日任务文案原文 |
| §6.1–§6.7 | 描述卡片机制完整流程（生成、风格三层锁定、确认环节、修订、降级、视觉规格、描述长度处理） | 卡片交互时序、所有文案、重做次数规则 |
| §7.2–§7.10 | 语音输入设计（界面布局、权限引导、录制交互、ASR 错误处理、中转页、短描述引导） | 每个错误状态的精确文案、按钮尺寸、倒计时文案 |
| §8.1–§8.9 | 记忆面板（4 区块内容、概念卡形态、拿不准/放下/盲区交互、纠正动作） | 面板布局、各区块文案模板、纠正台词 |
| §15.1–§15.3 | 8 个预设伙伴（性格、语音特征、开场白） | 伙伴人格参数 |
| §16.1–§16.4 | 任务跳过机制（跳过逻辑、Day 5 特殊处理、累计影响） | 跳过按钮文案和逻辑 |
| §18.2–§18.5 | 文案设计（每日开场白、卡片相关文案、记忆面板文案） | 所有固定文案原文（30+ 条） |
| §20.1–§20.3 | 界面规范（布局、按钮、间距、动效） | 主页/任务/卡片确认/记忆面板的像素级规格 |

---

## 目录

1. 改造范围总览
2. 后端 API 改造
3. 前端页面实现
4. 核心组件设计
5. TaskOverlay 与任务系统改造
6. 记忆面板升级
7. 首页房间渲染
8. 状态管理
9. 自动化测试
10. 验收标准

---

## 1. 改造范围总览

### 1.1 V0.6.1 已有资产

| 模块 | 状态 |
|---|---|
| `processDescribe.ts` 编排 | 已实装（双路图像生成，无内容审核） |
| `VoiceRecorder.tsx` | 已实装 |
| `TranscriptionConfirm.tsx` | 已实装 |
| `CardConfirm.tsx` | 已实装 |
| `cardsRepo.ts` | 已实装 |
| ASR / 图像生成 / 风格审核客户端 | 已实装 |
| 记忆面板 4 区块 | 已实装 |

### 1.2 V1.0 变更点

| 变更 | 说明 |
|---|---|
| **图像生成串行化** | 去掉双路并行，主路通义万相 → 兜底 MiniMax |
| **内容审核接入** | 阿里云内容安全 + LLM Vision 双层审核 |
| **风格审核模型升级** | `qwen-vl-plus` → `qwen-vl-max` |
| **LLM 切换到 Claude** | 所有 Pass1/Pass2/keyword_extract 切换到 Claude Sonnet 4.5 |
| **等待文案随机化** | 每个伙伴 4 条变体（已实装，确认不变） |
| **记忆面板 source_type** | 新增 `direct`/`secondhand` 区分，二手信息标注来源 |
| **首页底部导航** | 毕业后新增「出门探索」按钮 |
| **Day 1–7 开场白** | Day 7 开场白改为固定文案（非 LLM 生成） |
| **卡片卡片右下角 ✏️ 标识** | 视觉标注「是描述生成的」 |

### 1.3 保留不变

- 语音录制交互（按住说话、松开停止）
- 麦克风权限引导流程
- 识别中转页编辑/重说/再加一段
- 卡片确认「就是这样」/「不太对」
- 修订流程（颜色不对/缺东西/整体重来 + 语音补充）
- 3 次重做上限 + 文字降级卡片
- 30s/90s/5min 无操作自动确认
- 跳过任务机制

---

## 2. 后端 API 改造

### 2.1 改造 API 清单

| 路由 | V0.6.1 状态 | V1.0 处理 |
|---|---|---|
| `POST /api/voice/upload` | 已实装 | **微调**：上传目标切 OSS，safety 过滤规则更新 |
| `POST /api/describe/submit` | 已实装 | **改造**：去双路并行，加内容审核，LLM 切 Claude |
| `POST /api/describe/revise` | 已实装 | **改造**：同上 |
| `POST /api/describe/confirm` | 已实装 | **微调**：LLM 切 Claude |
| `GET /api/companion/state` | 已实装 | **扩展**：加 station 解锁字段 |
| `POST /api/text/submit` | 已实装 | **不变**（仅 LLM 模型自动切换） |
| `POST /api/photo/upload` | 已 410 Gone | **不变** |
| `POST /api/dev/reset` | 已实装 | **扩展**：清空新增表 + OSS |

### 2.2 `POST /api/voice/upload` 微调

**变更点**：音频文件上传到 OSS 而非本地 `public/uploads_voice/`。

```
请求：multipart/form-data { audio: Blob, companion_id: string }

处理流程：
1. 校验 companion 存在 + audio MIME type
2. 保存临时本地文件（/tmp/<uuid>.webm）
3. 调 ASR → transcription
4. 过 safety/filters.ts
5. 上传到 OSS：uploads_voice/<companion_id>/<memory_id>.webm
6. 删除临时文件
7. 返回 { transcription, confidence, duration_seconds, voice_audio_url }

错误码（不变）：
- 200 成功
- 422 ASR 空
- 503 ASR 服务不可用
- 403 安全过滤
```

### 2.3 `POST /api/describe/submit` 改造

**变更点**：图像生成串行化 + 内容审核接入 + LLM 切 Claude。

```
请求：{
  companion_id, task_id, description_text,
  input_method: 'voice'|'text',
  voice_audio_url?, asr_transcription?, edited_text?
}

编排 (processDescribe.ts)：
1. 文本安全过滤 (safety/filters.ts)
2. 写 memories 行 (含 input_method, voice_audio_url 等)
3. 并行：Pass1 (归类) + keyword_extract
4. 拼接 stylePrompt：STYLE_PREFIX + prompt_content + STYLE_CONSTRAINTS
5. 图像生成（串行）：
   a. 主路：generateImageDashScope
   b. 失败 → 兜底：generateImageMiniMax
   c. 均失败 → is_fallback_text_card=true
6. 风格审核 (styleAudit)
   - severity=major → 自动重生成（最多 2 次）
   - 重生成均失败 → 文字降级卡片
7. 内容审核 (contentAudit) 【V1.0 新增】
   - 阿里云内容安全 API
   - LLM Vision 补充检查
   - 不通过 → 重生成（最多 2 次）
   - 仍不通过 → 文字降级卡片
8. 写 cards 表 (is_active=true)
9. 写 memory_bank（Pass1 结果）
10. Pass2 生成口语回应（含 keywords context）
11. 输出安全过滤
12. 写 conversations

响应：{
  card_id, image_url, is_fallback_text_card,
  style_check: { passed, regenerate_count, severity },
  content_audit: { passed, labels },    // V1.0 新增
  memory_update: { ... },
  companion_response
}
```

### 2.4 `POST /api/describe/revise` 改造

**变更点**：同 submit，图像生成串行化 + 内容审核接入。

```
请求：{ card_id, revision_type: 'color'|'missing'|'complete_redo', revision_text }

处理：
1. 校验 card 存在 + generation_attempt < 3
2. 当前 active card → is_active=false, child_action='rejected'
3. incrementMemoryRegenerateCount
4. 拼接修订描述：原描述 + '\n修订：' + revision_text
5. 跳过 Pass1（复用原归类），跑：
   - keyword_extract
   - 图像生成（串行）
   - 风格审核
   - 内容审核（V1.0 新增）
6. 写新 cards 行（generation_attempt+1, is_active=true）
7. attempt=4 → 写 fallback_text_card

响应：与 submit 同结构 + attempt: 2|3|4
```

### 2.5 `GET /api/companion/state` 扩展

**V1.0 新增字段**：

```json
{
  "companion": { "...", "visit_count": 0, "school_count": 0, "plaza_count": 0 },
  "today_card": { "id": "...", "image_url": "...", "is_active": true } | null,
  "cards": [{ "id": "...", "image_url": "...", "day": 1 }, ...],
  "station": {
    "friend_house_unlocked": false,
    "school_unlocked": false,
    "plaza_unlocked": false,
    "daily_departures_remaining": 1
  },
  "is_graduated": false,
  "current_day": 1
}
```

解锁逻辑（服务端计算）：
- `friend_house_unlocked`: `graduated_at IS NOT NULL`
- `school_unlocked`: `visit_count >= 2`
- `plaza_unlocked`: `school_count >= 1`
- `daily_departures_remaining`: `1 - (今日 trips WHERE trip_type IN ('visit','school','plaza') AND created_at >= today)`

### 2.6 `generateBothAndPersist` → `generateCard`

`processDescribe.ts` 内部函数改造：

```ts
// V0.6.1 双路并行
async function generateBothAndPersist(...) {
  const { dashscope, minimax } = await generateImagesParallel(...);
  // 写 cards 含 image_url + alt_image_url
}

// V1.0 串行单路 + 内容审核
async function generateCard(
  prompt: string,
  companionId: string,
  attempt: number,
): Promise<{ imageUrl: string | null; source: ImageSource; isFallback: boolean }> {
  // 主路
  let result = await generateImageDashScope({ prompt }, companionId);
  let source: ImageSource = 'dashscope';

  // 兜底
  if (!result) {
    result = await generateImageMiniMax({ prompt }, companionId);
    source = 'minimax';
  }

  // 全失败
  if (!result) {
    return { imageUrl: null, source: 'dashscope', isFallback: true };
  }

  // 内容审核
  const audit = await auditImageContent(result.imageUrl, companionId);
  if (!audit.passed && attempt < 3) {
    return null; // 触发重生成
  }
  if (!audit.passed) {
    return { imageUrl: null, source, isFallback: true };
  }

  return { imageUrl: result.imageUrl, source, isFallback: false };
}
```

---

## 3. 前端页面实现

### 3.1 页面路由清单

全部在 `src/app/describe/` 下。V1.0 在 V0.6.1 基础上微调，不新增 describe 页面。

| 路由 | 文件 | V0.6.1 | V1.0 变更 |
|---|---|---|---|
| `/describe/voice` | `page.tsx` | 已实装 | 切文字按钮视觉对齐 PRD §20.2 |
| `/describe/text` | `page.tsx` | 已实装 | 不变 |
| `/describe/permission` | `page.tsx` | 已实装 | 不变 |
| `/describe/confirm-text` | `page.tsx` | 已实装 | 不变 |
| `/describe/generating` | `page.tsx` | 已实装 | 等待文案已随机化（确认不变） |
| `/describe/confirm-card` | `page.tsx` | 已实装 | 卡片加 ✏️ 标识，确认按钮文案对齐 PRD |
| `/describe/revise` | `page.tsx` | 已实装 | 不变 |

### 3.2 `/describe/voice` 页面规格

**界面布局**（对齐 PRD §7.2 + §20.2）：

```
┌──────────────────────────────────────┐
│ ← 返回                               │
│                                      │
│  Day 1 · 告诉它你们最常呆的地方        │
│                                      │
│  ──────────────────────────          │
│                                      │
│  [伙伴形象，等待状态，300×400px]       │
│                                      │
│  「跟我说说那是什么样子？」            │
│                                      │
│                                      │
│        ┌──────────────┐              │
│        │              │              │
│        │     🎤        │              │  120×120px
│        │  按住说话      │              │  主色调 #BA7517
│        │              │              │
│        └──────────────┘              │
│                                      │
│  [⌨️ 用打字代替]    [跳过]            │
└──────────────────────────────────────┘
```

**交互动效**：
- 按下按钮：缩放 110% + 环形脉动（声波动画）
- 录音中：倒计时「还可以说 XX 秒」（最后 5 秒开始显示）
- 松开：按钮缩回 + 「我在听...」提示
- 识别中：伙伴形象切「思考」状态 + 逐字出现文字流

### 3.3 `/describe/generating` 页面规格

**等待叙事**（每个伙伴 4 条变体，3s/6s 切换）：

```
[伙伴「思考」状态]
  0s: 「让我想想你说的样子......」
  3s: 「我在用心画......」
  6s: 「快好了，再等等......」
```

文案变体已在 V0.6.1 的 `fallbacks.json` 中落实，V1.0 确认不变。

### 3.4 `/describe/confirm-card` 页面规格

**界面布局**（对齐 PRD §6.4）：

```
┌──────────────────────────────────────┐
│ ← 返回                               │
│                                      │
│  ┌────────────────────────────────┐ │
│  │                                │ │
│  │     [生成的纸片插画]            │ │  占屏 60%
│  │     300×300px                  │ │
│  │                                │ │
│  │                          ✏️    │ │  右下角 6px 标识
│  └────────────────────────────────┘ │
│                                      │
│  「你说的地方大概是这样的，对吗？」    │
│   ─ 来自小青龙                        │
│                                      │
│  ┌──────────┐         ┌──────────┐ │
│  │  不太对   │         │  就是这样 │ │
│  └──────────┘         └──────────┘ │
│  (次要按钮)            (主要按钮)    │
└──────────────────────────────────────┘
```

**V1.0 新增视觉元素**：卡片右下角 6px `✏️` 图标，暗示「是描述生成的」。

**无操作超时**：
- 30s → 伙伴气泡「看起来对吗？告诉我一声。」
- 90s → 「不点没关系，我等你。」
- 5min → 自动调 `/api/describe/confirm` (auto_timeout=true) → 跳主页

### 3.5 `/describe/revise` 页面规格

```
┌──────────────────────────────────────┐
│  [生成的卡片，缩小到 40%]              │
│                                      │
│  「哪里不对？告诉我，我重新画。」       │
│                                      │
│  ┌──────────────────────────────────┐│
│  │ □ 颜色不对                       ││
│  │ □ 缺了什么东西                   ││
│  │ □ 整体不对，重新来               ││
│  └──────────────────────────────────┘│
│                                      │
│         或者直接告诉它：              │
│                                      │
│        ┌──────────────┐              │
│        │     🎤        │              │
│        │  按住说话      │              │
│        └──────────────┘              │
└──────────────────────────────────────┘
```

三个选项提交时自动生成 revision_text：
- `颜色不对` → `revision_type='color', revision_text='请调整颜色'`
- `缺了什么东西` → `revision_type='missing', revision_text=''`（然后语音补充）
- `整体不对，重新来` → `revision_type='complete_redo', revision_text='请重新生成'`

---

## 4. 核心组件设计

### 4.1 VoiceRecorder

已实装，V1.0 不变。关键接口：

```ts
interface VoiceRecorderProps {
  maxDurationSec?: number;    // default 60
  minDurationSec?: number;    // default 1
  onComplete: (blob: Blob, durationMs: number) => void;
  onTooShort: () => void;
  onError?: (error: Error) => void;
}
```

### 4.2 TranscriptionConfirm

已实装，V1.0 不变。三个操作：
- `onEdit` → inline contentEditable
- `onRerecord` → 切回 `/describe/voice`
- `onAddMore` → 新录音追加（最多 3 段合并）

### 4.3 CardConfirm

已实装，V1.0 微调：加 ✏️ 标识。

```ts
interface CardConfirmProps {
  card: Card;
  imageUrl: string;
  isFallback: boolean;
  generationAttempt: number;
  onConfirm: () => void;
  onRevise: () => void;
}
```

### 4.4 FallbackTextCard（纯文字降级卡片）

已实装，V1.0 不变。

```
┌────────────────────────────────────┐
│  [白底 + 米黄边框]                  │
│                                    │
│  "我的卧室，有一张蓝色的床..."     │
│                                    │
│  「这次它脑子有点乱，画不出来。     │
│    但你说的它都记住了。」            │
│                                    │
│  [就是这样]                         │
└────────────────────────────────────┘
```

---

## 5. TaskOverlay 与任务系统改造

### 5.1 任务定义变更

`src/lib/tasks/index.ts` 中 Day 1–3 任务 `kind` 改为 `'describe'`（V0.6.1 已改），V1.0 确认不变。

```ts
export const TASKS: TaskDef[] = [
  { id: 'day1', day: 1, kind: 'describe', title: '搬家日', ... },
  { id: 'day2', day: 2, kind: 'describe', title: '这是我们家', ... },
  { id: 'day3', day: 3, kind: 'describe', title: '我们去过的地方', ... },
  { id: 'day4', day: 4, kind: 'text',      title: '我喜欢的事', ... },
  { id: 'day5', day: 5, kind: 'choice',    title: '它问你的问题', ... },
  { id: 'day6', day: 6, kind: 'memory_review', title: '打开它的脑袋', ... },
  // Day 7 无独立任务，由主页检测触发
];
```

### 5.2 TaskOverlay 分支逻辑（V0.6.1 已改，V1.0 确认）

```tsx
// src/components/task/TaskOverlay.tsx
switch (task.kind) {
  case 'describe':
    return <DescribeEntry task={task} onSkip={onSkip} />;
  case 'text':
    return <TextEntry task={task} onSkip={onSkip} />;
  case 'choice':
    return <ChoiceEntry task={task} onSkip={onSkip} />;
  case 'memory_review':
    return <MemoryReviewEntry task={task} onSkip={onSkip} />;
}
```

### 5.3 DescribeEntry 组件

```tsx
function DescribeEntry({ task, onSkip }: { task: TaskDef; onSkip: () => void }) {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center gap-6 p-6">
      <h2 className="text-[22px] font-medium text-[#2C2C2A]">{task.title}</h2>
      <p className="text-[16px] text-[#5F5E5A] text-center">{task.description}</p>

      <Button
        size="lg"
        className="w-full max-w-[320px] h-[120px] rounded-2xl bg-[#BA7517] text-white"
        onClick={() => router.push(`/describe/voice?task_id=${task.id}`)}
      >
        <MicIcon className="w-10 h-10" />
        <span className="mt-2 text-lg">按住说话</span>
      </Button>

      <Button variant="ghost" onClick={() => router.push(`/describe/text?task_id=${task.id}`)}>
        ⌨️ 用打字代替
      </Button>
      <Button variant="ghost" onClick={onSkip}>跳过</Button>
    </div>
  );
}
```

---

## 6. 记忆面板升级

### 6.1 V1.0 变更点

| 变更 | 说明 |
|---|---|
| 二手信息标注 | memory_bank 条目如果 `source_type='secondhand'`，展示来源伙伴名 |
| 信心度显示 | 根据 `confidence` 值显示对应提示（高/中/低） |

### 6.2 二手信息标记

朋友家拜访后带回的二手知识在记忆面板中展示为：

```
┌────────────────────────────────────┐
│  [图标]  钓鱼                  ⋮   │
│                                    │
│  我觉得这是一种在水边做的事。        │
│                                    │
│  我是从大熊那里听说的——             │  ← V1.0 新增
│  它说"钓鱼很好玩"。                 │
│  但我还不确定是不是真的。           │
│                                    │
│  [让它放下这件事]                   │
└────────────────────────────────────┘
```

### 6.3 信心度显示

```ts
function confidenceLabel(c: number): string {
  if (c >= 0.8) return '我很确定';
  if (c >= 0.5) return '我比较确定';
  if (c >= 0.3) return '我不太确定';
  return '我只是听说过';
}
```

二级信息默认 `confidence = 0.3`，标签为「我只是听说过」。

### 6.4 未知事物列表（第 4 块）

V1.0 新增 LLM 动态生成盲区列表（非静态词典）：

```ts
// src/lib/llm/unknownConcepts.ts（已实装）
// V1.0 不变：LLM 基于 COMMON_CONCEPTS 与 memory_bank 的差集生成
```

展示形态（对齐 PRD §8.7）：

```
┌────────────────────────────────────┐
│  🌫️ 我还不知道的事                  │
│                                    │
│  这些是常见的事，但你还没跟我说过：  │
│  · 公园    · 学校    · 爸爸         │
│  · 其他小朋友 · 运动  · 海边        │
│                                    │
│  你想告诉我哪一个？还是先不说？     │
└────────────────────────────────────┘
```

孩子点击「先不说」→ `correctMemory({ action: 'withhold' })`。

---

## 7. 首页房间渲染

### 7.1 从 photos → cards 切换

V0.6.1 已实现双源渲染（cards + photos），V1.0 确认以 cards 为主。

```tsx
// src/components/room/Room.tsx
// V1.0: CardSticker 替代 PhotoSticker（V0.6.1 已改）
function Room({ cards, companion }: RoomProps) {
  return (
    <div className="isometric-room">
      {cards.filter(c => c.is_active).map(card => (
        <CardSticker
          key={card.id}
          imageUrl={card.image_url}
          rotation={getRandomRotation(card.id)}
          isFallback={card.is_fallback_text_card}
        />
      ))}
      <CompanionSprite companion={companion} position="center" />
    </div>
  );
}
```

### 7.2 CardSticker 规格

```
尺寸：40 × 50px（含 4px 白边）
内层插画：32 × 32px
描边：0.8px #5F5E5A
旋转：随机 -10° ~ +10°
右下角：6px ✏️ 图标
最多展示：6 张（超出时最旧的飘落消失）
```

### 7.3 毕业后主页变化

V1.0 新增：毕业后主页底部增加「出门探索」按钮。

```
┌──────────────────────────────────────┐
│  [等距房间]                          │
│  [卡片贴纸 × N]  [伙伴在屋内]        │
│                                      │
├──────────────────────────────────────┤
│  ╔══════════════════════════════╗   │
│  ║  🚪 出门探索                  ║   │
│  ║  今天还可以出门 1 次           ║   │
│  ╚══════════════════════════════╝   │
│                                      │
│  [今日任务] [它的脑袋] [日记] [⚙]   │
└──────────────────────────────────────┘
```

「出门探索」按钮仅在 `is_graduated === true` 时显示。

---

## 8. 状态管理

### 8.1 companionStore 扩展

```ts
// src/stores/companionStore.ts
interface CompanionStore {
  // 已有
  companion: Companion | null;
  inputPreference: 'voice' | 'text';
  micPermission: 'granted' | 'denied' | 'prompt';
  
  // V1.0 新增
  station: StationState;
  isGraduated: boolean;

  // 已有方法
  setInputPreference: (p: 'voice' | 'text') => void;
  markMicDenied: () => void;
  markMicGranted: () => void;
  
  // V1.0 新增方法
  refreshCompanionState: () => Promise<void>;
}

interface StationState {
  friendHouseUnlocked: boolean;
  schoolUnlocked: boolean;
  plazaUnlocked: boolean;
  dailyDeparturesRemaining: number;
}
```

`refreshCompanionState` 从 `GET /api/companion/state` 拉取全量状态（含 station 字段）。

### 8.2 页面间数据传递

所有 describe 页面间通过 query 参数传递：
- `task_id` — 任务标识
- `memory_id` — 记忆 ID（generating 之后）
- `card_id` — 卡片 ID（confirm-card 之后）

避免 store 状态在路由间丢失。

---

## 9. 自动化测试

### 9.1 E2E Spec 清单

V1.0 需新增/保持以下 E2E spec（V0.6.1 已部分实装，V1.0 验证通过）：

| Spec 文件 | 场景 | 状态 |
|---|---|---|
| `p0-describe-voice.spec.ts` | 语音录制 → ASR 中转 → 卡片确认 → 主页贴纸 | V0.6.1 已有，V1.0 验证 |
| `p0-describe-text.spec.ts` | 文字模式提交 → 卡片确认 | 同上 |
| `p0-card-revise.spec.ts` | 不太对 → 颜色不对补充 → 重生成 → 确认 | 同上 |
| `p1-mic-denied.spec.ts` | 拒绝麦克风权限 → 自动回退到文字 | 同上 |
| `p1-asr-fail.spec.ts` | ASR 失败 → 提示切文字 | 同上 |
| `p1-card-regen-fail.spec.ts` | 风格审核连续失败 → 文字降级卡片 | 同上 |
| `p1-card-no-action.spec.ts` | 5 分钟无操作 → 自动确认 | 同上 |
| `p1-content-audit-block.spec.ts` | 内容审核拦截 → 重生成 → 降级 | **V1.0 新增** |

### 9.2 新增 content audit E2E

```ts
// tests/e2e/p1-content-audit-block.spec.ts
test('content audit blocks inappropriate image and falls back', async ({ page }) => {
  // Mock 图像生成返回违规图
  await page.evaluate(() => {
    window.__testMocks.contentAudit = { passed: false, labels: ['violence'] };
  });

  // 完成语音 → 提交 → 等待卡片
  // 期望：重生成一次，仍被拦截 → 显示文字降级卡片
  await expect(page.getByText('这次它脑子有点乱')).toBeVisible();
});
```

### 9.3 API Spec 清单

| Spec 文件 | 路由 | 状态 |
|---|---|---|
| `voice-upload.spec.ts` | `/api/voice/upload` | V0.6.1 已有 |
| `describe-submit.spec.ts` | `/api/describe/submit` | 同上，V1.0 加 content_audit 断言 |
| `describe-revise.spec.ts` | `/api/describe/revise` | 同上 |
| `describe-confirm.spec.ts` | `/api/describe/confirm` | 同上 |
| `companion-state.spec.ts` | `/api/companion/state` | V1.0 新增 station 字段断言 |

---

## 10. 验收标准

### 10.1 前后端联调

- [ ] `POST /api/voice/upload`：真实录音 → ASR → OSS 上传 → 返回 transcription + voice_audio_url
- [ ] `POST /api/describe/submit`（mock 模式）：完整链路通过（Pass1 + keyword + 图像 + style audit + content audit + Pass2），DB 中 memories / cards / memory_bank / conversations 均有正确写入
- [ ] `POST /api/describe/submit`（真实 Claude + 通义万相）：生成真实卡片图片，风格审核通过
- [ ] `POST /api/describe/revise`：修订后 generation_attempt 递增，旧 card is_active=false
- [ ] `POST /api/describe/confirm`：确认后 card child_action='confirmed'
- [ ] `GET /api/companion/state`：返回 station 解锁状态正确（毕业后 friend_house_unlocked=true）
- [ ] 内容审核拦截场景：违规图 → 重生成 → 仍违规 → 文字降级卡片

### 10.2 前端联调

- [ ] 真机（iOS Safari + Android Chrome）跑通：TaskOverlay → /describe/voice → 录音 → /describe/confirm-text → 编辑 → /describe/generating → /describe/confirm-card → 点「就是这样」→ 主页墙上出现卡片
- [ ] 「不太对」→ revise → 颜色不对/缺东西/整体重来 → 重生成 → 重新确认
- [ ] 麦克风拒绝 → 自动切 /describe/text
- [ ] 文字模式直接输入提交 → 卡片生成
- [ ] 30s/90s 无操作提示 → 5min 自动确认
- [ ] 房间墙上卡片正确渲染（CardSticker 带随机旋转 + ✏️ 标识）
- [ ] 记忆面板中二手信息标注来源（需要先有驿站数据，Plan_03 后验证）

### 10.3 视觉对齐

- [ ] 语音按钮 120×120px，主色 `#BA7517`
- [ ] 卡片右下角 6px ✏️ 标识可见
- [ ] CardSticker 40×50px，4px 白边，随机旋转 -10°~+10°
- [ ] 等待页文案 3 段切换正常
- [ ] 「就是这样」在主操作位（右），「不太对」在次要位（左）

### 10.4 测试

- [ ] `npm run test:p0` 全绿（mock 模式）
- [ ] 所有 describe 相关 E2E spec 通过

---

*文档结束*
