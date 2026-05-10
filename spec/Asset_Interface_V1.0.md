# Home V1.0 — 资产接入点（Asset Interface）

> 给设计师 / 内容运营的"在哪儿换"清单。每条说明：**目标资产 · 现状（占位/真稿）· 接入文件 · 验证方法**。
>
> 工程已经把所有外部资产抽象到这些点，做改动时**只动这些文件**，不会破坏路由与业务逻辑。
>
> 维护：每次新增资产接入点时同步更新此文档。

---

## 1. 伙伴立绘（8 个角色 × 3 姿态 × 5 心情）

### 1.1 现状

- 工程目前**只有小青龙（xiaoqinglong）有真稿**：`src/components/characters/Xiaoqinglong.tsx`
- 其余 7 个伙伴使用占位符（圆形剪影 + 角色色板），见 `src/components/characters/Placeholder.tsx`
- 路由层完全不感知"占位 vs 真稿"——只调用 `<Companion presetId={...} />`

### 1.2 接入步骤

1. 设计师按 `design/parts.jsx` 中小青龙的 paper-mario 规格输出 SVG / 组件代码。
   - 三种姿态：`stand` / `sit` / `lie`
   - 五种心情：`default` / `happy` / `curious` / `thinking` / `confused`
   - 输出尺寸：`viewBox="0 0 200 267"`，宽 `size`、高 `size * 1.33`
   - 色板必须使用 `src/components/characters/types.ts` 里 `COMPANION_PALETTE[presetId]`

2. 在 `src/components/characters/` 新增组件文件，例如：
   ```
   Xiaohuolong.tsx
   Tengtengshe.tsx
   Xiaolvlong.tsx
   Linnabel.tsx
   Xiaolaohu.tsx
   Xiaoshizi.tsx
   Dabear.tsx
   ```
   组件 props 必须实现 `CompanionVisualProps`（`src/components/characters/types.ts`）。

3. 在 `src/components/characters/Companion.tsx` 路由：
   ```tsx
   if (presetId === 'xiaohuolong') return <Xiaohuolong pose={pose} size={size} mood={mood} />;
   ```
   每加一个就多一个分支。把所有 8 个分支补齐后，`CompanionPlaceholder` 就不会被 fallback 走到。

### 1.3 验证

- 启动 `npm run dev` → 访问 `/home`、`/station/visit/{companion}/in`、`/station/school/{companion}/in`、`/station/plaza/play/{id}`，逐一确认 8 个角色都没出现占位的圆形剪影
- E2E：`npx playwright test` 中"角色出场"节点不应再渲染 `data-placeholder` 元素

---

## 2. 风格基准图（Paper Mario 参考图，图像生成质量调优）

### 2.1 现状

- 图像生成走 zero-shot：`src/lib/imagegen/stylePrompt.ts` 的 `STYLE_PREFIX` 把"纸片扁平 / paper-mario / 暖米黄背景"全用文字说清楚
- `STYLE_REFERENCE_IMAGES` map 中 4 个键全是 `null`，未启用
- 观察阶段：先看 zero-shot 在 dashscope wanx2.1 + minimax image-01 双源下的生图稳定度

### 2.2 接入步骤（**P6.6 调优阶段**才启用）

1. 准备 4 张基准图，按场景分类放到：
   ```
   public/style-references/indoor_room.png       室内场景（房间、教室、客厅）
   public/style-references/outdoor_place.png     室外场景（公园、街道、自然）
   public/style-references/people_with_env.png   带人物的场景
   public/style-references/object_focus.png      物体特写（保持 null = 不用参考图）
   ```
2. 修改 `src/lib/imagegen/stylePrompt.ts`：
   ```ts
   export const STYLE_REFERENCE_IMAGES = {
     indoor_room: '/style-references/indoor_room.png',
     outdoor_place: '/style-references/outdoor_place.png',
     people_with_env: '/style-references/people_with_env.png',
     object_focus: null,
   };
   ```
3. 确认 dashscope/minimax 客户端会读 `pickReferenceImage(sceneType)` 把它塞到 reference_url 字段
   （目前两个 client 文件已预留，看 `src/lib/imagegen/client.ts` / `minimaxClient.ts` 中 `referenceUrl` 调用点）

### 2.3 验证

- `prompts/shared/hard_constraints.md` 列出禁止元素，生成图后用 `src/lib/imagegen/styleAudit.ts` 自动审计风格漂移
- 人工抽样 20 张：场景 / 物体 / 人物各 5-10 张，确认基准图压制了"渲染感太重 / 真实摄影感"的偏差

---

## 3. 剧本场景插画（广场 6 个剧本 × 3 幕）

### 3.1 现状

- 完全用 SVG 渐变 + 中心 emoji 表征：`src/components/station/ScenarioIllustration.tsx`
- emoji 配置在 `THEMES` 数组里，每个场景 3 个 emoji 对应 3 幕

### 3.2 升级路径（不在 V1.0 必做，**只是接入点**）

