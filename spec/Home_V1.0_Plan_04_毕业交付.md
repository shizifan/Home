# Home V1.0 实施方案 · 第 4 份 · 毕业交付

**版本** V0.1
**日期** 2026-05-03
**状态** 待决议
**对应 PRD** [Home_MVP_PRD_V1.0.md](Home_MVP_PRD_V1.0.md) §9–§10、§19、§22–§29
**前置依赖** Plan_01 + Plan_02 + Plan_03 完成

## 文档定位

本文档是 V1.0 实施方案的收官文档，聚焦于**Day 7 世界观档案与毕业卡、全部 Prompt 资产、视觉设计资产、安全审核链路、自动化测试方案、7 周落地计划、部署方案及成本估算**。这份文档完成后，整个 V1.0 的所有工程单元均有明确的执行路径。

## PRD 必读索引

> 实施本文档前，AI 必须阅读以下 PRD 章节。方案文档只做工程决策，细节原文在 PRD。

| PRD 章节 | 内容 | 用途 |
|---|---|---|
| §9.1–§9.7 | 第 7 天世界观档案（触发流程、5–6 项档案、跳过影响、展示动效、破壁文案、档案后台词） | 档案项生成逻辑、动效时序、破壁文案精确原文 |
| §10.1–§10.4 | 毕业卡（触发时机、内容构成、输出规格、静态性约束） | 毕业卡布局、尺寸、数据来源 |
| §19.1–§19.7 | 视觉设计规范（五大特征、色板、字体、角色设计、房间设计、图标） | 所有 hex 色值、字号、描边规格、CardSticker 尺寸 |
| §23.7–§23.9 | Prompt 工程（风格审核、短描述追问、Day 7 Prompt） | 三个关键 Prompt 的原文 |
| §24.1–§24.4 | AI 输出安全（三层防线、敏感词规则、图像安全、语音文件管理） | 安全过滤全链路原文 |
| §27.1–§27.8 | 7 周实现路径（每周主题、交付物、验收方式） | 分阶段计划原文，与方案对照 |
| §28.1–§28.4 | 验收指标（完成率、交互深度、教育价值、技术质量） | 所有硬性指标的精确阈值 |
| §29.1–§29.3 | 风险与待决议项（高/中/低风险、28 个待决议项） | 风险缓解措施原文 |

---

## 目录

1. Day 7 世界观档案
2. 毕业卡
3. Prompt 资产全量
4. 视觉设计资产
5. 安全审核链路
6. 自动化测试方案
7. 7 周分阶段落地计划
8. 部署方案
9. 成本估算
10. 风险与待决议项

---

## 1. Day 7 世界观档案

### 1.1 触发流程

```
Day 7 打开 App
  ↓
伙伴说固定开场白（非 LLM 生成）：
"我已经在小家住满 7 天了。这一周你告诉了我好多事，
 我也整理了好多记忆——我想给你看看，我现在眼中的
 世界是什么样的。你看看对不对？"
  ↓
孩子点「看看」→ 触发档案生成
  ↓
LLM day7 callType 生成 5–6 项档案
  ↓
逐项展示动效（每项 1.5s 间隔泛入）
  ↓
第 5 项「完全不知道」停顿 2.5s + 背景闪烁
  ↓
第 6 项「差点忘了」停顿 2s + 金色微光（如存在）
  ↓
破壁文案展示
  ↓
「生成毕业卡」按钮
```

### 1.2 档案生成

调用 LLM `day7` callType（Claude Sonnet 4.5, T=0.7, max 2000 tokens, 30s 超时）：

```
输入：
  companion: { name, personality }
  memory_bank 全量：{ remembered[], uncertain[], set_aside[] }
  unknown_list: string[]
  user_corrections: { action, concept, at }[]
  skip_count: number

输出（JSON）：{
  most_important_person: { concept, evidence_quote, days_mentioned },
  most_fun_thing: { ... },
  most_delicious_thing: { ... },
  most_scary_thing: { ... },
  unknown_thing: { concept, reason },
  almost_forgot_thing?: { concept, original_reasoning, restoration_story }
}
```

pass1/pass2 prompt 详参见第 3 章。

### 1.3 跳过任务对档案的影响

| 累计跳过 | Day 7 档案表现 |
|---|---|
| 0–2 个 | 5 项完整生成 |
| 3–5 个 | LLM prompt 加注「训练数据较少，回答可能更笼统」 |
| 6+ 个 | 第 5 项替换为：「其实……我对你的事知道得不太多。这是你给我的全部。」 |

```ts
// processDay7.ts 中的处理
const skipMode = skipCount >= 6 ? 'sparse'
  : skipCount >= 3 ? 'limited'
  : 'normal';

const promptNote = skipMode === 'sparse'
  ? '孩子的输入非常少。第5项应该直接反思训练数据不足。'
  : skipMode === 'limited'
  ? '孩子的输入有限。回答可以更笼统一些。'
  : '';
```

### 1.4 逐项展示动效

```tsx
// src/components/day7/ArchiveReveal.tsx
function ArchiveReveal({ items }: { items: ArchiveItem[] }) {
  const [visible, setVisible] = useState(0);

  useEffect(() => {
    const delays = [0, 1500, 3000, 4500, 7000]; // 第5项额外 2.5s
    if (items.length >= 6) delays.push(9000);     // 第6项额外 2s

    for (let i = 1; i < items.length; i++) {
      setTimeout(() => setVisible(i), delays[i]);
    }
  }, []);

  return (
    <div className="archive-container">
      {items.map((item, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 40 }}
          animate={i <= visible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className={clsx(
            'archive-item',
            i === 4 && 'archive-unknown',       // 第5项特殊样式
            i === 5 && 'archive-almost-forgot', // 第6项金色样式
          )}
        >
          {item.content}
        </motion.div>
      ))}
    </div>
  );
}
```

