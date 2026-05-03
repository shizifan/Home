# Home V0.6.1 实施方案

**版本** V0.2  
**日期** 2026-04-30  
**状态** 已决议，待开工  
**对应 PRD** [Home_MVP_PRD_V0.6.1.md](Home_MVP_PRD_V0.6.1.md)  
**起点工程** P0 + P1 已完成，主流程基于 V0.5（拍照上传 + Vision 分析）

## 版本历史

| 版本 | 日期 | 修订说明 |
|---|---|---|
| V0.1 | 2026-04-30 | 初稿，含 13 项待决议 |
| V0.2 | 2026-04-30 | 根据决议收敛：阿里系全栈 / 长按说话 + 必须手动确认中转页 / 不做灰度开关 / 不做语音文件保留期管理 / 上线前硬性测试推迟 |

## 已确认决议（V0.2 收敛）

- **A · 服务商**：全部使用阿里系 — ASR 用 Paraformer，图像生成用通义万相 v2，风格审核用通义千问-VL
- **B1 · 录音交互**：按住说话，松开自动停止
- **B4 · 中转页**：必须手动确认，不做自动跳过
- **C5 · 灰度开关**：不做，直接全量切到 describe 流程
- **C6 · 语音文件保留期**：不做定时清理，仅 `dev/reset` 时一并清空
- **D · 上线前测试要求**：当前不考虑上线，PRD §23.1 风险类硬性指标推迟到上线前再做
- **E · 设计资产**：design 目录已有 paper-flat 视觉规格（PhotoSticker / Room SVG），但无专门给通义万相参考图功能用的基准图；P6.1 阶段先 zero-shot 启动，从通义万相生成的测试图中挑选 3 张作为后续调用的参考图

剩余待决议（在对应章节标 ⚠️）：B2 「再加一段」/ B3 「5 分钟自动确认」

---

## 目录

1. 变更总览
2. V0.5 → V0.6.1 差异对照
3. 影响面盘点
4. 数据模型迁移
5. 新增基础能力
6. 后端 API 改造
7. 前端改造
8. Prompt 资产新增与修订
9. 安全与审核链路
10. Mock 与自动化测试影响
11. 分阶段落地计划
12. 兼容与回退策略
13. 待决议项

---

## 1. 变更总览

V0.6.1 相较当前工程引入两条主线变化：

**主线 A · 输入方式：拍照 → 语音描述**

孩子原本上传一张照片由 Vision 模型解析成 `vision_tags`，现在改为按住语音按钮口述场景，ASR 转文字 → 中转页编辑确认 → 提交描述。文字输入作为辅助路径保留。

**主线 B · 视觉产物：照片 → AI 生成纸片插画卡片**

孩子描述提交后，后端基于关键词提取生成纸片马里奥风格插画，经过风格审核 + 内容审核两层把关后展示。孩子需主动点「就是这样」/「不太对」，「不太对」进入修订流程，最多重做 3 次后兜底为纯文字卡片。

由这两条主线衍生的工程影响：

- 6 个新页面 + 2 个新底层组件（VoiceRecorder / CardConfirm）
- 4 个新 API + 改造 3 个 API + 废弃 1 个 API
- 5 个新 Prompt 模板（关键词提取 / 风格审核 / 短描述追问 / 卡片确认台词 / Pass2 修订）
- DB schema：`memories` 表新增 5 字段 + 新增 `cards` 表
- LLM 调用类型从 5 个增加到 8 个
- 单用户成本从 ¥2.0 → ¥3.0
- 自动化测试增加 ASR / 图像生成 / 风格审核三个 mock 注入点

---

## 2. V0.5 → V0.6.1 差异对照

### 2.1 数据流对照

| 环节 | V0.5（当前实现）| V0.6.1（目标）|
|---|---|---|
| 输入 | `<input type="file">` 上传图片 | `<button>` 按住录音 → ASR |
| 中间产物 | `vision_tags`（DashScope Qwen-VL）| `asr_transcription` + `edited_text` |
| 主成果物 | `memories.photo_url` 原图 | `cards.image_url` 生成插画 |
| LLM Pass1 输入 | `vision_tags + user_text` | `description_text` |
| Pass1 输出 | 不变 | 不变 |
| Pass2 输入 | 不变 | 含 input_method 标识 |
| 房间贴纸 | 真实照片缩略 | 纸片插画卡片 |
| 毕业卡墙贴 | 真实照片 | 纸片插画卡片 |
| 用户确认 | 隐式（提交即视为认可）| 显式（必须点「就是这样」）|

### 2.2 任务类型对照

| 天 | 当前 `kind` | V0.6.1 `kind` | 备注 |
|---|---|---|---|
| Day 1 | `photo` | `describe` | 主输入语音 |
| Day 2 | `photo_text` | `describe`（含附加文字介绍）| 主输入语音 + 一段文字附言 |
| Day 3 | `photo_text` | `describe`（同上）| 同上 |
| Day 4 | `text` | `text`（语音可选）| 描述任务的退化形态 |
| Day 5 | `choice` | `choice` | 不变 |
| Day 6 | `memory_review` | `memory_review` | 不变 |
| Day 7 | `memory_review` | `memory_review` | 不变 |

### 2.3 路由对照

| 路由 | V0.5 状态 | V0.6.1 处理 |
|---|---|---|
| `/api/photo/upload` | 实装 | **废弃**（保留兼容期 30 天）|
| `/api/text/submit` | 实装 | **改造**：Day4 等纯文字任务复用 |
| `/api/voice/upload` | — | **新增** |
| `/api/describe/submit` | — | **新增** |
| `/api/describe/revise` | — | **新增** |
| `/api/describe/confirm` | — | **新增** |
| `/capture`（前端 stub） | stub | **删除** |
| `/answer`（前端 stub） | stub | **删除** |
| `/describe/voice` | — | **新增** |
| `/describe/text` | — | **新增** |
| `/describe/confirm-text` | — | **新增** |
| `/describe/generating` | — | **新增** |
| `/describe/confirm-card` | — | **新增** |
| `/describe/revise` | — | **新增** |

### 2.4 LLM 调用类型对照

