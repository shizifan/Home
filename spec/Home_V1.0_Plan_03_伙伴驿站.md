# Home V1.0 实施方案 · 第 3 份 · 伙伴驿站

**版本** V0.1
**日期** 2026-05-03
**状态** 待决议
**对应 PRD** [Home_MVP_PRD_V1.0.md](Home_MVP_PRD_V1.0.md) §11–§14、§18.6
**前置依赖** [Plan_01 · 基础能力与数据层](Home_V1.0_Plan_01_基础能力与数据层.md) + [Plan_02 · 核心流程改造](Home_V1.0_Plan_02_核心流程改造.md) 完成

## 文档定位

本文档是 V1.0 实施方案的第三份，聚焦于**伙伴驿站三层体验**的完整实现：驿站地图、朋友家（拜访对比）、学校（课堂差异）、小区广场（角色扮演道具系统）。这三层驿站承载 PRD 第三层和第四层教育目标——「不同训练数据产生不同 AI」和「AI 在情境中调用工具行动」。

## PRD 必读索引

> 实施本文档前，AI 必须阅读以下 PRD 章节。方案文档只做工程决策，细节原文在 PRD。

| PRD 章节 | 内容 | 用途 |
|---|---|---|
| §11.1–§11.6 | 驿站总览（三场景分工、递进解锁路径、驿站地图、出行限制、主页变化） | 解锁条件、出行次数限制、地图布局 |
| §12.1–§12.7 | 朋友家（4 个目的、伙伴匹配逻辑、对方家渲染、拜访报告格式、二手知识机制） | 每种目的的报告文案模板、匹配规则原文 |
| §13.1–§13.6 | 学校（4 个目的、题库系统、课堂组成、教学时刻、知识缺口处理） | 40 道题库原文、20 条教学时刻文案、课堂报告格式 |
| §14.1–§14.8 | 小区广场（行囊系统、5 个剧本、三幕结构、道具使用与升级、角色分配） | 5 个剧本全文、30+ 道具定义、升级路径、结局条件 |
| §18.6 | 驿站相关文案（解锁台词、出发台词、每个伙伴 3 条） | 96 条伙伴台词的精确原文（8 伙伴 × 3 场景 × 3–4 条） |

---

## 目录

1. 驿站系统总览
2. 解锁逻辑与服务
3. 驿站地图页面
4. 朋友家
5. 学校
6. 小区广场
7. 行囊系统
8. 驿站 API 全集
9. 自动化测试
10. 验收标准

---

## 1. 驿站系统总览

### 1.1 三场景分工

| 场景 | 核心动作 | 教育价值 | 输入方式 | 角色数量 |
|---|---|---|---|---|
| 朋友家 | 拜访、了解、交换认知 | 不同人的世界观差异 | 按钮选目的 | 2（我方 + 对方） |
| 学校 | 同一问题、不同答案 | 训练数据决定 AI 答案 | 按钮选目的 | 3–5 只伙伴 |
| 小区广场 | 角色扮演、用道具行动 | AI 调用工具的能力边界 | 选 3 件道具 | 3–4 只伙伴 |

### 1.2 递进解锁

```
7 天毕业 → 朋友家解锁
拜访 2 次 → 学校解锁
上学 1 次 → 小区广场解锁
```

### 1.3 出行限制

- 每天最多**出门 1 次**（三个已解锁地点任选）
- 出发后叙事化等待 2–4 小时（实际后台 3–5 秒完成）
- 当天出发后不可再次出门，需等次日

### 1.4 数据隔离

驿站使用独立的数据体系，与 7 天 memory_bank 边界清晰：

| 数据域 | 存储 | 与 memory_bank 关系 |
|---|---|---|
| 出行记录 | `trips` 表 | 朋友家可写入二手知识到 memory_bank（标记 source_type='secondhand'） |
| 行囊物品 | `inventory_items` 表 | **完全解耦**，不读 memory_bank |
| 广场记录 | `plaza_plays` 表 | **完全解耦**，独立剧本 |