CSS：
```css
.archive-unknown {
  background: rgba(250, 199, 117, 0.15);
  border-left: 3px solid #BA7517;
}
.archive-almost-forgot {
  background: rgba(239, 159, 39, 0.08);
  border-left: 3px solid #EF9F27;
}
```

### 1.5 破壁文案

档案展示完后 3 秒，展示固定文案（非 LLM 生成）。

**无第 6 项版本**：
> 你刚刚看到的"我眼中的世界"——是用你这7天告诉我的所有内容拼出来的。
> 你说过的每一句话，都变成了我对世界的理解。
> 真实世界里所有的 AI——你听说过的 ChatGPT、豆包、Kimi——都是这样长大的。
> 区别只是它们的"主人"不是你一个人，是几十亿个写过文字、说过话的人。

**有第 6 项版本**：
> 你刚刚看到的"我眼中的世界"——是用你这7天告诉我的所有内容拼出来的。
> 但你也教过我——什么应该记住，什么可以忘掉。
> 真实世界里所有的 AI 都是这样长大的。它们不只是接收数据，它们也在被人不停地纠正。
> 你刚刚做的事，工程师每天都在做：告诉 AI 什么是对的，什么是错的，什么是重要的，什么不是。
> 你已经做过一次了。

### 1.6 档案卡后的伙伴台词

5 选 1 随机：
- 「你看，这就是你这一周告诉我的全部。」
- 「我现在眼里就这些了。」
- 「这是我从你身上学到的。」
- 「7 天前我什么都不知道。现在我有这些了。」
- 「这就是我的世界。是你给我的。」

---

## 2. 毕业卡

### 2.1 触发时机

破壁文案展示后，孩子点击「生成毕业卡」按钮。

### 2.2 内容构成

| 区块 | 内容 | 数据来源 |
|---|---|---|
| 标题区 | "这是我的 {伙伴名}" + "在 Home 住了 7 天" | companion + 固定文案 |
| 主视觉区 | 等距小屋 + 纸片伙伴 + 墙上卡片 + 地面物品 | Canvas 实时渲染 |
| 档案区 | 5–6 项世界观档案 | worldview_cards 表 |
| 数据区 | X 张卡片 / Y 句对话 / Z 次纠正 / 7 天陪伴 | companion_stats |
| 品牌区 | Home 标识 | 固定 |

### 2.3 输出规格

```
尺寸：1080 × 1920px（竖版 9:16）
格式：PNG + JPG
文件大小：< 800KB
背景色：#FAEEDA（暖米黄）
字体：LXGW WenKai（标题）+ Source Han Sans（正文）
```

### 2.4 渲染方案

使用 `html-to-image`（已有依赖）进行 DOM → 图片转换：

```tsx
// src/components/day7/GraduationCard.tsx
import { toPng } from 'html-to-image';

function GraduationCard({ companion, worldview }: GradCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  async function exportCard(): Promise<string> {
    if (!cardRef.current) throw new Error('No ref');
    const dataUrl = await toPng(cardRef.current, {
      width: 1080,
      height: 1920,
      pixelRatio: 2,
      backgroundColor: '#FAEEDA',
    });
    return dataUrl;
  }

  return (
    <div ref={cardRef} className="w-[1080px] h-[1920px] bg-[#FAEEDA] font-wenkai">
      {/* 标题区 */}
      <header className="text-center pt-20">
        <h1 className="text-[56px] text-[#2C2C2A]">
          这是我的{companion.custom_name || companion.preset_id}
        </h1>
        <p className="text-[32px] text-[#5F5E5A] mt-4">在 Home 住了 7 天</p>
      </header>

      {/* 主视觉区：等距小屋 Canvas */}
      <div className="flex justify-center mt-12">
        <IsometricRoomSVG cards={worldview.stats.cards_count} companion={companion} />
      </div>

      {/* 档案区 */}
      <section className="px-16 mt-12 space-y-4">
        <ArchiveLine label="最重要的人" value={worldview.most_important_person} />
        <ArchiveLine label="最好玩的事" value={worldview.most_fun_thing} />
        <ArchiveLine label="最好吃的东西" value={worldview.most_delicious_thing} />
        <ArchiveLine label="最让我害怕的" value={worldview.most_scary_thing} />
        <ArchiveLine
          label="我完全不知道"
          value={worldview.unknown_thing}
          emphasis
        />
        {worldview.almost_forgot_thing && (
          <ArchiveLine
            label="我差点忘了"
            value={worldview.almost_forgot_thing}
            gold
          />
        )}
      </section>

      {/* 数据区 */}
      <footer className="absolute bottom-32 w-full text-center">
        <div className="flex justify-center gap-16 text-[#5F5E5A]">
          <Stat label="张卡片" value={worldview.stats.cards_count} />
          <Stat label="句对话" value={worldview.stats.conversations_count} />
          <Stat label="次纠正" value={worldview.stats.corrections_count} />
          <Stat label="天陪伴" value={worldview.stats.days_count} />
        </div>
        <p className="text-[28px] text-[#888780] mt-8">Home</p>
      </footer>
    </div>
  );
}
```

### 2.5 分享功能

```tsx
async function shareGraduationCard(dataUrl: string) {
  // 方案 A：保存到相册
  const link = document.createElement('a');
  link.download = '我的毕业卡.png';
  link.href = dataUrl;
  link.click();

  // 方案 B：Web Share API（微信内需用 JSSDK）
  if (navigator.share) {
    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], '毕业卡.png', { type: 'image/png' });
    await navigator.share({ files: [file], title: '我的 Home 毕业卡' });
  }
}
```

### 2.6 毕业卡静态性

**明确**：毕业卡是 7 天主流程的终点快照，生成后不更新。毕业后驿站获得的道具、新卡片不会反映在毕业卡上。

---

## 3. Prompt 资产全量