| callType | V0.5 | V0.6.1 |
|---|---|---|
| `pass1` | 归类（vision_tags + text）| 归类（description_text）|
| `pass2` | 口语回应 | 口语回应（含语音/长短描述提示）|
| `concept_detail` | 不变 | 不变 |
| `correction` | 不变 | 不变 |
| `day7` | 不变 | 不变 |
| `keyword_extract` | — | **新增**：从描述提取图像 Prompt 元素 |
| `style_audit` | — | **新增**：判断生成图是否纸片马里奥风 |
| `card_confirm_reply` | — | **新增**：基于卡片细节生成确认台词（也可并入 Pass2）|
| `short_describe_followup` | — | **新增**：短描述追问语 |

按照 V0.6.1 §5.4 成本估算，新增 4 类调用单用户合计约 ¥0.85 增量。

---

## 3. 影响面盘点

### 3.1 保留不动的部分

- `companions` 表与 `companion_presets`（8 个伙伴定义不变）
- `memory_bank` 表结构与 4 区块逻辑（PRD §6 V0.5 章节）
- 记忆面板交互（`/memory` 路由及子页面，PRD §6 V0.6.1 无结构变化）
- Day 7 档案生成（除引用文字源改为 `description_text`）
- 跳过任务机制（PRD §15 不变）
- 安全过滤层 `src/lib/safety/filters.ts`
- 已落地的所有自动化测试基础设施（仅需补充新 mock 与 spec）

### 3.2 重大改造的部分

| 模块 | 当前文件 | 改造说明 |
|---|---|---|
| Orchestration | `src/lib/orchestrate/processInput.ts` | 拆出 `processDescribe.ts`，`processInput` 仅服务于纯文字与 choice |
| TaskOverlay | `src/components/task/TaskOverlay.tsx` | photo/photo_text 分支整体替换为「跳转到 `/describe/voice`」|
| Tasks 定义 | `src/lib/tasks/index.ts` | `kind` 加入 `describe`，`charLimit` 等字段保留给附加文字 |
| 类型定义 | `src/types/index.ts` | `MemoryInputType` 加 `'voice'`，`TaskKind` 加 `'describe'` |
| 房间渲染 | `src/components/room/Room.tsx` | `PhotoSticker` 接受卡片插画 URL（已是 SVG/img URL，改个 prop 即可）|

### 3.3 新增模块

| 模块 | 路径 | 用途 |
|---|---|---|
| ASR client | `src/lib/asr/client.ts` | 阿里云 Paraformer 调用封装 |
| 图像生成 client | `src/lib/imagegen/client.ts` | 通义万相 / MiniMax Image 调用封装 |
| 风格 Prompt 常量 | `src/lib/imagegen/stylePrompt.ts` | 工程化锁定的纸片风前缀 |
| 风格审核 | `src/lib/imagegen/styleAudit.ts` | LLM Vision 审核 |
| 关键词提取 | `src/lib/llm/keywordExtract.ts` | 描述 → 图像 Prompt 内容 |
| Voice Recorder 组件 | `src/components/voice/VoiceRecorder.tsx` | 按住录音 + 声波动画 + 倒计时 |
| ASR 中转页 | `src/components/voice/TranscriptionConfirm.tsx` | 编辑/重说/再加一段 |
| 卡片确认组件 | `src/components/card/CardConfirm.tsx` | 「不太对」/「就是这样」+ 修订选项 |
| Card repo | `src/lib/db/cardsRepo.ts` | cards 表 CRUD |
| Describe orchestration | `src/lib/orchestrate/processDescribe.ts` | ASR 后的端到端编排 |

### 3.4 废弃/下线

- `/api/photo/upload`：保留路由文件 30 天，路由内部直接 410 Gone + 提示文案，metrics 监控真实流量降为 0 后删除
- `/capture`、`/answer` 两个前端 stub：直接删除，路由命中走 not-found
- `src/lib/vision/client.ts`：DashScope Vision 客户端不再被调用，但保留供未来图像分析（如家长端用）；标注 `@deprecated for child describe flow`
- `tests/fixtures/images/*.jpg`：改为纸片风格基准参考图，prompt 同步更新

---

## 4. 数据模型迁移

### 4.1 schema 变更（`db/migrations/0002_describe_card.sql`）

```sql
-- 4.1.1 memories 新增字段
alter table memories
  add column input_method varchar(20) not null default 'photo',
  add column voice_audio_url text,
  add column asr_transcription text,
  add column edited_text text,
  add column regenerate_count int not null default 0;

-- 历史数据：已有的 photo 记录 input_method 默认填 'photo'，新写入按实际填入
update memories set input_method = type where input_method = 'photo' and type != 'photo';

-- 4.1.2 type 字段扩容（加入 'voice' / 'describe'）
alter table memories drop check chk_memories_type;
alter table memories add constraint chk_memories_type
  check (type in ('photo','text','choice','skipped','voice','describe'));

-- 4.1.3 新增 cards 表
create table if not exists cards (
  id char(36) primary key,
  memory_id char(36) not null,
  companion_id char(36) not null,

  image_url text,
  image_prompt text,
  raw_keyword_extract json,

  style_check_passed tinyint(1),
  style_check_severity varchar(20),     -- 'ok' | 'minor' | 'major'
  style_check_issues json,

  generation_attempt int not null default 1,
  is_active tinyint(1) not null default 0,
  is_fallback_text_card tinyint(1) not null default 0,

  child_action varchar(20),             -- 'confirmed' | 'rejected' | 'no_action_timeout'
  confirmed_at datetime(3),

  created_at datetime(3) default current_timestamp(3),
  key idx_cards_memory (memory_id),
  key idx_cards_active (memory_id, is_active),
  constraint fk_cards_memory foreign key (memory_id) references memories(id) on delete cascade,
  constraint fk_cards_companion foreign key (companion_id) references companions(id) on delete cascade,
  constraint chk_cards_attempt check (generation_attempt between 1 and 4)
) engine=innodb default charset=utf8mb4 collate=utf8mb4_unicode_ci;
```

### 4.2 兼容窗口