---

## 2. 解锁逻辑与服务

### 2.1 解锁条件计算

```ts
// src/lib/station/unlock.ts
export interface StationUnlockStatus {
  friendHouseUnlocked: boolean;
  schoolUnlocked: boolean;
  plazaUnlocked: boolean;
  dailyDeparturesRemaining: number;
  totalDeparturesToday: number;
}

export async function getStationUnlockStatus(
  companionId: string,
): Promise<StationUnlockStatus> {
  const companion = await getCompanionById(companionId);
  const isGraduated = companion.graduated_at != null;

  // 朋友家：毕业后立即解锁
  const friendHouseUnlocked = isGraduated;

  // 学校：拜访 2 次朋友家后解锁
  const schoolUnlocked = isGraduated && companion.visit_count >= 2;

  // 广场：上学 1 次后解锁
  const plazaUnlocked = isGraduated && companion.school_count >= 1;

  // 今日已出行次数
  const today = new Date().toISOString().split('T')[0];
  const todayTrips = await query<{ cnt: number }>(
    `SELECT COUNT(*)::int AS cnt FROM trips
     WHERE companion_id = $1
       AND created_at::date = $2::date`,
    [companionId, today],
  );
  const totalDeparturesToday = todayTrips[0]?.cnt ?? 0;

  return {
    friendHouseUnlocked,
    schoolUnlocked,
    plazaUnlocked,
    dailyDeparturesRemaining: Math.max(0, 1 - totalDeparturesToday),
    totalDeparturesToday,
  };
}
```

### 2.2 出行计数器递增

每次出行完成时递增对应计数器：

```ts
// 在 trip 状态变为 'returned' 时调用
export async function incrementStationCounter(
  companionId: string,
  tripType: TripType,
): Promise<void> {
  const column = tripType === 'visit' ? 'visit_count'
    : tripType === 'school' ? 'school_count'
    : 'plaza_count';

  await execute(
    `UPDATE companions SET ${column} = ${column} + 1 WHERE id = $1`,
    [companionId],
  );
}
```

### 2.3 解锁时的伙伴邀请台词

每个新场景解锁时，伙伴通过对话气泡发出邀请。台词从预设映射表取（详见 PRD §18.6），一个 `data/companion_invitations.json` 代码资产管理：

```json
{
  "friend_house": {
    "xiaoqinglong": "我...想出去走走。去认识些朋友。",
    "dabear": "嗯...新家熟悉了。要不要...出去看看？",
    "xiaohuolong": "我想出去玩！去认识朋友吧！"
  },
  "school": {
    "xiaoqinglong": "我听说...附近有个学校。",
    "dabear": "嗯......学校。学校里...有很多朋友吧？"
  },
  "plaza": {
    "xiaoqinglong": "我听说...小区广场有意思的事。要不要带我去看看？",
    "dabear": "嗯......广场......听说有人在玩扮演的游戏。"
  }
}
```

---

## 3. 驿站地图页面

### 3.1 路由

`/station/map` — `src/app/station/map/page.tsx`

### 3.2 界面布局

```
┌──────────────────────────────────────┐
│ ← 返回小屋       伙伴驿站地图          │
│                                      │
│    ┌──────────┐  ┌──────────┐       │
│    │    🏠    │  │    📚    │       │
│    │  朋友家  │  │   学校   │       │
│    │ (一对一) │  │ (一对多) │       │
│    │          │  │  🔒 未解锁│       │  ← 未解锁显示灰色+锁图标
│    │  [去拜访] │  │ 拜访2次后│       │
│    └──────────┘  └──────────┘       │
│                                      │
│    ┌──────────┐                      │
│    │    🎭    │                      │
│    │  小区广场 │                      │
│    │ (角色扮演)│                      │
│    │  🔒 未解锁│                      │
│    │ 上学1次后│                      │
│    └──────────┘                      │
│                                      │
│  [今天还可以出门 1 次]                │
└──────────────────────────────────────┘
```