### 3.1 V1.0 Prompt 矩阵

V1.0 共有 **15 组 Prompt**（V0.6.1 为 10 组）。所有 Prompt 需适配 Claude Sonnet 4.5（V0.6.1 的 Prompt 为 DeepSeek 优化）。

| callType | Prompt 文件 | 用途 | V0.6.1 | V1.0 变更 |
|---|---|---|---|---|
| `pass1` | `prompts/pass1/system.md` | 记忆归类 | ✓ | **重写** Claude |
| `pass2` | `prompts/pass2/system.md` | 口语回应 | ✓ | **重写** + voice/length 上下文 |
| `concept_detail` | `prompts/concept_detail/system.md` | 概念详情 | ✓ | **重写** Claude |
| `correction` | `prompts/correction/system.md` | 纠正反馈 | ✓ | **重写** Claude |
| `day7` | `prompts/day7/system.md` | 世界观档案 | ✓ | **重写** Claude |
| `keyword_extract` | `prompts/keyword_extract/system.md` | 关键词提取 | ✓ | **重写** Claude |
| `style_audit` | `prompts/style_audit/system.md` | 风格审核（独立路由） | ✓ | **不变**（仍用 Qwen-VL） |
| `free_chat` | `prompts/free_chat/system.md` | 自由聊天 | ✓ | **重写** Claude |
| `short_followup` | `prompts/short_followup/system.md` | 短描述追问 | ✓ | **重写** Claude |
| `visit` | `prompts/visit/system.md` | 朋友家拜访 | ✗ | **新增** |
| `school` | `prompts/school/system.md` | 学校课堂 | ✗ | **新增** |
| `plaza_act` | `prompts/plaza_act/system.md` | 广场单幕 | ✗ | **新增** |
| `plaza_ending` | `prompts/plaza_ending/system.md` | 广场结局 | ✗ | **新增** |
| — | `prompts/shared/hard_constraints.md` | 通用硬约束 | ✓ | **不变** |
| — | `prompts/shared/fallbacks.json` | 备用文案库 | ✓ | **扩展** 驿站文案 |

### 3.2 Prompt 模板结构

每个 Prompt 遵循统一模板（V0.6.1 已确立，V1.0 保留）：

```
[Role] 你是谁，你的性格
  ↓
[Context] 当前场景、前面说过什么
  ↓
[Memory] 孩子的记忆数据（memory_bank）
  ↓
[Task] 你要做什么
  ↓
[Constraints] 你不能做什么（hard_constraints.md 嵌入）
  ↓
[Output Format] 严格 JSON 格式要求
  ↓
[Few-shot] 示例（从 examples/ 目录加载）
```

### 3.3 新增 Prompt 详情

#### `visit` — 朋友家拜访报告

```
[Role]
你是 {companion_name}，{personality}。你正在拜访 {friend_name} 的家。

[Context]
你的主人想让你去 {purpose}。
你对世界的了解都来自主人的输入。{friend_name} 对世界的了解来自它的主人。

[Memory]
你对世界的了解：
{my_memory_bank_summary}

{friend_name} 对世界的了解：
{friend_memory_bank_summary}

[Task]
基于以上信息，生成一次拜访的叙事报告。

如果是 meet_friend：描述你见到 {friend_name} 的场景，观察它的家。
如果是 observe_home：着重对比你的家和它的家有什么不同。
如果是 introduce_self：你用你的记忆向它介绍你自己。
如果是 ask_question：你的主人想问 "{question}"，{friend_name} 根据它的记忆回答。

如果有你从没想过的新概念，标记为 new_word（source_type='secondhand', confidence=0.3）。

[Output Format]
{ scene_narrative, observation?, new_word?: { concept, source_type, source_companion, confidence } }

[Few-shot: 从 prompts/visit/examples.json 加载]
```

#### `school` — 学校课堂报告

```
[Role]
今天好几个伙伴一起上课。老师问了一个问题，每只伙伴根据自己见过的世界来回答。

[Memory]
问题：{question}

伙伴们的世界：
{companions: [{ name, personality, memory_bank_summary }]}

[Task]
为每只伙伴生成它对这个问题的回答（≤20字），完全基于它的 memory_bank。不要编造它没见过的东西。

如果某只伙伴完全没有相关信息，它的回答应该是"我不知道这个是什么"之类。

生成一个 1 句话的 highlight，指出最有趣的差异。
生成一个 1 句话的 teaching_moment（≤25字），用孩子能懂的话解释为什么答案不同。

[Output Format]
{ question, answers: [{ companion, answer, basis }], highlight, teaching_moment }
```

#### `plaza_act` — 广场单幕

```
[Role]
你扮演 {companion_name}（角色：{role}）。这是一个古代角色扮演。

[Context]
剧本：{scenario_title} - {synopsis}
当前是第 {act_number} 幕：{act_title}
场景：{setting}
困境：{dilemma}

前面发生了什么：
{previous_acts_narrative}

[Task]
你的主人让你使用道具「{item_name}」（{item_description}）来应对当前困境。
你需要生成一段场景叙述，包含你的台词（必须明确展示你如何使用这件道具）。
如果主人没选道具（不用道具，凭直觉），你需要完全靠自己的判断来应对。

评价你的道具使用质量：
- clever：道具使用巧妙，完美契合困境
- reasonable：道具使用合理，基本解决了问题
- barely_relevant：道具与困境关联很弱

[Output Format]
{ scene_narrative, companion_speech, reactions, item_use_quality }
```

#### `plaza_ending` — 广场结局

```
[Role]
你扮演 {companion_name}（角色：{role}）。剧本《{scenario_title}》即将结束。

[Context]
你在这三幕中分别使用了：
{all_acts: [{ act, item_used, item_use_quality, narrative }]}

[Task]
根据道具使用质量决定结局类型：
- perfect：三幕均有 clever
- good：至少一幕 clever
- barely：无 clever

生成结局叙事（≤200字），以及获得的物品（1-2 件）。

[Output Format]
{ ending_type, narrative, earned_items: [{ item_id, item_name }] }
```