- 旧 `memories.photo_url` 字段保留，对应历史 V0.5 数据；V0.6.1 新写入数据 `photo_url=null`，靠 `cards.image_url` 渲染
- `vision_tags` 字段保留，新数据为 null
- `dev/reset` 端点同步删除 `cards` 表数据

### 4.3 类型同步

```ts
// src/types/index.ts 新增/修改
export type MemoryInputType = 'photo' | 'text' | 'choice' | 'skipped' | 'voice' | 'describe';
export type TaskKind = 'describe' | 'text' | 'choice' | 'memory_review';

export interface Card {
  id: string;
  memory_id: string;
  companion_id: string;
  image_url: string | null;
  image_prompt: string;
  style_check_passed: boolean;
  style_check_severity: 'ok' | 'minor' | 'major' | null;
  style_check_issues: string[];
  generation_attempt: 1 | 2 | 3 | 4;
  is_active: boolean;
  is_fallback_text_card: boolean;
  child_action: 'confirmed' | 'rejected' | 'no_action_timeout' | null;
  confirmed_at: string | null;
  created_at: string;
}
```

---

## 5. 新增基础能力

### 5.1 ASR Client（`src/lib/asr/client.ts`）

**确定**：阿里云 Paraformer（DashScope）。与现有 vision client 共用 `DASHSCOPE_API_KEY`，`recognizeFile` 接受本地文件路径，返回识别结果。

```ts
// 关键签名
export interface ASRResult {
  transcription: string;
  confidence: number;
  duration_seconds: number;
}

export async function recognizeAudioFile(
  filePath: string,
  options?: { language?: 'zh-CN'; punctuation?: boolean },
): Promise<ASRResult | null>;
```

错误处理：
- 超时（>10s）→ 返回 null，调用方走"切换到文字输入"提示
- 服务报错 → 同上
- 识别为空字符串 → 返回 null
- 含敏感词（先过 `safety/filters.ts`）→ 返回 null + reason='safety'

环境变量：

```env
# 复用现有 DashScope 凭据
DASHSCOPE_API_KEY=
DASHSCOPE_ASR_MODEL=paraformer-realtime-v2   # 或 paraformer-v2 离线版
DASHSCOPE_ASR_BASE_URL=wss://dashscope.aliyuncs.com/api-ws/v1/inference
# TEST_LLM_MODE=mock 时跳过真实调用
```

> Paraformer v2 走 WebSocket 流式接口，需要在 `client.ts` 内自实现 ws 连接（`ws` 包，已是依赖间接引入）。MVP 简化版可先跑非流式 HTTP 接口，用户体验影响在 1–2 秒内。

`TEST_LLM_MODE=mock` 时返回：

```ts
{ transcription: '我的卧室，有一张蓝色的床，窗外能看到大树。', confidence: 0.95, duration_seconds: 8.3 }
```

### 5.2 图像生成 Client（`src/lib/imagegen/client.ts`）

```ts
export interface ImageGenInput {
  prompt: string;          // 已含风格前缀
  referenceImageUrl?: string;  // 第二层风格锁定
  size?: '512x512' | '768x768';
}
export interface ImageGenResult {
  imageUrl: string;
  rawResponse: unknown;
  latencyMs: number;
}
export async function generateImage(input: ImageGenInput): Promise<ImageGenResult | null>;
```

**确定**：通义万相 v2（DashScope）。复用 `DASHSCOPE_API_KEY`。

参考图策略（PRD §4.4.3）：
- design 目录现有 paper-flat 风格规格但无专门基准图
- **P6.1 启动方案**：zero-shot 模式（不带参考图）启动，对 PRD §4.9 的 10 个测试场景跑一轮生成
- **P6.6 调优阶段**：从 zero-shot 结果中人工挑选 3 张最佳作为基准图，存入 `public/style-references/`：`indoor_room.png` / `outdoor_place.png` / `people_with_env.png`
- 关键词提取阶段返回 `scene_type`，`generateImage` 根据 scene_type 选对应基准图 URL；zero-shot 期间该参数留空

环境变量：

```env
DASHSCOPE_API_KEY=                                    # 与 LLM/Vision/ASR 共用
DASHSCOPE_IMAGEGEN_MODEL=wanx-v1                      # 或 wanx2.1-t2i-turbo
DASHSCOPE_IMAGEGEN_BASE_URL=https://dashscope.aliyuncs.com/api/v1
```

### 5.3 风格 Prompt 常量（`src/lib/imagegen/stylePrompt.ts`）

```ts
export const STYLE_PREFIX = `
【风格】
纸片扁平插画风格，Paper Mario 视觉风格。
所有元素扁平化、单层色块、带 1.5-2px 白色描边模拟纸片厚度。
等距视角（isometric），约 30 度俯视。
温暖米黄色背景（#FAEEDA）。
色彩饱和度中等，不要鲜艳荧光色。
没有阴影、没有渐变、没有写实质感、没有 3D 渲染。
所有物品像剪纸一样有清晰的白边。
`.trim();

export const STYLE_CONSTRAINTS = `
【约束】
不出现真实人物面孔（用纸片简笔人物代替）。
不出现任何文字、logo、品牌。
画面简洁，单一主场景。
不出现恐怖、暴力、血腥、成人暗示元素。
`.trim();

export function buildImagePrompt(content: string): string {
  return `${STYLE_PREFIX}\n\n【内容】\n${content}\n\n${STYLE_CONSTRAINTS}`;
}
```

PR review 强制：任何修改 `STYLE_PREFIX` 或 `STYLE_CONSTRAINTS` 的 PR 必须有设计 + 产品双签。CI 加一条 `git diff --quiet src/lib/imagegen/stylePrompt.ts` 的告警检查（仅告警，不阻塞）。

### 5.4 风格审核（`src/lib/imagegen/styleAudit.ts`）

调用 `callLLM` 新 callType `style_audit`：

```ts
export interface StyleAuditResult {
  style_match: boolean;
  issues: string[];
  severity: 'ok' | 'minor' | 'major';
}
export async function auditImageStyle(imageUrl: string): Promise<StyleAuditResult>;
```

**确定**：通义千问-VL（`qwen-vl-plus` 或 `qwen-vl-max`，复用现有 vision client 配置）。Prompt 见 PRD §16.1，温度 0.1。