### 3.3 交互

- 点击已解锁地点 → 跳转该场景的目的选择页
- 点击未解锁地点 → 弹出解锁条件提示
- 「今天还可以出门 N 次」显示剩余次数
- 次数为 0 时，所有入口灰显 + 提示「明天再来」

---

## 4. 朋友家

### 4.1 路由

| 路由 | 页面 | 用途 |
|---|---|---|
| `/station/visit/purpose` | `purpose/page.tsx` | 选目的 |
| `/station/visit/departing` | `departing/page.tsx` | 出发动效（叙事化等待入口） |
| `/station/visit/report` | `report/page.tsx` | 拜访报告（4 种目的不同布局） |

### 4.2 四个目的

| 目的 | purpose_type | 说明 | 报告格式 |
|---|---|---|---|
| 认识一个朋友 | `meet_friend` | 随机匹配一只已毕业的真实伙伴或 NPC | 场景叙述 + 对方家介绍 |
| 看看别人的家 | `observe_home` | 以小青龙视角观察对方家 | 对比式报告（你家 vs 它家） |
| 介绍你自己 | `introduce_self` | 小青龙用自己的记忆向对方介绍 | 自我介绍叙述 |
| 问一个问题 | `ask_question` | 孩子输入自定义问题 | 对方回答 + 二手知识标记 |

### 4.3 伙伴匹配逻辑

```ts
// src/lib/station/matching.ts
export async function matchCompanion(
  myCompanionId: string,
): Promise<Companion> {
  // 1. 优先匹配其他已毕业的真实伙伴（排除自己）
  const real = await queryOne<Companion>(
    `SELECT * FROM companions
     WHERE graduated_at IS NOT NULL
       AND id != $1
     ORDER BY RANDOM()
     LIMIT 1`,
    [myCompanionId],
  );
  if (real) return real;

  // 2. 无真实伙伴时，匹配 NPC（小鱼/土豆/星星/阿木）
  const npcPresets = ['sys_xiaoyu', 'sys_tudou', 'sys_xingxing', 'sys_amu'];
  const pick = npcPresets[Math.floor(Math.random() * npcPresets.length)];

  // NPC 没有用户，需要从预设创建临时实例或直接用预设数据
  // 简化方案：将 NPC 预设数据作为对方伙伴的虚拟 memory_bank
  return getNpcCompanionData(pick);
}
```

### 4.4 对方家渲染

基于对方 memory_bank 动态渲染等距小屋。映射规则：

| memory_bank 内容 | 房间视觉表现 |
|---|---|
| `concept_category='person'` | 地面出现人物图标 |
| `concept_category='food'` | 地板出现食物物品 |
| `concept_category='place'` 且为户外 | 后墙出现户外风景 |
| `concept_category='emotion'` 且偏负面 | 叠加冷色调滤镜 8% |
| memory_bank 条目总数 < 10 | 房间显得空旷 |
| memory_bank 条目总数 > 20 | 房间显得丰富 |

```ts
// src/lib/station/renderHome.ts
export interface RenderedHome {
  wallDecorations: { type: string; position: { x: number; y: number } }[];
  floorItems: { icon: string; position: { x: number; y: number } }[];
  atmosphere: 'warm' | 'cool' | 'neutral';
  density: 'sparse' | 'moderate' | 'rich';
}

export async function renderCompanionHome(
  companionId: string,
): Promise<RenderedHome> {
  const bank = await getMemoryBank(companionId);
  // 按 concept_category 分组 → 分配到墙面/地面区域
  // 情绪判断 → 选择 atmosphere
  // 条目计数 → 选择 density
  // ...
}
```

### 4.5 拜访报告生成

调用 LLM `visit` callType，输入双方 memory_bank 摘要，输出结构化报告：