### 3.4 Few-shot 扩展计划

| Prompt 组 | V0.6.1 数量 | V1.0 目标 | 新增来源 |
|---|---|---|---|
| pass1 | 8 | 12 | 补充 describe 场景 |
| pass2 | 8 | 12 | 补充 voice/length 变体 |
| keyword_extract | 5 | 8 | 补充户外/人物场景 |
| correction | 6 | 10 | 补充 inform/withhold 动作 |
| day7 | 4 | 6 | 补充跳过/无第6项场景 |
| visit | 0 | 12 | 4 目的 × 3 变体 |
| school | 0 | 12 | 4 目的 × 3 变体 |
| plaza_act | 0 | 15 | 5 剧本 × 3 幕 |
| plaza_ending | 0 | 10 | 5 剧本 × 2 结局 |
| **合计** | **~31** | **~97** | **+66 条** |

### 3.5 DeepSeek → Claude 迁移要点

| 差异维度 | DeepSeek-V3 | Claude Sonnet 4.5 | 迁移动作 |
|---|---|---|---|
| System Prompt 位置 | 通过 messages[0] role=system | API 顶层 system 参数 | 调整 `callLLM` 方法 |
| JSON 输出 | 需要明确提示 | 天然更好 | 可简化 JSON 指令 |
| 中文角色扮演 | 偶有翻译腔 | 更自然 | Few-shot 需更新语气 |
| 温度敏感度 | T=0.3 已有变化 | T=0.3 非常保守 | 调整各 callType 温度 |
| Token 效率 | 1 token ≈ 0.7 汉字 | 1 token ≈ 0.5 汉字 | maxTokens 需上调 30% |
| 约束遵循 | 偶尔忽略约束 | 更严格 | hard_constraints 可精简 |

---

## 4. 视觉设计资产

### 4.1 资产清单

| 类别 | 资产 | 数量 | 格式 | 来源 |
|---|---|---|---|---|
| **伙伴立绘** | 每只伙伴 3 视图 (站/坐/躺) × 8 只 | 24 张 | SVG | 设计师 |
| **伙伴表情** | 每只伙伴 5 种表情 (平/喜/奇/思/惑) × 8 只 | 40 张 | SVG 图层 | 设计师 |
| **广场配饰** | 7 种角色配饰 (丞相帽/皇冠/披风/官帽/花/剑/竹简) | 7 张 | SVG | 设计师 |
| **房间元素** | 墙面板 (3 块) + 物品图标 (30 个) | 33 张 | SVG | 设计师 |
| **卡片贴纸** | CardSticker 模板 | 1 张 | SVG | 已有 |
| **驿站场景** | 朋友家/学校/广场 3 个背景 | 3 张 | SVG | 设计师 |
| **广场插图** | 5 个剧本 × 6–8 张插图 | 30–40 张 | PNG | 通义万相生成 + 人工筛选 |
| **毕业卡** | 主视觉 SVG + 模板 | 1 组 | SVG+CSS | 前端代码生成 |
| **UI 图标** | 语音/文字/确认/跳过等 | ~15 个 | SVG | 已有（paper-flat 风格） |

### 4.2 风格基准图

PRD §6.3 要求 3 张基准图作为图像生成参考。V0.6.1 Phase P6.6 已规划从 zero-shot 结果中筛选。

| 基准图 | scene_type | 文件 | 状态 |
|---|---|---|---|
| 卧室场景 | `indoor_room` | `public/style-references/indoor_room.png` | zero-shot → 人工筛选 |
| 户外场景 | `outdoor_place` | `public/style-references/outdoor_place.png` | 同上 |
| 人物+环境 | `people_with_env` | `public/style-references/people_with_env.png` | 同上 |

### 4.3 纸片插画生成 prompt（用于生成广场插图）

广场剧本插图使用与卡片相同的风格 Prompt + 剧本场景描述生成，但不过内容审核（因涉及古代场景中可能含武器等上下文合理元素）。

---

## 5. 安全审核链路

### 5.1 全链路安全架构

```
┌─────────────────────────────────────────────────────┐
│                    输入侧                              │
│                                                       │
│  语音 Blob → ASR → 文字 → safety/filters.filterChildInput │
│                                ↓                       │
│                            通过 → 进入流程              │
│                            拦截 → 422 + 友好提示        │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│                    输出侧（文本）                       │
│                                                       │
│  LLM 输出 → safety/filters.filterCompanionOutput      │
│                ↓                                      │
│            通过 → 展示给孩子                           │
│            拦截 → 使用 fallbacks.json 备用文案          │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│                    输出侧（图像）                       │
│                                                       │
│  图像生成 → 风格审核 (Qwen-VL)                         │
│                ↓ (ok/minor → 通过)                    │
│           内容审核                                     │
│           ├─ 阿里云内容安全 API (主要防线)               │
│           └─ LLM Vision 检查 (补充防线)                 │
│                ↓                                      │
│            通过 → OSS 上传 → cards 表 → 展示            │
│            拦截 → 重生成 (≤2次) → 文字降级卡片          │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│                    广场剧本                            │
│                                                       │
│  孩子自定义问题 → safety/filters 检查                   │
│  LLM 生成的叙事 → 过文本安全过滤                        │
│  广场插图（预设）→ 预审核通过（上传前人工审）            │
└─────────────────────────────────────────────────────┘
```

### 5.2 内容审核实现