`TEST_LLM_MODE=mock` 时返回 `{ style_match: true, issues: [], severity: 'ok' }`。

### 5.5 关键词提取（`src/lib/llm/keywordExtract.ts`）

新 callType `keyword_extract`，输入孩子描述，输出图像生成所需的内容片段：

```ts
export interface KeywordExtractOutput {
  scene_type: 'indoor_room' | 'outdoor_place' | 'people_with_env' | 'object_focus';
  main_subjects: string[];           // 最多 3 个核心意象
  visual_attributes: string[];       // 颜色 / 材质 / 大小
  atmosphere: string;                // 氛围描述
  prompt_content: string;            // 拼好的【内容】段
  excluded_details: string[];        // 显式告诉孩子省略了什么（>200字时）
}
```

预处理（代码层）：
1. 去除 ASR 常见错误（小词典 `prompts/shared/asr_corrections.json`）
2. 去除语气词
3. 长度截断（>500 字截到核心 300 字，记录被截断的部分）

`TEST_LLM_MODE=mock` 返回：

```ts
{
  scene_type: 'indoor_room',
  main_subjects: ['蓝色的床', '窗户', '大树'],
  visual_attributes: ['蓝色', '木质'],
  atmosphere: '温馨',
  prompt_content: '一张蓝色的床，窗户外能看到一棵大树，温馨的卧室场景',
  excluded_details: [],
}
```

---

## 6. 后端 API 改造

### 6.1 `POST /api/voice/upload`（新增）

请求：`multipart/form-data`，含 `audio` 文件 + `companion_id`。

服务端串行：
1. 校验 companion 存在且 audio mimeType ∈ {audio/webm, audio/mp4, audio/wav}
2. 保存到 `public/uploads_voice/<companion_id>/<timestamp>.webm`
3. 调 ASR
4. 过敏感词过滤
5. 返回 `{ transcription, confidence, duration_seconds, voice_audio_id }`

响应：
- `200` 成功 → 返回结构同上
- `422` ASR 空 → `{ error: 'asr_empty', message: '我没听清，再说一次？' }`
- `503` ASR 服务超时/报错 → `{ error: 'asr_unavailable', message: '网络好像有点慢，要不先打字试试？' }`
- `403` 安全过滤命中 → `{ error: 'asr_safety_block', message: '我没太听明白，要不换个说法？' }`

### 6.2 `POST /api/describe/submit`（新增）

请求：

```json
{
  "companion_id": "...",
  "task_id": "...",
  "description_text": "...",
  "input_method": "voice" | "text",
  "voice_audio_id": "..." 
}
```

编排（`processDescribe.ts`）：
1. 写 `memories` 行（含 `input_method`, `voice_audio_url`, `asr_transcription`, `edited_text`）
2. 并行触发：
   - LLM Pass1（归类）
   - LLM 关键词提取
3. 拼接 `STYLE_PREFIX + content + STYLE_CONSTRAINTS`
4. 调 `generateImage`（含参考图）
5. 风格审核 → severity=major 自动重生成（最多 2 次，写入 `cards` 表 generation_attempt 1/2/3）
6. 内容审核（图像安全 API）
7. 重生成全失败 → 写入 `is_fallback_text_card=true` 的卡片记录
8. 写 `memory_bank`（与 V0.5 流程一致）
9. LLM Pass2 生成口语回应
10. 写 `conversations`

响应：

```json
{
  "card_id": "...",
  "image_url": "...",
  "is_fallback_text_card": false,
  "style_check": { "passed": true, "regenerate_count": 0, "severity": "ok" },
  "memory_update": {...},
  "companion_response": "..."
}
```

整体 SLA：p50 ≤ 10s，p95 ≤ 18s（含图像生成）。超过 20s 客户端显示 timeout 提示并提供重试。

### 6.3 `POST /api/describe/revise`（新增）

请求：

```json
{
  "card_id": "...",
  "revision_type": "color" | "missing" | "complete_redo",
  "revision_text": "..."
}
```

服务端：
1. 校验 `card_id` 存在 + 关联 memory 的 generation_attempt < 3
2. 把当前 active card 设为 `is_active=false`，`child_action='rejected'`
3. 拼接修订描述：`原描述 + '修订：' + revision_text`
4. **跳过 Pass1**（复用原有归类，不重写 memory_bank），重新跑：
   - 关键词提取
   - 图像生成
   - 风格审核
5. 写新 cards 行（generation_attempt+1，is_active=true）
6. 返回与 `submit` 相同结构 + 增加 `attempt: 2 | 3` 字段
7. attempt=4 时直接写 fallback 文字卡片，并在响应中返回 PRD §4.6.5 第 3 次失败的台词

### 6.4 `POST /api/describe/confirm`（新增）

请求：

```json
{ "card_id": "..." }
```

服务端：
1. 把 card 设为 `child_action='confirmed'`, `confirmed_at=now()`
2. LLM `card_confirm_reply`（也可以并入 Pass2 流程，详见 §8.5）
3. 返回 `{ companion_final_response: "...", memory_bank_updated: true }`

「30秒/90秒提示 + 5分钟自动确认」逻辑由前端定时器实现，前端 5 分钟后调相同接口加 `auto_timeout: true` 标识，服务端写 `child_action='no_action_timeout'`。

### 6.5 改造 `/api/text/submit`

Day4 / 选择题等纯文字任务复用现有路由。修改点：
- 接受可选字段 `input_method: 'voice' | 'text'`（语音转文字也可走此路由，而非 describe submit，因为不生成卡片）
- 路由内部 `input_type` 对应写 `'voice'` 或 `'text'`

### 6.6 废弃 `/api/photo/upload`

直接修改 route.ts：

```ts
export async function POST() {
  return NextResponse.json(
    { error: 'deprecated', message: '此接口已下线，请使用 /api/describe/submit' },
    { status: 410 },
  );
}
```

保留 30 天后整体删除文件 + 自动化测试中相关 spec。

### 6.7 `/api/companion/state` 改造

返回结构补充：