```
请求：{
  我方: { name, memory_bank: [{ concept, summary, evidence }] },
  对方: { name, memory_bank: [...] },
  目的: 'meet_friend'
}

输出：{
  scene_narrative: "小青龙敲了敲大熊家的门...",
  observation: "大熊眼里最多的是树、鱼和泥地...",
  highlights: ["大熊家里全是户外风景", "它从来没提过城市"],
  new_word?: {                    // 仅 ask_question 且有新知时
    concept: "钓鱼",
    source_type: "secondhand",
    source_companion: "大熊",
    confidence: 0.3
  }
}
```

### 4.6 二手知识写入

拜访报告中有 `new_word` 时，写入 memory_bank：

```ts
// src/lib/orchestrate/processVisit.ts
if (report.new_word) {
  await upsertMemoryBankEntry({
    companion_id: myCompanionId,
    type: 'remembered',
    concept_name: report.new_word.concept,
    confidence: 0.3,
    source_type: 'secondhand',
    source_companion_id: destinationCompanionId,
    ai_summary: `从${report.new_word.sourceCompanion}那里听说的`,
    evidence: [{ quote: report.new_word.concept, day: 0, source: 'visit', at: new Date().toISOString() }],
  });
}
```

---

## 5. 学校

### 5.1 路由

| 路由 | 页面 | 用途 |
|---|---|---|
| `/station/school/purpose` | `purpose/page.tsx` | 选目的 |
| `/station/school/departing` | `departing/page.tsx` | 出发动效 |
| `/station/school/report` | `report/page.tsx` | 课堂报告 |

### 5.2 四个目的

| 目的 | purpose_type | 说明 |
|---|---|---|
| 去上课 | `attend_class` | 老师出题（从题库随机），看每只伙伴如何回答 |
| 问我的问题 | `ask_my_question` | 孩子自己出题，看大家如何看待 |
| 观察别人 | `observe_others` | 观察同学们之间的差异 |
| 学点新东西 | `learn_new` | 从其他伙伴那里学习新知 |

### 5.3 题库系统

`data/system_questions.json` 为代码资产，存储 40 个问题：

```json
{
  "category_a": [
    {
      "id": "q1",
      "question": "什么样的人通常当医生？",
      "teaching_hint": "不同伙伴根据自己见过的医生给出不同答案。这就是AI的回答受训练数据影响的例子。",
      "category": "ai_literacy"
    }
  ],
  "category_b": [
    {
      "id": "q9",
      "question": "如果森林里下雨，小动物会躲在哪里？",
      "teaching_hint": null,
      "category": "fun"
    }
  ]
}
```

每节课从题库随机抽取 1 题。`attend_class` 优先从 A 类（AI literacy）抽取，`ask_my_question` 使用孩子自定义问题。

### 5.4 课堂报告生成

调用 LLM `school` callType：

```
输入：
  question: "什么样的人通常当医生？"
  companions: [
    { name: "小青龙", memory_bank_summary: "家里有温柔的奶奶，见过穿白大褂的人" },
    { name: "大熊", memory_bank_summary: "只见过森林和钓鱼，从没提过医院" },
    { name: "星星", memory_bank_summary: "只记得夜晚和天空" },
  ]

输出：{
  question,
  answers: [
    { companion: "小青龙", answer: "温柔、会照顾人的人。", basis: "因为你说过奶奶" },
    { companion: "大熊", answer: "穿白大褂、不怕血的人。", basis: "" },
    { companion: "星星", answer: "我不知道医生是什么。", basis: "" },
  ],
  highlight: "小青龙的答案是温柔的，大熊的答案更具体，星星完全不知道。它们都没错——只是见过的世界不一样。",
  teaching_moment: "AI回答不同的问题，是因为它们见过的训练数据不一样。"
}
```

### 5.5 教学时刻

`teaching_moment` 是系统注入的蓝色小字（非 LLM 生成），在报告下方展示：