```ts
// src/lib/imagegen/contentAudit.ts — 双层审核

// 第一层：阿里云内容安全
async function callAliyunContentSafety(imageUrl: string): Promise<{ passed: boolean; labels: string[] }> {
  const client = new ContentSafetyClient({
    accessKeyId: process.env.ALIYUN_CONTENT_SAFETY_ACCESS_KEY_ID!,
    accessKeySecret: process.env.ALIYUN_CONTENT_SAFETY_ACCESS_KEY_SECRET!,
  });

  const result = await client.imageSyncScan({
    scenes: ['porn', 'terrorism', 'ad', 'live'],
    tasks: [{ url: imageUrl }],
  });

  const labels = result.data?.[0]?.results
    ?.filter((r: any) => r.suggestion === 'block')
    .map((r: any) => r.scene) ?? [];

  return { passed: labels.length === 0, labels };
}

// 第二层：LLM Vision 补充
async function callVisionContentCheck(imageUrl: string): Promise<{ passed: boolean; labels: string[] }> {
  // 检查：真实人脸、文字/logo、品牌标识
  // 温度 0.1，8s 超时
  // 失败默认通过（不阻塞流程，第一层已为主要防线）
}
```

### 5.3 敏感词过滤规则

`safety/filters.ts` 已实装的规则不变，V1.0 扩展：

```ts
// 儿童安全敏感词库（代码资产，非 LLM 判断）
const CHILD_SAFETY_PATTERNS = [
  // 个人信息
  /(\d{11})/,                           // 手机号
  /(\d{17}[\dXx])/,                     // 身份证号
  /(省|市|区|路|号|栋|单元|室).{2,10}/,  // 地址

  // 成人内容
  // ...（已有）

  // 新增：驿站相关问题
  /(密码|账号|登录|注册)/,               // 不鼓励输入账号信息
];

export function filterChildInput(text: string): { safe: boolean; reason?: string } { ... }
export function filterCompanionOutput(text: string): { safe: boolean; reason?: string } { ... }
```

### 5.4 语音文件管理

- 上传到 OSS `uploads_voice/<companion_id>/<memory_id>.webm`
- 不做定时清理（`dev/reset` 时清空 OSS 目录）
- 语音文件不进入 AI 训练数据

---

## 6. 自动化测试方案

### 6.1 完整测试矩阵

| 层级 | 类别 | 数量 | mock 模式 | 真实 API 模式 |
|---|---|---|---|---|
| **单元测试** | LLM client | 13 callType × 2 (成功/失败) | ✓ | ✓ nightly |
| | ASR client | 4 场景 | ✓ | ✓ nightly |
| | Image gen client | 3 场景 | ✓ | ✓ nightly |
| | Content audit | 3 场景 | ✓ | ✓ nightly |
| | Safety filters | 10 用例 | ✓ | ✓ (无外部依赖) |
| | DB repos | 全量 CRUD | ✓ | ✓ (本地 PG) |
| **API 测试** | describe 系列 | 4 spec | ✓ | ✓ nightly |
| | voice upload | 1 spec | ✓ | ✓ nightly |
| | companion/state | 1 spec | ✓ | ✓ nightly |
| | station 系列 | 6 spec | ✓ | ✓ nightly |
| | inventory | 1 spec | ✓ | ✓ nightly |
| **E2E 测试** | describe 流程 | 8 spec | ✓ | — |
| | memory panel | 2 spec | ✓ | — |
| | station 流程 | 5 spec | ✓ | — |
| | day7 + graduation | 2 spec | ✓ | — |
| **总计** | | **~63 spec** | | |

### 6.2 新增 E2E spec 详情

| Spec | 覆盖范围 |
|---|---|
| `day7-archive.spec.ts` | Day 7 打开 → 档案展示 → 逐项动效 → 破壁文案 |
| `day7-graduation.spec.ts` | 生成毕业卡 → 保存/分享 |
| `station-unlock.spec.ts` | 毕业 → 朋友家 → 拜访 2 次 → 学校 → 上学 1 次 → 广场 |
| `station-visit.spec.ts` | 4 种目的各走一遍 |
| `station-school.spec.ts` | 上课 → 答案对比 → 教学时刻 |
| `station-plaza.spec.ts` | 选剧本 → 选道具 → 3 幕 → 结局 → 获得道具 |
| `station-backpack.spec.ts` | 行囊查看 + 物品详情 |
| `content-audit-block.spec.ts` | 内容审核拦截 → 降级 |

### 6.3 CI/CD 配置

```yaml
# .github/workflows/test.yml
test:
  p0-mock:
    runs-on: ubuntu-latest
    services: { postgres: { image: postgres:15 } }
    env: { TEST_LLM_MODE: mock }
    steps:
      - run: npm run test:p0

  nightly-real:
    runs-on: ubuntu-latest
    if: github.event_name == 'schedule'
    env:
      ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
      DASHSCOPE_API_KEY: ${{ secrets.DASHSCOPE_API_KEY }}
    steps:
      - run: npm run test:nightly
```

### 6.4 性能测试

| 指标 | 测试方法 | 阈值 |
|---|---|---|
| Voice → Card 总延迟 | `test:perf` 脚本记录 p50/p95/p99 | p50 ≤ 15s, p95 ≤ 25s |
| Pass1 延迟 | llm_call_log 聚合 | p95 ≤ 6s |
| 图像生成延迟 | llm_call_log 聚合 | p95 ≤ 10s |
| API 响应时间 | k6 / artillery 压测 | p95 ≤ 30s |
| 并发 10 用户 | 同上 | 0 错误 |

---

## 7. 7 周分阶段落地计划

### 7.1 阶段总览