```json
{
  ...
  "today_card": { "id": "...", "image_url": "...", "is_active": true } | null,
  "cards": [{ "id": "...", "image_url": "...", "day": 1 }, ...],
  "input_preference": "voice" | "text"  // 来自 user 设置（V0.6.1 简化：localStorage）
}
```

`photos` 字段保留但可标 deprecated；前端房间渲染读 `cards`。

---

## 7. 前端改造

### 7.1 新增页面

所有页面在 `src/app/describe/` 下，使用 Next.js 路由组：

| 路由 | 文件 | 主要交互 |
|---|---|---|
| `/describe/voice` | `src/app/describe/voice/page.tsx` | 大语音按钮 + 切文字按钮 + 跳过 |
| `/describe/text` | `src/app/describe/text/page.tsx` | 文字框 + 切语音按钮 + 提交 |
| `/describe/permission` | `src/app/describe/permission/page.tsx` | 麦克风权限预告（弹窗形态，但用独立路由便于深链测试）|
| `/describe/confirm-text` | `src/app/describe/confirm-text/page.tsx` | ASR 中转：编辑/重说/再加一段/确认 |
| `/describe/generating` | `src/app/describe/generating/page.tsx` | 等待动效 + 叙事化文案 |
| `/describe/confirm-card` | `src/app/describe/confirm-card/page.tsx` | 卡片展示 + 不太对/就是这样 |
| `/describe/revise` | `src/app/describe/revise/page.tsx` | 三个常见原因 + 语音补充 |

整体串联通过 query 参数传 `card_id` / `memory_id` / `task_id`，避免 store 状态在路由间丢失。

### 7.2 核心组件

#### `VoiceRecorder.tsx`

```ts
interface Props {
  maxDurationSec?: number;   // default 60
  minDurationSec?: number;   // default 1
  onComplete: (blob: Blob, durationMs: number) => void;
  onTooShort: () => void;
}
```

- 使用 `MediaRecorder` API + `AudioContext` 做音量分析（声波动画）
- 长按触发录音，松开停止
- 接近上限 5s 提示「还可以说 5 秒…」（PRD §13.1 文案）
- 录音中按钮缩放 110% + 音量脉动外圈
- 触觉反馈：`navigator.vibrate(50)`（按下时）

权限处理：
- 第一次调 `getUserMedia` 前先 push `/describe/permission`
- 拒绝后导航 `/describe/text` 并 store 标记 `mic_denied=true`
- 后续 home 页语音入口仍可见，点击时再次引导

#### `TranscriptionConfirm.tsx`

控制三个动作：
- 编辑（inline `contentEditable`）
- 重说（清空文字 + 切回 `/describe/voice`）
- 再加一段（启动新一段录音 → 拼接 `existing + '\n' + new`，最多 3 段）

提交后导航 `/describe/generating?memory_id=...`，立刻发起 `/api/describe/submit`。

#### `CardConfirm.tsx`

- 卡片占屏 60% 高度，纸片样式（白边 + 微旋转 -2°）
- 「不太对」（次要按钮）/「就是这样」（主要按钮）
- 30s 无操作触发伙伴气泡「看起来对吗？告诉我一声。」
- 90s 无操作再触发「不点没关系，我等你。」
- 5 分钟无操作自动调 `/api/describe/confirm` 带 `auto_timeout=true` → 跳转主页

### 7.3 TaskOverlay 改造

`TaskOverlay.tsx` 当前的 `photo` / `photo_text` 分支整体替换：

```ts
if (task.kind === 'describe') {
  return (
    <div className="...">
      <h2>{task.title}</h2>
      <p>{task.description}</p>
      <Button size="lg" fullWidth onClick={() => router.push(`/describe/voice?task_id=${task.id}`)}>
        说一说
      </Button>
      <Button variant="ghost" size="lg" fullWidth onClick={() => router.push(`/describe/text?task_id=${task.id}`)}>
        用打字代替
      </Button>
      <Button variant="ghost" fullWidth onClick={onSkipClicked}>跳过</Button>
    </div>
  );
}
```

photo / photo_text 分支删除（同时删除 `JpgPicker` / `PhotoZone` / dev jpg 选图代码——这些迁去图像生成基准图调试工具，独立路径不进任务流）。

### 7.4 Home 页房间渲染

`Room.tsx` 的 `PhotoSticker` 改名 `CardSticker`，prop 接受 `image_url: string`（与之前相同），实际数据源换成 `cards`。

### 7.5 输入偏好持久化

`companionStore` 新增字段：

```ts
inputPreference: 'voice' | 'text';
micPermission: 'granted' | 'denied' | 'prompt';
markMicDenied: () => void;
markMicGranted: () => void;
setInputPreference: (p: 'voice' | 'text') => void;
```

下次进入描述任务时，根据 `inputPreference` 直接落到对应路由，而不是每次都问。

---

## 8. Prompt 资产新增与修订

### 8.1 新增 `prompts/keyword_extract/system.md`

提示 LLM 输出严格 JSON：scene_type / main_subjects / visual_attributes / atmosphere / prompt_content / excluded_details。

`prompts/keyword_extract/examples.json` 提供 5 个 few-shot：卧室、厨房、公园、单一物品、长描述截断。

### 8.2 新增 `prompts/style_audit/system.md`

直接抄 PRD §16.1，温度 0.1。

### 8.3 新增 `prompts/short_followup/system.md`

输入：当前描述（< 10 字）+ 任务主题。
输出：1 句追问语，≤ 25 字，引导孩子补充视觉细节（颜色/数量/位置）。

### 8.4 修订 `prompts/pass2/system.md`

按 PRD §16.3 加段：
- 如果 `input_method == 'voice'` → 引用孩子讲述方式
- 如果 `description_length > 100` → 引用一个具体细节
- 如果 `description_length < 10` → 表达温和好奇

### 8.5 修订 `prompts/pass2/examples/`

- 新增 4 个 voice few-shot
- 新增 2 个长描述 few-shot

### 8.6 卡片确认台词

可二选一：
- **方案 A：复用 Pass2**，但 prompt 中加 context `card_keywords: [...]`，让 Pass2 引用细节
- **方案 B：独立 callType `card_confirm_reply`**，更可控但多一次调用