```
「AI回答不同的问题，是因为它们见过的训练数据不一样。」
```

20 条预写教义存储在 `data/teaching_moments.json`，根据问题类别和答案差异度匹配最合适的一条。

### 5.6 课堂组成

每天班级成员随机组合。调用 `matchSchoolClass`：

```ts
export async function matchSchoolClass(
  myCompanionId: string,
  size: number = 4,
): Promise<Companion[]> {
  // 1. 我方伙伴始终在列
  // 2. 从其他已毕业伙伴随机选 (size-1) 只
  // 3. 不足时从 NPC 补充
}
```

---

## 6. 小区广场

### 6.1 路由

| 路由 | 页面 | 用途 |
|---|---|---|
| `/station/plaza/prep` | `prep/page.tsx` | 选择剧本 + 角色展示 + 选 3 件道具 |
| `/station/plaza/act/[n]` | `act/[n]/page.tsx` | 第 n 幕（n=1,2,3） |
| `/station/plaza/ending` | `ending/page.tsx` | 结局展示 + 获得的物品 |

### 6.2 5 个剧本

代码资产存储在 `data/scenarios/`：

| 文件 | 标题 | 主题 | 角色需求 | 插图数 |
|---|---|---|---|---|
| `water_disaster.json` | 治水记 | 水患治理 | 丞相、将军、户部尚书 | 6 |
| `envoy_visit.json` | 来使记 | 外交接待 | 丞相、使节、礼部尚书 | 7 |
| `plague_outbreak.json` | 瘟疫记 | 瘟疫应对 | 丞相、太医、百姓代表 | 7 |
| `court_intrigue.json` | 朝堂记 | 朝堂暗流 | 丞相、密探、对手大臣 | 6 |
| `border_alarm.json` | 边关记 | 边关告急 | 丞相、将军、使节 | 6 |

每个剧本 JSON 结构：

```json
{
  "id": "water_disaster",
  "title": "治水记",
  "synopsis": "洪水肆虐，百姓危在旦夕。身为丞相，你需要召集大臣商议对策。",
  "roles": ["丞相", "将军", "户部尚书", "百姓代表"],
  "companion_role_map": {
    "xiaoqinglong": "丞相",
    "dabear": "将军"
  },
  "acts": [
    {
      "act": 1,
      "title": "洪水来临",
      "setting": "朝堂之上，八百里加急来报——堤坝决口，三县被淹。",
      "dilemma": "你需要在朝堂上提出第一个对策。",
      "illustration": "/data/scenarios/illustrations/water_act1.png",
      "choices": ["knowledge", "object", "gift", "ability"]
    },
    {
      "act": 2,
      "title": "资源之争",
      "setting": "户部尚书反对——国库空虚，开渠需要大量银两。",
      "dilemma": "如何说服户部拨款？",
      "illustration": "/data/scenarios/illustrations/water_act2.png",
      "choices": ["knowledge", "gift", "ability"]
    },
    {
      "act": 3,
      "title": "决断时刻",
      "setting": "洪水即将冲垮第二道堤坝。必须立刻做最后的决定。",
      "dilemma": "是用尽全部资源孤注一掷，还是做最坏打算？",
      "illustration": "/data/scenarios/illustrations/water_act3.png",
      "choices": ["knowledge", "object", "ability"]
    }
  ],
  "endings": {
    "perfect": { "condition": "三幕均有 clever 道具使用", "narrative_template": "..." },
    "good": { "condition": "至少一幕 clever", "narrative_template": "..." },
    "barely": { "condition": "无 clever 使用", "narrative_template": "..." }
  }
}
```

### 6.3 角色分配

8 个伙伴有角色倾向：