| 周 | 主题 | 依赖 | 核心交付 | 验收方式 |
|---|---|---|---|---|
| W1 | 技术验证 + 环境搭建 | 无 | 图像生成评测报告、ASR 评测报告、阿里云环境就绪 | 手动评测 |
| W2 | 数据模型 + Day 1 流程 | Plan_01 | PostgreSQL schema 落库、Claude 调通、Day 1 describe 文字模式走通 | `type-check` + curl |
| W3 | 语音 + 卡片确认 + 7 天全流程 | Plan_02 | 语音全链路、卡片确认、修订流程、Day 1-6 全流程 | 真机走通 |
| W4 | 记忆面板完整 | Plan_02 | 4 区块交互、纠正动作、盲区列表、Day 6 任务 | 真机走通 |
| W5 | Day 7 + 毕业卡 + 内测 | Plan_04 | 世界观档案、破壁文案、毕业卡渲染、3-5 人真实用户测试 | 用户反馈 |
| W6 | 驿站：朋友家 + 学校 | Plan_03 | 驿站地图、朋友家 4 目的、学校 4 目的、解锁逻辑 | 真机走通 |
| W7 | 广场 + 部署上线 | Plan_03 + Plan_04 | 广场 5 剧本、行囊系统、阿里云部署、5-10 人试运行 | 线上可用 |

### 7.2 W1：技术验证 + 环境搭建

**并行工作**：开发者技术验证 / 设计师产出伙伴立绘

- [ ] 通义万相 10 场景测试集跑通，风格一致性评分
- [ ] MiniMax 同 10 场景跑通（作为兜底）
- [ ] Claude Sonnet 4.5 角色稳定性测试（20 条中文样本）
- [ ] Claude JSON 输出稳定性验证（各 callType 10 次）
- [ ] Qwen-VL 风格审核准确率测试（20 张样本图）
- [ ] ASR 儿童语音准确率测试（5-10 个真实儿童录音）
- [ ] 阿里云 ECS + RDS PostgreSQL + Redis + OSS 环境搭建
- [ ] 阿里云内容安全 API 联调

### 7.3 W2：数据模型 + Day 1 流程

- [ ] `0004_v1_init_pg.sql` 执行 + 种子数据
- [ ] `src/lib/db/client.ts` 重写为 `pg`
- [ ] `src/lib/db/repos.ts` 所有函数适配 PostgreSQL
- [ ] `src/lib/db/cardsRepo.ts` 适配
- [ ] `src/lib/llm/client.ts` 切换 Claude
- [ ] 13 个 callType 的 mock 注入
- [ ] Pass1/Pass2/keyword_extract 调通（mock + 真实）
- [ ] Day 1 describe 提交（文字模式）走通
- [ ] 卡片生成 + 风格审核 + 内容审核联调
- [ ] `dev/reset` 端点适配

### 7.4 W3：语音 + 卡片确认 + 7 天全流程

- [ ] `POST /api/voice/upload` 改造（OSS 上传）
- [ ] `POST /api/describe/submit` 全链路（串行图像 + 审核）
- [ ] `POST /api/describe/revise` 全链路
- [ ] `POST /api/describe/confirm` 联调
- [ ] 7 个 describe 前端页面联调
- [ ] VoiceRecorder + TranscriptionConfirm + CardConfirm 真机验证
- [ ] TaskOverlay describe 分支
- [ ] TaskDef Day 1-6 配置
- [ ] Day 1-6 全流程手工走通

### 7.5 W4：记忆面板完整

- [ ] 记忆面板 4 区块页面联调
- [ ] 纠正动作 7 种交互（restore/dismiss/clarify/rename/merge/inform/withhold）
- [ ] 二手信息标注展示
- [ ] 信心度标签显示
- [ ] 盲区列表 LLM 生成
- [ ] Day 6「打开它的脑袋」任务触发
- [ ] 跨场景集成测试

### 7.6 W5：Day 7 + 毕业卡 + 内测

- [ ] Day 7 检测逻辑（current_day >= 7 或手动触发）
- [ ] 世界观档案 LLM 生成（day7 callType）
- [ ] 逐项展示动效
- [ ] 破壁文案条件展示（有/无第 6 项）
- [ ] 毕业卡 Canvas 渲染
- [ ] 保存到相册 / 分享
- [ ] `worldview_cards` 表读写
- [ ] 3–5 人真实用户测试
- [ ] Bug 修复

### 7.7 W6：驿站：朋友家 + 学校

- [ ] 驿站地图页面
- [ ] 解锁逻辑服务
- [ ] `POST /api/station/depart`（visit + school）
- [ ] `GET /api/station/trip/:id`
- [ ] 朋友家 4 目的前端页面
- [ ] 伙伴匹配服务
- [ ] 对方家渲染
- [ ] 二手知识写入 memory_bank
- [ ] 学校 4 目的前端页面
- [ ] 题库系统
- [ ] 课堂报告 + 教学时刻
- [ ] 解锁台词触发

### 7.8 W7：广场 + 部署上线

- [ ] 行囊页面 + 物品详情
- [ ] `POST /api/station/depart`（plaza）
- [ ] `POST /api/station/plaza/play` + `finish`
- [ ] 广场 5 个剧本前端 3 幕
- [ ] 道具升级逻辑
- [ ] 30–40 张广场插图（通义万相生成 + 人工筛选）
- [ ] 阿里云 ECS Docker 部署
- [ ] SSL 证书配置
- [ ] 监控告警接入
- [ ] 5–10 人真实用户试运行
- [ ] 最终 Bug 修复

### 7.9 可裁剪方案

如果时间不够，以下功能可推迟到 V1.1：

| 功能 | 推迟影响 |
|---|---|
| 广场（全部） | 丢失第四层教育目标，但前三层仍完整 |
| 学校（全部） | 丢失第三层教育目标的一部分 |
| 朋友家「问一个问题」目的 | 保留其他 3 个目的即可 |
| 5 剧本 → 1 剧本 | 广场保留 `water_disaster` 演示 |
| 8 伙伴 → 4 伙伴 | 保留小青龙、大熊、小火龙、藤藤蛇 |
| 30s 引导 → 2 张卡片 | 简化首次引导 |

**绝对不能裁剪**：7 天主流程、描述卡片机制、记忆面板、Day 7 档案 + 破壁文案、毕业卡。

