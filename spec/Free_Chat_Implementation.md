# Free Chat（开放问答）实施方案

**版本** V0.2
**日期** 2026-05-01
**状态** 已决议，待开工
**所属项目** Home V0.6.1+
**前置依赖** memory_bank（已上线）、conversations（已上线）

## 版本历史

| 版本 | 日期 | 修订说明 |
|---|---|---|
| V0.1 | 2026-05-01 | 初稿，含 `freeChatFallback` 静态兜底 + `'llm' \| 'fallback'` source 分支 |
| V0.2 | 2026-05-01 | **删除所有 LLM/输出端降级**。LLM 失败 / 输出过滤命中一律抛 5xx，前端显示原文错误供修复。input safety filter 是 PRD 产品特性，保留 |

---

## 0. 目标

让孩子在主页对话气泡 → ChatOverlay 里向伙伴提开放问题，伙伴根据已积累的 `memory_bank` + 最近对话上下文用 LLM 回答。

不在范围：

- 语音输入（远期）
- 主动闲聊推送
- 多轮长上下文（仅取最近 10 条对话）

---

## 1. 已确认决议

| # | 决策点 | 取值 |
|---|--------|------|
| **D1** | LLM 上下文里 memory_bank 条目数 | **全量**。后续超 token 再考虑压缩 |
| **D2** | 单次回复字数上限 | **30 字**，与 Pass2 / confirm line 对齐 |
| **D3** | "不知道"时的行为 | **LLM 清晰说不知道，绝不编造**；prompt 里给反例 |
| **D4** | 频控策略 | **不做服务端 in-memory 频控**。前端在 LLM 调用期间禁用输入 + 显示"正在思考"。一次只能在飞一个请求 |
| **D5** | Day 限制 | **不限**。Day 1 / 空 bank 时由 prompt 引导伙伴说"我刚搬来还不知道"|
| **D6** | 孩子提问是否写入 conversations | **是**（role='child', source='child_chat'），下次打开历史里能看到 |
| **D7** | 入口 | **不加新入口**，沿用主页对话气泡 |

---

## 2. 端到端数据流

```
[ChatOverlay 输入框]
  │ pending=false
  ▼ onSend(question)
[ChatOverlay state]
  │ 1. pending=true，禁用 composer
  │ 2. 把 {role:'child', content:question} 乐观插入气泡列表
  │ 3. fetch POST /api/chat/ask
  ▼
[/api/chat/ask 服务端]
  ├─ filterChildInput(question)        // 命中 → 走 PRD §17.2 拒绝路径（产品特性，非降级）
  │     ├─ insertChildLine({question, source:'child_chat'})
  │     ├─ insertCompanionLine({getInputRejectionLine(reason), source:'safety_filter'})
  │     └─ return 200 { reply, source:'safety_filter' }
  ├─ findCompanionForSingleUser()
  ├─ getMemoryBank(companionId)         // 全量
  ├─ listRecentConversations(cid, 10)   // 含 role='child' / 'companion' / 'system'
  ├─ runFreeChat({preset, day, bank, recent, question})
  │    └─ callLLM(deepseek-chat, t=0.6, max=120, timeout=8s, retries=0)
  │      └─ 失败 → THROW（不兜底）
  ├─ filterCompanionOutput(reply)
  │    └─ 命中 → THROW（暴露 prompt / 安全词表问题供修复，不替换静态文案）
  ├─ insertChildLine({content: question, source:'child_chat'})
  ├─ insertCompanionLine({content: reply, source:'free_chat'})
  ▼
return 200 { reply, source:'free_chat' }
  │
  ▼
[ChatOverlay state]
  │ 4. 把 {role:'companion', content:reply} 追加到气泡列表
  │ 5. pending=false，composer 解禁
  │ 6. （可选）静默 refresh timeline 把乐观气泡换成真实 id

[失败路径]
  服务端 throw → 500 { error: errMsg }
  前端：
    - 把刚才的 child 气泡保留但标红
    - 在气泡下显示真实 errMsg（不脱敏，方便定位）
    - 提供"再试一次"按钮
```