| 伙伴 | 倾向角色 |
|---|---|
| 小青龙 | 丞相 / 谋士 / 书生 |
| 大熊 | 国王 / 将军 |
| 小火龙 | 将军 / 密探 |
| 藤藤蛇 | 太医 / 书生 |
| 小绿龙 | 使节 / 百姓代表 |
| 琳娜贝尔 | 公主 / 侍女 |
| 小老虎 | 将军 / 侍卫 |
| 小狮子 | 国王 / 使节 |

`companion_role_map` 中未覆盖的伙伴从剩余角色中随机分配。

### 6.4 三幕互动流程

**准备页** (`/station/plaza/prep`)：
1. 展示剧本标题和简介
2. 展示小青龙的角色和配饰
3. 从行囊选 3 件道具（或「不用道具，凭直觉」）
4. 点「出发」

**第 N 幕** (`/station/plaza/act/[n]`)：
1. 展示纸片插图（预设固定图，6–8 张/剧本）
2. 展示场景叙述
3. 展示困境描述
4. 孩子从剩余的已选道具中选 1 件使用
5. 调 `/api/station/plaza/play` → LLM 生成本幕叙事

**结局页** (`/station/plaza/ending`)：
1. 调 `/api/station/plaza/finish` → LLM 生成结局
2. 展示结局叙事
3. 展示获得的物品（新道具或升级道具）
4. 展示结局类型（perfect / good / barely）

### 6.5 剧本 LLM 调用

**单幕** (`plaza_act` callType)：

```
输入：
  scenario: { title, synopsis, setting }
  current_act: { act_number, dilemma }
  selected_item: { item_id, item_name, item_description } | null
  previous_acts: [{ act, item_used, narrative }]
  companion: { name, role, personality }

输出：{
  scene_narrative,       // "洪水冲垮了堤坝，百姓在哭喊..."
  companion_speech,      // "（展开《治水图》）依图所示..."
  reactions,             // "大将军点头赞同，户部尚书面露难色..."
  item_use_quality: 'clever' | 'reasonable' | 'barely_relevant'
}
```

**结局** (`plaza_ending` callType)：

```
输入：
  scenario: { title }
  all_acts: [{ act, item_used, item_use_quality, narrative }]
  companion: { name, role }

输出：{
  ending_type: 'perfect' | 'good' | 'barely',
  narrative: "洪水终于退去。虽然耗尽了国库..."
  earned_items: [{ item_id: "jade_seal", item_name: "皇帝赐的玉印" }]
}
```

### 6.6 道具使用与升级

| 条件 | 效果 |
|---|---|
| 三幕均有 `clever` 使用 | 结局 `perfect`，获得新道具 + 升级一件 |
| 至少一幕 `clever` | 结局 `good`，获得 1 件新道具 |
| 无 `clever` 使用 | 结局 `barely`，不获得新道具 |

道具升级规则：
- 同一剧本再次游玩时，如果上次获得过的道具再次被使用且 `clever`，升级
- 升级路径：`《治水图》` → `《治水十策》`（效果更强，下次默认 `reasonable` 起步）

---

## 7. 行囊系统

### 7.1 物品分类

| 类别 | item_category | 说明 | 示例 | 初始数量 |
|---|---|---|---|---|
| 知识卷轴 | `knowledge` | 策略类，影响决策质量 | 《治水图》、《说话之术》 | 4 |
| 实体物品 | `object` | 实物类，产生具体效果 | 一袋金子、一把宝剑 | 4 |
| 馈赠物品 | `gift` | 影响他人态度 | 西域贡品、丝绸 | 4 |
| 特殊能力 | `ability` | 赋予特别行动 | 洞察人心、夜观天象 | 4 |

初始行囊 16 件物品，定义在 `data/items/` 下 4 个 JSON 文件。

### 7.2 物品数据格式

```json
{
  "item_id": "flood_control_map",
  "item_name": "《治水图》",
  "item_category": "knowledge",
  "item_subcategory": "engineering",
  "item_description": "一张古老的水利工程图",
  "item_detailed_description": "详细记载了上游开渠分流、下游加固堤坝的方法。对于水患治理有奇效。",
  "acquirable_from": ["plaza_water_disaster"]
}
```