推荐 **A**，少一次 LLM 调用。Pass2 prompt 变体在描述任务路径下接收 keyword_extract 的 main_subjects 作为额外 context。

### 8.7 ASR 错误词典

`prompts/shared/asr_corrections.json`：

```json
{
  "那那": "奶奶",
  "妈妈": "妈妈",
  "暴暴": "宝宝"
}
```

由产品在用户测试中持续补充，关键词提取前规则化替换。

### 8.8 fallbacks.json 扩展

```json
{
  ...
  "asr_empty": ["我没听清，再说一次？", "嗯？再说一遍？"],
  "asr_unavailable": ["网络好像有点慢，要不先打字试试？"],
  "asr_safety_block": ["我没太听明白，要不换个说法？"],
  "card_regen_2nd": ["我尽力了，再试一次。"],
  "card_regen_3rd_giveup": ["我可能画不出来你说的样子，但我都记住了。下次再试？"],
  "card_style_fallback_text": ["这次它脑子有点乱，画不出来。但你说的它都记住了。"],
  "generating_wait_lines": {
    "xiaoqinglong": ["让我想想你说的样子……", "我在用心画……", "等等我……", "快好了……"],
    "dabear": ["嗯……让我画画看……", "我慢慢画……", "等我一下……", "嗯……快了……"]
  }
}
```

---

## 9. 安全与审核链路

### 9.1 输入侧

```
语音 Blob 上传 → ASR → 输出文字 → safety/filters.filterChildInput → 通过则进入 describe/submit
                                              ↓
                                         命中敏感词 → 422 + 友好提示
```

### 9.2 输出侧（图像）

```
图像生成 → 风格审核（LLM Vision）→ 内容审核（阿里云内容安全 / 腾讯云图像安全）→ 通过 → 写 cards → 展示
                ↓                              ↓
            major 重生成 ≤2 次              拦截 → 重生成
                ↓                              ↓
            仍失败 → 文字降级卡片         仍失败 → 文字降级卡片
```

`src/lib/imagegen/contentAudit.ts` 新增：

```ts
export interface ContentAuditResult {
  passed: boolean;
  labels: string[];     // 'porn' | 'violence' | 'minor_face' | ...
}
export async function auditImageContent(imageUrl: string): Promise<ContentAuditResult>;
```

### 9.3 语音文件留存

- 新建 `public/uploads_voice/` 目录（gitignore）
- 单文件命名：`<companion_id>/<memory_id>.<ext>`
- **不做定时清理**，仅 `dev/reset` 时一并清空（上线前再补清理策略）

---

## 10. Mock 与自动化测试影响

### 10.1 Mock 注入扩展

在 `src/lib/llm/client.ts` 已有的 `MOCK_RAWS` 加两个 callType：

```ts
keyword_extract: JSON.stringify({
  scene_type: 'indoor_room',
  main_subjects: ['蓝色的床', '窗户', '大树'],
  visual_attributes: ['蓝色'],
  atmosphere: '温馨',
  prompt_content: '一张蓝色的床，窗户外能看到一棵大树',
  excluded_details: [],
}),
style_audit: JSON.stringify({
  style_match: true,
  issues: [],
  severity: 'ok',
}),
```

`src/lib/asr/client.ts`、`src/lib/imagegen/client.ts`、`src/lib/imagegen/contentAudit.ts` 均在文件顶部加：

```ts
if (process.env.TEST_LLM_MODE === 'mock') {
  return MOCK_DEFAULT;  // 各自定义
}
```

### 10.2 自动化测试方案变更

**新增 E2E spec：**

| 文件 | 场景 |
|---|---|
| `tests/e2e/p0-describe-voice.spec.ts` | 语音录制 → ASR 中转 → 卡片确认 → 主页贴纸 |
| `tests/e2e/p0-describe-text.spec.ts` | 文字模式提交 → 卡片确认 |
| `tests/e2e/p0-card-revise.spec.ts` | 不太对 → 颜色不对补充 → 重生成 → 确认 |
| `tests/e2e/p1-mic-denied.spec.ts` | 拒绝麦克风权限 → 自动回退到文字 |
| `tests/e2e/p1-asr-fail.spec.ts` | ASR 失败 → 提示切文字 |
| `tests/e2e/p1-card-regen-fail.spec.ts` | 风格审核连续失败 → 文字降级卡片 |
| `tests/e2e/p1-card-no-action.spec.ts` | 5 分钟无操作 → 自动确认 |

**废弃 E2E spec：**
- `p0-day1-capture.spec.ts` 中的 photo upload 流程改为 describe 流程
- `p1-degradation.spec.ts` 中 photo 部分改为 describe submit 失败路径
- `p2-edge.spec.ts` 中 photo 相关边界改为 describe 相关

**新增 API spec：**

| 文件 | 路由 |
|---|---|
| `tests/api/voice-upload.spec.ts` | `/api/voice/upload` |
| `tests/api/describe-submit.spec.ts` | `/api/describe/submit` |
| `tests/api/describe-revise.spec.ts` | `/api/describe/revise` |
| `tests/api/describe-confirm.spec.ts` | `/api/describe/confirm` |

**废弃 API spec：**
- `tests/api/photo-upload.spec.ts`：改为验证 410 Gone

### 10.3 Playwright 录音 mock

E2E 测试中无法真实录音，方案：
- VoiceRecorder 组件支持 `data-testid="voice-recorder"`
- 测试中 `page.evaluate` 直接调用 `window.__testHelpers.simulateRecording(blob)`，绕过 MediaRecorder
- `__testHelpers` 仅在 `process.env.NEXT_PUBLIC_TEST_HELPERS === '1'` 时挂载到 window
- 测试用 fixture 音频 `tests/fixtures/audio/sample.webm`（生成方式：`ffmpeg` 从静音 mp3 转 1s webm，或直接放空 blob）

### 10.4 fixture 图片用途调整

`tests/fixtures/images/*.jpg` 不再用于"上传"，改为：
- 风格审核 mock 时返回的图片 URL（指向 `/style-references/`）
- 端到端验证生成卡片落到房间渲染（用预生成的纸片风 PNG）