---

## 8. 部署方案

### 8.1 目标环境

```
┌─────────────────────────────────────────┐
│             阿里云 ECS (2c4g) × 2         │
│              SLB 负载均衡                 │
│                                          │
│  ┌─────────────────────────────────┐    │
│  │     Docker: node:20-alpine       │    │
│  │     Next.js 15 (standalone)      │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘

┌──────────────┐  ┌──────────┐  ┌────────┐
│ PostgreSQL   │  │  Redis   │  │  OSS   │
│ RDS 2c4g    │  │  1GB     │  │ 按量   │
└──────────────┘  └──────────┘  └────────┘
```

### 8.2 Dockerfile

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prompts ./prompts
COPY --from=builder /app/data ./data
EXPOSE 3000
CMD ["node", "server.js"]
```

### 8.3 环境变量注入

通过阿里云 KMS 或 ECS 用户数据注入生产环境变量（API keys 等敏感信息），不写入 Dockerfile。

### 8.4 监控指标

| 指标 | 工具 | 告警阈值 |
|---|---|---|
| API 错误率 | 阿里云 ARMS | > 1% |
| API P95 延迟 | 同上 | > 30s |
| LLM 调用失败率 | `llm_call_log` 聚合 + 自定义告警 | > 5% |
| 图像生成失败率 | 同上 | > 10% |
| 内容审核拦截率 | 自定义日志 | > 5%（异常排查） |
| 成本日消耗 | 阿里云费用中心 | > ¥50/天 |

### 8.5 免登录方案

V1.0 不做登录，使用单用户模式（与 V0.6.1 一致）：

- 所有请求默认绑定 `SINGLE_USER_ID`
- 伙伴数据隔离通过 `companion_id` 实现
- 多设备共享同一个 PostgreSQL 数据库

**上限前需补充**：家长验证码、数据隔离、速率限制。

---

## 9. 成本估算

### 9.1 单用户完整体验成本

| 服务 | 调用次数 | 单价 | 小计 |
|---|---|---|---|
| Claude Sonnet 4.5 (Pass1) | 7 次 | ¥0.02/次 | ¥0.14 |
| Claude Sonnet 4.5 (Pass2) | 7 次 | ¥0.01/次 | ¥0.07 |
| Claude Sonnet 4.5 (keyword_extract) | 3 次 | ¥0.02/次 | ¥0.06 |
| Claude Sonnet 4.5 (day7) | 1 次 | ¥0.05/次 | ¥0.05 |
| Claude Sonnet 4.5 (correction) | ~3 次 | ¥0.01/次 | ¥0.03 |
| Claude Sonnet 4.5 (概念详情) | ~2 次 | ¥0.02/次 | ¥0.04 |
| Claude Sonnet 4.5 (free_chat) | ~2 次 | ¥0.01/次 | ¥0.02 |
| Claude Sonnet 4.5 (驿站 visit+school+plaza) | ~3 次 | ¥0.05/次 | ¥0.15 |
| 通义千问-VL (风格审核) | ~6 次 | ¥0.01/次 | ¥0.06 |
| 通义万相 (图像生成) | ~4 次 | ¥0.20/次 | ¥0.80 |
| 阿里云 ASR (Paraformer) | ~7 次 | ¥0.01/次 | ¥0.07 |
| 阿里云内容安全 | ~6 次 | ¥0.005/次 | ¥0.03 |
| **合计（7 天+少量驿站）** | | | **¥1.52** |
| **含驿站完整体验** | | | **¥1.80** |

### 9.2 月运营成本（100 用户）

| 项目 | 月费 |
|---|---|
| 阿里云 ECS × 2 (2c4g) | ¥400 |
| 阿里云 RDS PostgreSQL (2c4g) | ¥300 |
| 阿里云 Redis (1GB) | ¥100 |
| 阿里云 OSS (50GB) | ¥10 |
| 阿里云 SLB | ¥70 |
| LLM API 费用 (100 × ¥1.80) | ¥180 |
| **合计** | **¥1,060/月** |

V0.6.1 预估 ¥2.0/用户（DeepSeek），V1.0 切换到 Claude 后单价反而略降，因为：
- 图像生成串行化（去掉双路）节省了一半图像成本
- Claude token 效率更高，单次调用更省

---

## 10. 风险与待决议项

### 10.1 高风险项

| 风险 | 影响 | 缓解措施 | 负责阶段 |
|---|---|---|---|
| Claude 中文角色扮演不稳定 | Day 7 档案情感不足 | W1 20 条中文样本测试，< 80% 回退 DeepSeek | W1 |
| 通义万相风格一致性差 | 卡片不像纸片风 | W1 10 场景测试集评分 ≥ 4/5，不达标用 MiniMax | W1 |
| 儿童语音 ASR 准确率低 | 语音输入大量误识别 | W1 5-10 个真实儿童测试，< 80% 引入儿童 ASR 模型 | W1 |
| Day 7「顿悟时刻」不触动 | 核心教育目标无法达成 | W5 先用人肉走通 3 次，确认体验后再写代码 | W5 |
| 广场剧本 8 岁孩子看不懂 | 第四层教育目标丢失 | W7 5 个孩子阅读测试，必要时简化语言 | W7 |

### 10.2 中风险项

| 风险 | 缓解措施 |
|---|---|
| LLM 成本超预算 | 单用户限频（7 天 30 次 LLM 调用），驿站每天 1 次 |
| 记忆面板认知负荷过高 | W4 纸面原型测试 8 岁孩子，必要时压缩为 2 区块 |
| 卡片风格漂移 | 三重锁定 + 风格审核，基准图从 zero-shot 中筛选最佳 |
| 图像生成等待 >20s | 串行主路 → 兜底，p95 ≤ 10s，超时用文字降级卡片 |
| 无登录方案数据安全 | V1.0 不上线公网，仅内测使用 |

### 10.3 待决议项

| # | 决议项 | 默认方案 |
|---|---|---|
| D1 | Claude vs DeepSeek 最终选择 | W1 测试后决定 |
| D2 | 通义万相 vs MiniMax 主路 | W1 测试后决定 |
| D3 | MySQL → PostgreSQL 迁移范围 | 全新 init，保留 MySQL 历史文件 |
| D4 | 30s 引导视频 vs 2 张卡片 | 2 张卡片（降低首次加载） |
| D5 | 「再加一段」录音拼接 | 默认实现（V0.6.1 已实装，V1.0 保留） |
| D6 | 记忆面板「AI reasoning」对孩子可见 | 仅对家长可见（V1.0 无家长端，先隐藏） |
| D7 | 学校班长固定 vs 每日随机 | 每日随机 |
| D8 | 广场剧本 3 幕固定 vs 可变幕数 | 固定 3 幕 |
| D9 | 毕业后每天可出门次数 | 1 次/天 |
| D10 | 上线前家长验证码 | V1.0 不做，纯内测 |

### 10.4 上线前补做（不阻塞当前开发）

PRD §28 列出的技术质量指标：

- 5–10 个真实儿童语音 ASR 准确率测试（< 80% 需引入儿童模型）
- 100+ 张生成图人工风格审核
- metrics dashboard：ASR 准确率、确认率、major 失败率、p95 时长
- 异常告警阈值配置
- 语音文件 30 天自动清理 cron
- 成本预算审核与告警
- 阿里云内容安全策略调优
- 家长验证码机制

---

## 附录 A：全部文档交叉引用

| 文档 | 核心内容 |
|---|---|
| [Home_MVP_PRD_V1.0.md](Home_MVP_PRD_V1.0.md) | 产品需求规范（250KB，29 章） |
| [Home_V1.0_Plan_01_基础能力与数据层.md](Home_V1.0_Plan_01_基础能力与数据层.md) | 技术栈迁移、DB schema、类型体系、基础能力 |
| [Home_V1.0_Plan_02_核心流程改造.md](Home_V1.0_Plan_02_核心流程改造.md) | 7 天流程 API、前端页面、组件、记忆面板、房间渲染 |
| [Home_V1.0_Plan_03_伙伴驿站.md](Home_V1.0_Plan_03_伙伴驿站.md) | 驿站地图、朋友家、学校、广场、行囊、API |
| [Home_V1.0_Plan_04_毕业交付.md](Home_V1.0_Plan_04_毕业交付.md) | Day 7 档案、毕业卡、Prompt、设计资产、安全、测试、部署、成本 |

## 附录 B：新增文件清单

```
# 数据库
db/migrations/0004_v1_init_pg.sql
db/migrations/0005_v1_seed.sql