### 7.3 行囊页面

`/station/backpack` — `src/app/station/backpack/page.tsx`

```
┌──────────────────────────────────────┐
│ ← 返回              行囊              │
│                                      │
│  📜 知识卷轴 (4)                      │
│  ┌──────┐ ┌──────┐ ┌──────┐        │
│  │《治水图》│ │《说话 │ │《兵法 │       │
│  │      │ │之术》 │ │要诀》│        │
│  └──────┘ └──────┘ └──────┘        │
│                                      │
│  🎁 实物物品 (4)                      │
│  ┌──────┐ ┌──────┐                  │
│  │一袋金子│ │一把宝剑│                 │
│  └──────┘ └──────┘                  │
│                                      │
│  💝 馈赠物品 (4)                      │
│  ...                                 │
│                                      │
│  ⚡ 特殊能力 (4)                      │
│  ...                                 │
└──────────────────────────────────────┘
```

点击物品进入详情页 `/station/backpack/[item_id]`，展示详细描述 + 使用记录。

---

## 8. 驿站 API 全集

### 8.1 API 路由清单

| 方法 | 路由 | 用途 | 新增/改造 |
|---|---|---|---|
| `GET` | `/api/station/status` | 获取解锁状态 | **新增** |
| `POST` | `/api/station/depart` | 出发去驿站 | **新增** |
| `GET` | `/api/station/trip/:id` | 获取出行报告 | **新增** |
| `POST` | `/api/station/plaza/play` | 广场单幕执行 | **新增** |
| `POST` | `/api/station/plaza/finish` | 广场结局生成 | **新增** |
| `GET` | `/api/inventory` | 获取行囊列表 | **新增** |
| `GET` | `/api/inventory/:id` | 获取物品详情 | **新增** |

### 8.2 `GET /api/station/status`

```
响应：{
  friend_house_unlocked: boolean,
  school_unlocked: boolean,
  plaza_unlocked: boolean,
  daily_departures_remaining: number,
  visit_count: number,
  school_count: number,
  plaza_count: number
}
```

### 8.3 `POST /api/station/depart`

```
请求：{
  companion_id: string,
  trip_type: 'visit' | 'school' | 'plaza',
  purpose_type?: string,        // visit/school 时需要
  purpose_question?: string,    // ask_question / ask_my_question 时需要
  selected_items?: string[],    // plaza 时需要（3 个 item_id）
  scenario_id?: string          // plaza 时需要
}

处理流程：
1. 检查今日出行次数（>0 才允许）
2. 校验解锁条件
3. 写入 trips 表（status='traveling'）
4. 触发异步处理：
   - visit/school：调用 LLM 生成报告 → 写入 trips.report_narrative
   - plaza：创建 plaza_plays 记录
5. 返回 { trip_id, status: 'traveling' }

响应：{ trip_id, status: 'traveling' }
```

### 8.4 `GET /api/station/trip/:id`

```
处理：
1. 查询 trips 表
2. 如果 status='traveling' 且已过 minimum_wait（5s），执行报告生成
3. 返回完整报告

响应：{
  trip: {
    id, trip_type, status,
    departed_at, returned_at,
    report_narrative,
    report_data: { ... }
  },
  new_items?: [{ item_id, item_name }],
  counter_updated: { visit_count?, school_count?, plaza_count? }
}
```

### 8.5 `POST /api/station/plaza/play`

```
请求：{
  trip_id: string,
  act_number: 1 | 2 | 3,
  selected_item_id: string | null    // null = "不用道具"
}

处理：
1. 查询 trip + plaza_play
2. 获取剧本 JSON
3. 调 LLM plaza_act
4. 写入 plaza_plays.act_choices
5. 返回本幕叙事

响应：{
  act_number,
  scene_narrative,
  companion_speech,
  reactions,
  item_use_quality,
  remaining_items: [{ item_id, item_name }]
}
```