`tests/fixtures/generate-images.ts` 提示改为：「生成纸片马里奥风格的 4 张测试卡片」，prompt 用 `STYLE_PREFIX + 测试场景`。

---

## 11. 分阶段落地计划

按周划分，每个阶段都可独立验收。

### 阶段 P6.1：基础能力 + DB 迁移（1 周）

- [ ] DB migration `0002_describe_card.sql` 落库 + dev/reset 同步
- [ ] `src/lib/asr/client.ts` 实装 + mock 注入
- [ ] `src/lib/imagegen/client.ts` 实装 + mock 注入
- [ ] `src/lib/imagegen/stylePrompt.ts` 风格常量
- [ ] `src/lib/imagegen/styleAudit.ts` + `style_audit` callType
- [ ] `src/lib/imagegen/contentAudit.ts` + mock
- [ ] `src/lib/llm/keywordExtract.ts` + `keyword_extract` callType
- [ ] `prompts/keyword_extract/`、`prompts/style_audit/` 模板
- [ ] 类型定义同步：`src/types/index.ts`、`src/lib/db/cardsRepo.ts`

**验收：**
- `npm run type-check` 通过
- 单元用 ts-node 直接调 `recognizeAudioFile`、`generateImage`、`auditImageStyle` mock 模式各跑通一次

### 阶段 P6.2：后端 API + 编排（1 周）

- [ ] `POST /api/voice/upload` 实装
- [ ] `processDescribe.ts` 编排
- [ ] `POST /api/describe/submit` 实装
- [ ] `POST /api/describe/revise` 实装
- [ ] `POST /api/describe/confirm` 实装
- [ ] `/api/photo/upload` 改为 410 Gone
- [ ] `/api/companion/state` 返回 cards 字段
- [ ] API spec 4 个新增 + 1 个废弃验证

**验收：**
- `npm run test:api` 全绿（mock 模式）
- 手工 curl 一遍完整 describe/submit → describe/confirm 流程，DB 中 memories + cards + memory_bank + conversations 都有正确写入

### 阶段 P6.3：前端核心组件（1 周）

- [ ] `VoiceRecorder.tsx`（含权限处理 + 声波动画）
- [ ] `TranscriptionConfirm.tsx`
- [ ] `CardConfirm.tsx`
- [ ] `RevisionFlow.tsx`
- [ ] `companionStore` 新增字段
- [ ] 麦克风权限引导弹窗

**验收：**
- 真机（iOS Safari + Android Chrome）跑通：录音 → 中转 → 等待 → 卡片 → 确认
- 视觉对齐 PRD §11.1 规格

### 阶段 P6.4：页面接入 + TaskOverlay 改造（1 周）

- [ ] `/describe/voice` `/describe/text` `/describe/confirm-text` `/describe/generating` `/describe/confirm-card` `/describe/revise` 6 个页面
- [ ] TaskOverlay 删除 photo 分支，加 describe 分支
- [ ] `tasks/index.ts` Day1/2/3 改为 `kind: 'describe'`
- [ ] 删除 `/capture` `/answer` stub
- [ ] Home 页 Room 渲染读 cards

**验收：**
- 手工跑完 7 天主流程，每天能正确生成卡片并贴到房间
- 跳过任务、记忆面板访问、Day7 生成均不受影响

### 阶段 P6.5：自动化测试更新（3 天）

- [ ] 7 个新 E2E spec
- [ ] 4 个新 API spec
- [ ] 废弃 spec 清理
- [ ] `__testHelpers` 录音 mock 注入
- [ ] CI nightly 配置 ASR + 图像生成 secrets

**验收：**
- `npm run test:p0` 全绿
- nightly real LLM 模式跑通至少一次

### 阶段 P6.6：风格基准图 + 调优（1 周，不阻塞）

- [ ] 跑 PRD §4.9 的 10 个场景测试集（zero-shot），人工筛选
- [ ] 从结果中挑选 3 张作为后续参考图，存入 `public/style-references/`
- [ ] 关键词提取 prompt 调优
- [ ] 风格审核 prompt 调优
- [ ] 等待文案随机化
- [ ] 短描述追问 LLM 调优

**验收：**
- 10 个测试场景至少各产出 1 张可用图（不要求平均分阈值）
- 主流程 p95 时长 ≤ 25s（PRD §17.3 上限）

> **注**：PRD §23.1 列出的硬性指标（风格一致性 ≥ 4.0、major 失败 ≤ 5%、儿童 ASR 准确率 ≥ 80%、100 张人工审核）属于上线前要求，本方案当前不考虑上线，相关测试推迟。

---

## 12. 兼容与降级策略

> **不做灰度开关**：直接全量切到 describe 流程。回退方式是 `git revert` 提交，不在运行时切换。

### 12.1 数据兼容

- 旧 V0.5 数据 `memories.photo_url` 仍可被房间渲染读取（双源：cards + photos），便于历史用户切换后老照片不丢
- Day7 档案生成代码同时接受两种类型证据（见 §5.5 keywordExtract 输入处理）

### 12.2 服务降级

- ASR 整体不可用 → 服务端 503 → 前端切到 `/describe/text`
- 图像生成不可用 → 直接走文字降级卡片，不阻塞流程
- 风格审核 LLM 不可用 → 跳过审核，记录告警，仍展示图

### 12.3 成本失控保护

- ASR + 图像生成在 `companion` 维度限频（同一 companion 7 天内最多触发 30 次描述提交）
- 触发熔断后伙伴台词："今天我画累了，我们明天继续？"

---

## 13. 剩余待决议项

V0.2 收敛后仅剩 2 项：

| # | 决议项 | 默认实施 | 触发回调时机 |
|---|---|---|---|
| ⚠️ B2 | **「再加一段」录音功能** | 默认**不实装**：仅做单段录音 + 编辑，多段拼接太复杂且 ASR 误差累积 | P6.6 真机阶段，如孩子频繁说"还想再说一句"，再补 |
| ⚠️ B3 | **5 分钟无操作自动确认** | 默认**实装**：避免下次进 App 卡在确认页 | 上线后监控 `child_action='no_action_timeout'` 比例，>10% 再讨论 |