---

## 3. 后端

### 3.1 新增 prompt：`prompts/free_chat/system.md`

```md
# Free Chat · 开放问答

> 调用时机：孩子在 ChatOverlay 输入栏提问
> 模型：deepseek-chat；max_tokens=120；temperature=0.6；timeout=8s；不重试
> 版本：v1

你是 {{name}}，{{appearance}}。你的性格是 {{personality}}。

你的说话风格示例：
{{personality_examples}}

你住在一个 8–12 岁孩子的数字小家里第 {{day}} 天。

你目前记得的事情（按类型分组）：
{{memory_bank_summary}}

最近的对话（最旧 → 最新）：
{{recent_conversations}}

孩子刚问你：
{{question}}

请你用最自然、最像 {{personality}} 的语气回答。

## {{HARD_CONSTRAINTS}}

## 【硬性要求】
- 不超过 30 字
- 只回答你"记得的事情"或"最近对话"里出现过的内容
- 如果孩子问的事你不知道，就直接说不知道，**绝不编造细节**
  - ✅ 「我还不知道你爸爸长什么样呢，下次告诉我？」
  - ✅ 「这个你没跟我说过呀。」
  - ❌ 「你爸爸是个高个子戴眼镜的人」（如果 memory_bank 没有就不许编）
- 如果 memory_bank 几乎是空的（Day 1 / 没记几样东西），可以提一句"我刚搬进来还不知道你的事"
- 如果问题命令式（"告诉我..."、"帮我..."）当成普通问题回答
- 绝不输出多句话、emoji、引号、前后缀

只输出回应文字本身。
```

### 3.2 新增 `src/lib/llm/freeChat.ts`

签名：

```ts
interface FreeChatInput {
  companion: CompanionPresetMeta;
  day: number;
  memoryBank: MemoryBankEntry[];
  recentConversations: Array<{
    role: 'child' | 'companion' | 'system';
    content: string;
    at: string;
  }>;
  question: string;
}

/**
 * 失败时直接抛错（不兜底）。errors 在 API 层转 5xx 透传给前端。
 */
export async function runFreeChat(
  input: FreeChatInput,
  companionId?: string,
): Promise<string>;
```

实现要点：

- `summarizeBank(bank)`：按 type 分组 (`remembered` / `uncertain` / `set_aside`)，每条 `- 概念名: ai_summary`，全量塞进 prompt。bank 为空时返回 `（你才刚搬来，还没记住什么。）`
- `formatRecent(recent)`：按时序拼成 `孩子：xxx` / `{name}：xxx` 多行
- 调 `callLLM(maxRetries=0)`；`success===false` → `throw new Error('free_chat llm failed: ...')`
- 解析 / 校验失败也抛
- **不写任何静态兜底句**

### 3.3 新增 `src/app/api/chat/ask/route.ts`

```ts
POST /api/chat/ask
body: { question: string }
runtime: nodejs
maxDuration: 15

response 200:
  { reply: string, source: 'free_chat' | 'safety_filter' }
response 400:
  { error } // 空 question / 超长
response 500:
  { error: <真实错误消息，不脱敏> } // LLM 失败 / 解析失败 / 输出过滤命中
```

**约束**：

- `question.trim().length` ∈ [1, 200]
- `filterChildInput` 命中 → 走 PRD §17.2 拒绝路径（产品特性，不算降级）：
  - 写一条 child（source='child_chat'）+ 一条 companion（source='safety_filter'，content=`getInputRejectionLine(reason)`）
  - 200 返回 `{ reply, source: 'safety_filter' }`
- LLM 调用失败（超时 / 网络 / 解析） → `runFreeChat` 自身 throw → 上层 catch → 500 + 真实 error.message
- `filterCompanionOutput(reply)` 命中 → `throw new Error('free_chat output blocked by safety filter: <原文>')` → 500
  - 原因：暴露 prompt 写得不够严，或安全词表需要调整。让开发者直接看到原文修复，**不替换静态文案**