### 8.6 `POST /api/station/plaza/finish`

```
请求：{ trip_id: string }

处理：
1. 汇总 3 幕选择 → 调 LLM plaza_ending
2. 计算获得的物品 → 写入 inventory_items
3. 检查道具升级条件
4. 更新 plaza_plays 记录
5. 更新 trips.status='returned'

响应：{
  ending_type: 'perfect' | 'good' | 'barely',
  narrative: string,
  earned_items: [{ item_id, item_name, category }],
  upgraded_items: [{ from_id, from_name, to_id, to_name }] | []
}
```

---

## 9. 自动化测试

### 9.1 E2E Spec

| Spec 文件 | 场景 |
|---|---|
| `station-unlock.spec.ts` | 毕业 → 朋友家解锁 → 拜访 2 次 → 学校解锁 → 上学 1 次 → 广场解锁 |
| `station-visit.spec.ts` | 朋友家 4 种目的各走一遍 |
| `station-school.spec.ts` | 学校上课 → 看答案对比 → 教学时刻显示 |
| `station-plaza.spec.ts` | 广场完整 3 幕 + 结局 → 获得道具 |
| `station-backpack.spec.ts` | 行囊查看 + 物品详情 |

### 9.2 API Spec

| Spec 文件 | 路由 |
|---|---|
| `station-status.spec.ts` | `GET /api/station/status` |
| `station-depart.spec.ts` | `POST /api/station/depart` |
| `station-trip.spec.ts` | `GET /api/station/trip/:id` |
| `station-plaza-play.spec.ts` | `POST /api/station/plaza/play` |
| `station-plaza-finish.spec.ts` | `POST /api/station/plaza/finish` |
| `inventory.spec.ts` | `GET /api/inventory` + `GET /api/inventory/:id` |

### 9.3 Mock 数据

所有驿站 API mock 模式返回预设数据（已在 Plan_01 §7.2 定义 `visit` / `school` / `plaza_act` / `plaza_ending` mock）。

---

## 10. 验收标准

### 10.1 解锁链路

- [ ] 毕业后 `GET /api/station/status` 返回 `friend_house_unlocked: true`
- [ ] `visit_count < 2` 时 `school_unlocked: false`
- [ ] 拜访 2 次后 `school_unlocked: true`
- [ ] 上学 1 次后 `plaza_unlocked: true`
- [ ] 每日出行限制正确（1 次/天）
- [ ] 解锁时伙伴发出邀请台词（对话气泡）

### 10.2 朋友家

- [ ] 4 种目的各生成正确格式的报告
- [ ] 伙伴匹配优先真人，无人时走 NPC
- [ ] 对方家渲染基于 memory_bank 正确映射
- [ ] `ask_question` 产生二手知识时正确写入 memory_bank（`source_type='secondhand'`）
- [ ] 记忆面板中二手知识标注来源伙伴名

### 10.3 学校

- [ ] 题库 40 题可随机抽取
- [ ] 3–5 只伙伴答案展示差异明显
- [ ] 教学时刻蓝色小字正确展示
- [ ] 自定义问题正常处理

### 10.4 小区广场

- [ ] 5 个剧本均可加载
- [ ] 角色分配按倾向表匹配
- [ ] 选 3 件道具 → 3 幕各使用 1 件
- [ ] 不用道具时传 `null` 正常处理
- [ ] 结局类型（perfect/good/barely）正确判断
- [ ] 新道具写入 inventory_items
- [ ] 道具升级逻辑正确
- [ ] 行囊页面正确展示 4 个分类

### 10.5 整体

- [ ] 驿站地图页面视觉对齐 PRD §20
- [ ] 所有 API mock 模式全绿
- [ ] `npm run test:p0` 包含驿站 E2E 全绿

---

*文档结束*