# 类型
src/types/index.ts（重写）

# DB 层
src/lib/db/client.ts（重写）
src/lib/db/repos.ts（重写 SQL）
src/lib/db/cardsRepo.ts（重写 SQL）

# 存储
src/lib/storage/client.ts（新建）

# 驿站核心
src/lib/station/unlock.ts
src/lib/station/matching.ts
src/lib/station/renderHome.ts

# 编排
src/lib/orchestrate/processVisit.ts
src/lib/orchestrate/processSchool.ts
src/lib/orchestrate/processPlaza.ts

# Code Assets
data/companion_invitations.json
data/system_questions.json
data/teaching_moments.json
data/items/knowledge.json
data/items/object.json
data/items/gift.json
data/items/ability.json
data/scenarios/water_disaster.json
data/scenarios/envoy_visit.json
data/scenarios/plague_outbreak.json
data/scenarios/court_intrigue.json
data/scenarios/border_alarm.json

# Prompt 资产（新建 4 组 + 重写 9 组）
prompts/visit/system.md
prompts/visit/examples.json
prompts/school/system.md
prompts/school/examples.json
prompts/plaza_act/system.md
prompts/plaza_ending/system.md

# 前端页面 (14 个新建)
src/app/station/map/page.tsx
src/app/station/visit/purpose/page.tsx
src/app/station/visit/departing/page.tsx
src/app/station/visit/report/page.tsx
src/app/station/school/purpose/page.tsx
src/app/station/school/departing/page.tsx
src/app/station/school/report/page.tsx
src/app/station/plaza/prep/page.tsx
src/app/station/plaza/act/[n]/page.tsx
src/app/station/plaza/ending/page.tsx
src/app/station/backpack/page.tsx
src/app/station/backpack/[id]/page.tsx

# 前端组件 (8 个新建)
src/components/station/StationMap.tsx
src/components/station/VisitPurposeSelector.tsx
src/components/station/VisitReport.tsx
src/components/station/SchoolClassroom.tsx
src/components/station/PlazaAct.tsx
src/components/station/PlazaEnding.tsx
src/components/station/BackpackGrid.tsx
src/components/station/OtherHomeRenderer.tsx
src/components/day7/ArchiveReveal.tsx
src/components/day7/GraduationCard.tsx
src/components/day7/BarrierText.tsx

# 测试 (17 个新建)
tests/e2e/day7-archive.spec.ts
tests/e2e/day7-graduation.spec.ts
tests/e2e/station-unlock.spec.ts
tests/e2e/station-visit.spec.ts
tests/e2e/station-school.spec.ts
tests/e2e/station-plaza.spec.ts
tests/e2e/station-backpack.spec.ts
tests/e2e/content-audit-block.spec.ts
tests/api/station-status.spec.ts
tests/api/station-depart.spec.ts
tests/api/station-trip.spec.ts
tests/api/station-plaza-play.spec.ts
tests/api/station-plaza-finish.spec.ts
tests/api/inventory.spec.ts
```

---

*文档结束 — V1.0 实施方案四份文档全部完成*