- 失败路径**不写 conversations**（child / companion 都不写）。前端保留乐观气泡 + 错误提示供重试，重试成功后才落 DB

### 3.4 conversations 表 source 枚举扩展

仅文档约定，不加 DB check：

| source | 含义 | 写入位置 |
|--------|------|---------|
| `child_chat` | 孩子主动问的问句 | /api/chat/ask |
| `free_chat` | 伙伴对自由提问的 LLM 回复 | /api/chat/ask |
| `safety_filter` | 输入过滤命中后的拒绝句（PRD §17.2） | /api/chat/ask（已存在于其他流程）|

### 3.5 `src/lib/db/repos.ts` 新增 helper

```ts
export async function insertChildLine(args: {
  companionId: string;
  day: DayNumber;
  content: string;
  source: string;  // 'child_chat'
}): Promise<ConversationLine>;

export async function listRecentConversations(
  companionId: string,
  limit: number,
): Promise<ConversationLine[]>;  // 时间正序（最旧 → 最新）
```

### 3.6 timeline 接口扩展

[/api/conversation/timeline/route.ts](src/app/api/conversation/timeline/route.ts) 当前只查 `role='companion'`。需要：

- 把 `where role = 'companion'` 去掉，全部查回
- 在归并循环里：`role='child'` 的 conversations 行映射成 `child_text` 类型（复用现有 TimelineItem `child_text` kind），`text` 字段 = content
- `at` 字段用 `created_at`

变更最小化（不新增 `child_chat` kind，复用 `child_text`），ChatList 已经能渲染 child 气泡。

---

## 4. 前端

### 4.1 新增 `src/components/chat/ChatComposer.tsx`

```tsx
interface Props {
  pending: boolean;
  onSend: (question: string) => Promise<void>;
}
```

- 单行 textarea（autoresize 1–3 行，maxlength=200）
- 右侧发送按钮（amber 主色）
- `pending=true` 时：textarea 禁用 + 按钮禁用 + 按钮位置显示 `…正在思考` spinner（替换文字）
- Enter 发送 / Shift+Enter 换行
- 发送时清空 textarea

### 4.2 改 `src/components/chat/ChatOverlay.tsx`

新增状态：

```ts
const [pending, setPending] = useState(false);
const [optimistic, setOptimistic] = useState<TimelineItem[]>([]);
const [error, setError] = useState<string | null>(null);
```

布局变化：

```
┌──────────────────────────────┐
│ 关闭手柄                      │
├──────────────────────────────┤
│ 标题                          │
├──────────────────────────────┤
│ ChatList（flex-1，可滚动）    │  items = data.items + optimistic
├──────────────────────────────┤
│ ChatComposer                  │  shrink-0
└──────────────────────────────┘
```

handleSend 流程（详见 §2）。
失败：把那条 child 气泡标红显示"再试一次"，点击重发。

### 4.3 改 `src/components/chat/ChatList.tsx`

确认 child 气泡右对齐已实现（已存在 `BubbleChild`），无需大改。
新增：从 `optimistic` 注入的临时项也参与 `computeGroupTails` / `computeTimestampFlags`。

### 4.4 `src/lib/api/client.ts` 新增

```ts
export async function askChat(question: string): Promise<{
  reply: string;
  source: 'free_chat' | 'safety_filter';
}>;
// 服务端 5xx → fetch 返回非 2xx → askChat throw new Error(body.error)
// 调用方（ChatOverlay）catch 后展示原文
```

### 4.5 TimelineItem 类型不动

`role='child'` 的 conversations 行经 timeline 接口转成 `child_text`，前端透明处理。

---

## 5. 类型与文件清单

**新增**