### 13.1 上线前补做（不阻塞当前开发）

PRD §23.1 关键风险，本方案当前不处理，上线前再补：

- 5–10 个真实儿童语音 ASR 准确率测试（< 80% 需引入儿童 ASR 模型）
- 100+ 张抽样图人工审核
- metrics dashboard：ASR 准确率、就是这样通过率、major 失败率、p95 总时长
- 异常告警阈值
- 语音文件 30 天自动清理 cron
- 成本预算审核与告警

---

## 附录 A：调用链路对照图

### V0.5（当前）

```
[用户] 上传图片
   ↓ FormData
[/api/photo/upload] saveUploadedBuffer
   ↓
[Vision] DashScope Qwen-VL → vision_tags
   ↓
[Pass1] callLLM → memory_bank
   ↓
[Pass2] callLLM → conversation
   ↓
[响应] 200 + companion_response
```

### V0.6.1（目标）

```
[用户] 按住语音 → MediaRecorder → blob
   ↓ FormData
[/api/voice/upload] saveAudio + ASR
   ↓
[ASR] Aliyun Paraformer → transcription
   ↓
[响应] 200 + transcription

[用户] 中转页编辑 → 提交
   ↓ JSON
[/api/describe/submit] processDescribe
   ↓ 并行
   ├─ [Pass1] callLLM → memory_bank
   └─ [keyword_extract] callLLM → prompt_content
        ↓
   [imagegen] generateImage(STYLE_PREFIX + content + STYLE_CONSTRAINTS)
        ↓
   [style_audit] callLLM Vision → severity
        ↓ major
   重生成 ≤ 2 次
        ↓ ok / minor
   [content_audit] 阿里云内容安全
        ↓
   写 cards 表（is_active=true）
        ↓
   [Pass2] callLLM（含 keywords context）→ conversation
   ↓
[响应] 200 + card_id + image_url + companion_response

[用户] 看卡片 → 点「就是这样」
   ↓
[/api/describe/confirm] LLM 确认台词
   ↓
[响应] 200 + companion_final_response

OR

[用户] 点「不太对」→ 选「颜色不对」+ 语音补充
   ↓
[/api/describe/revise] processReviseCard
   ↓
   重新跑 keyword_extract + imagegen + style_audit
   ↓
   写新 cards 行（generation_attempt=2, is_active=true）
   ↓
[响应] 200 + new card
```

---

## 附录 B：变更影响清单速查

### 新增文件（约 35 个）

```
src/lib/asr/client.ts
src/lib/imagegen/client.ts
src/lib/imagegen/stylePrompt.ts
src/lib/imagegen/styleAudit.ts
src/lib/imagegen/contentAudit.ts
src/lib/llm/keywordExtract.ts
src/lib/orchestrate/processDescribe.ts
src/lib/db/cardsRepo.ts
src/components/voice/VoiceRecorder.tsx
src/components/voice/TranscriptionConfirm.tsx
src/components/card/CardConfirm.tsx
src/components/card/RevisionFlow.tsx
src/components/card/FallbackTextCard.tsx
src/app/describe/voice/page.tsx
src/app/describe/text/page.tsx
src/app/describe/permission/page.tsx
src/app/describe/confirm-text/page.tsx
src/app/describe/generating/page.tsx
src/app/describe/confirm-card/page.tsx
src/app/describe/revise/page.tsx
src/app/api/voice/upload/route.ts
src/app/api/describe/submit/route.ts
src/app/api/describe/revise/route.ts
src/app/api/describe/confirm/route.ts
prompts/keyword_extract/system.md
prompts/keyword_extract/examples.json
prompts/style_audit/system.md
prompts/short_followup/system.md
prompts/shared/asr_corrections.json
db/migrations/0002_describe_card.sql
public/style-references/bedroom.png
public/style-references/outdoor.png
public/style-references/people-env.png
tests/e2e/p0-describe-voice.spec.ts
tests/e2e/p0-describe-text.spec.ts
tests/e2e/p0-card-revise.spec.ts
tests/e2e/p1-mic-denied.spec.ts
tests/e2e/p1-asr-fail.spec.ts
tests/e2e/p1-card-regen-fail.spec.ts
tests/e2e/p1-card-no-action.spec.ts
tests/api/voice-upload.spec.ts
tests/api/describe-submit.spec.ts
tests/api/describe-revise.spec.ts
tests/api/describe-confirm.spec.ts
```

### 修改文件（约 18 个）

```
src/lib/llm/client.ts            # +2 callType + mock
src/lib/llm/validators.ts        # +KeywordExtractSchema +StyleAuditSchema
src/lib/orchestrate/processInput.ts  # 仅服务 text/choice/skipped
src/lib/tasks/index.ts           # Day1/2/3 kind 改 describe
src/lib/companionPresets.ts      # 无变化（确认）
src/lib/db/repos.ts              # cards 关联 + photos 字段降级
src/types/index.ts               # +Card +新 enum 值
src/stores/companionStore.ts     # +inputPreference +micPermission
src/components/task/TaskOverlay.tsx  # photo 分支 → describe 分支
src/components/room/Room.tsx     # PhotoSticker → CardSticker
src/app/home/page.tsx            # 房间数据源切 cards
src/app/api/companion/state/route.ts  # 返回 cards
src/app/api/text/submit/route.ts # 接受 input_method
src/app/api/photo/upload/route.ts  # → 410 Gone
src/app/api/dev/reset/route.ts   # 同时清 cards 表 + uploads_voice
db/seed.sql                      # 无变化
prompts/pass2/system.md          # +V0.6.1 三段补充
prompts/shared/fallbacks.json    # +ASR + 卡片相关文案
.env.example                     # +ASR/imagegen/audit 配置
```

### 删除文件（约 6 个）

```
src/app/capture/page.tsx
src/app/answer/page.tsx
src/app/api/dev/jpg-list/route.ts   # 不再需要
src/app/api/dev/jpg/[name]/route.ts # 不再需要
tests/e2e/p0-day1-capture.spec.ts   # 替换为 p0-describe-voice
（并清理 photo upload 相关 fixture）
```

---

*文档结束*