1. 设计师补"6 场景 × 3 幕"的纸片插画，命名为：
   ```
   public/scenario-illustrations/akakura/act-1.png
   public/scenario-illustrations/akakura/act-2.png
   public/scenario-illustrations/akakura/act-3.png
   ...（其余 5 个场景同构）
   ```
   场景 key 见 `THEMES` 数组（`akakura` / `geisha-tea` / `shinto-shrine` / ...）

2. 在 `ScenarioIllustration.tsx` 把 emoji 换成 `<img src="...">` 即可，不影响调用方

### 3.3 验证

- `/station/plaza/play/{id}` 三幕推进过程中，每幕中央应展示对应插画
- 兜底：图加载失败时回到当前的 emoji 渲染

---

## 4. 伙伴文案（8 角色 × 多场景）

### 4.1 单一数据源

- **所有**伙伴台词都存在 `prompts/shared/companions.json`（V0.2.0 起）
- 工程不写死任何角色相关文案，全部通过 `src/lib/companionPresets.ts` 的访问器读取

### 4.2 字段清单（每个角色都要有）

| 字段 | 含义 | 触发位置 |
|------|------|----------|
| `name` | 中文名 | 所有 UI |
| `appearance` | 外观短语，注入 LLM system prompt | LLM 全场景 |
| `personality` | 性格短语，注入 LLM | LLM 全场景 |
| `personality_examples` | 3-5 条范例对白 | LLM few-shot |
| `skip_response` | 孩子跳过任务时的回应 | `/api/task/skip` |
| `unlock_lines.{visit,school,plaza}` | 场所首次解锁台词 | PRD §17.6 / §18.6 |
| `depart_lines.{visit,school,plaza}` | 出发前的告别语 | PRD §18.6 |
| `correction_responses.{restore,dismiss,clarify,rename,merge}` | 5 类记忆纠正反馈 | PRD §15.5 / §18.5 |
| `wait_lines[]` | 卡片生成等待文案（4 条，按 0/3s/6s/9s 切换）| PRD §6.4 / §18.4 |

### 4.3 改动方法

- **改文案**：直接编辑 `prompts/shared/companions.json` → 重启 dev server 即可
- **新增字段**：
  1. 在 `companions.json` 里给所有 8 个角色补全
  2. 在 `src/lib/companionPresets.ts` 的 `CompanionPresetMeta` 加类型 + 访问器
  3. 业务调用方用访问器（带兜底），不要直接 `getCompanionPreset(...).newField`

### 4.4 验证

- `npm run prompt:eval` 跑 pass1 评估，确保新文案不破坏概念抽取准确率
- 抽样：每个角色随机选 5 条 line 在前端 UI 实际触发位置看一眼

---

## 5. 图标 / 表情 / 微动效

### 5.1 现状

- 全部用 emoji（`🏯` `🌊` `🎎` ...）或 SVG inline
- 没有任何 PNG 图标资产

### 5.2 升级方向（V1.0 之后再考虑）

- 若要替换为 lottie / svg sprite：只动用到 emoji 的组件文件，工程没有"图标系统"层抽象
- 推荐保留 emoji 作 fallback——加载失败时显示，避免空白

---

## 6. 上传内容（**孩子产生的资产，不是设计师资产**）

| 资产 | 路径 | 由谁产生 |
|------|------|----------|
| 孩子拍的照片 | `public/uploads/{companion_id}/{day}/{ts}.{ext}` | `src/lib/storage/upload.ts` `saveUploadedPhoto` |
| 孩子录的语音 | `public/uploads_voice/{companion_id}/{day}/{ts}.{ext}` | `src/lib/storage/upload.ts` `saveUploadedAudio` |

> 这些是运行时产物，不要预先放图。Docker 部署需把 `/public/uploads*` 挂载为 volume（见 `docker-compose.yml`）。

---

## 7. 字体 / Emoji / Web 字体

- 全站走系统字体栈（`src/styles/globals.css` 的 `--font-title` / `--font-body`），无外部字体文件
- 若 V1.0 后要接入特定中文字体（如思源宋体），把字体文件放 `public/fonts/`，在 `globals.css` 用 `@font-face` 声明 → 全站自动生效

---

## 8. 不要碰的"看似资产"清单

| 文件 | 说明 |
|------|------|
| `design/*.jsx` | Figma 导出的设计稿源文件，**仅供参考**，不是工程组件 |
| `design/styles.css` | 设计 token 参考，已合并进 `src/styles/globals.css` |
| `prompts/{pass1,pass2,...}/*.md` | LLM prompt 模板，文案改动需 **prompt 工程师评估**（跑 `npm run prompt:eval`），不是 UI 文案 |

---

## 9. 接入流程速记（设计师 / 运营自查）

```
要换图 → 看本文 §1 / §2 / §3
要改文案（有性格的角色台词）→ 改 prompts/shared/companions.json
要改文案（系统提示 / 静态 UI 文案）→ src/ 下对应组件
要换 LLM prompt → 改 prompts/{call_type}/*.md，跑 npm run prompt:eval 验证
```