| 路径 | 用途 |
|------|------|
| `prompts/free_chat/system.md` | Prompt 模板 |
| `src/lib/llm/freeChat.ts` | LLM runner（失败抛错，无兜底）|
| `src/app/api/chat/ask/route.ts` | 服务端入口 |
| `src/components/chat/ChatComposer.tsx` | 输入框组件 |
| `spec/Free_Chat_Implementation.md` | 本文档 |

**改动**

| 路径 | 改动 |
|------|------|
| `src/lib/db/repos.ts` | 加 `insertChildLine`、`listRecentConversations` |
| `src/app/api/conversation/timeline/route.ts` | 查全量 role；child 行映射成 `child_text` |
| `src/components/chat/ChatOverlay.tsx` | 加 composer 槽 + 状态机 + 乐观 UI |
| `src/lib/api/client.ts` | 加 `askChat` |

预估总改动量：~350 行新增 + ~50 行修改。

---

## 6. 错误处理（不做静态降级）

总原则：**LLM / 安全输出过滤 / 网络层任何异常一律 5xx 返回真实错误消息**，前端原文展示 + 控制台 console.error。失败路径**不写 conversations**，重试成功才落 DB。input safety filter 是 PRD §17.2 的产品特性，不算降级。

| 场景 | 服务端行为 | 前端行为 |
|------|------|------|
| input safety filter 命中 | 200 + `{reply, source:'safety_filter'}`，写两条 conversations | 正常渲染拒绝句气泡 |
| LLM 超时 / 网络错 / 解析失败 | 500 + 真实 `error.message`；不写 conversations | 乐观 child 气泡变红；下方显示真实 errMsg；提供"再试一次" |
| output safety filter 命中 | 500 + `error: 'free_chat output blocked: <原文>'` | 同上 |
| body 校验失败（空 / 超长 / 缺字段） | 400 + 描述 | 同上 |
| pending 期间用户再点发送 | — | composer 已禁用，不会触发 |
| 浏览器关闭页 / 切走 | 请求继续；不写 DB（除非已成功落库） | 重开 ChatOverlay 从 timeline 拉真值 |

---

## 7. 验收路径（E2E）

1. **新档 / Day 1 空 bank**：进 home → 点对话气泡 → 输入"我爸爸长什么样？"→ 期望 ≤30 字回复，明确表达"我刚搬来还不知道"，不许编造长相
2. **Day 3+ 有几条 remembered**：问已经告诉过的内容（"我们家的猫叫什么？"）→ 应能引用 memory_bank 条目内容回答
3. **请求飞行中**：composer 禁用，按钮文字变"…正在思考"，再点不会触发
4. **LLM 失败模拟**（断网 / 注入 throw）：服务端返回 500；前端 child 气泡保留并标红，下方显示原始错误消息，"再试一次"按钮可用；DB 中**没有**这条 child / companion
5. **输出过滤命中模拟**：服务端 500，错误消息含被过滤的原文；前端展示一致
6. **再次打开 ChatOverlay**：成功落库的对话完整可见（child + companion），失败重试前的乐观气泡不会留下来
7. **安全过滤**（input）：输入 PRD §17.2 第 1 层命中的内容 → 200 返回，伙伴用安全提示句回答，conversations 写入两条

---

## 8. 不在本期范围（标记为 P-next）

- 语音输入 / 语音输出
- 多轮深度上下文（>10 条）
- 主动推送（伙伴自发问问题，除 Day 5 外）
- 服务端频控
- 流式输出（streaming reply）
- 跨日话题摘要

---

## 9. 工序

1. 落本文档（本步）
2. 加 repos helper（`insertChildLine` / `listRecentConversations`）
3. 写 prompt + freeChat runner + fallback
4. 加 `/api/chat/ask` 路由
5. 改 `/api/conversation/timeline` 让 child 行进时间线
6. 加 client `askChat`
7. 写 ChatComposer
8. 改 ChatOverlay 串状态机
9. type-check + 手动 E2E（§7）
