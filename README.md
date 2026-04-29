# Home

7 天 AI 启蒙 H5，面向 8–12 岁儿童。

详见 [spec/Home_MVP_PRD_V0.5.md](spec/Home_MVP_PRD_V0.5.md) 和 [spec/Home_MVP_Implementation_Plan_V0.1.md](spec/Home_MVP_Implementation_Plan_V0.1.md)。

## 起步

```bash
npm install
cp .env.example .env.local   # 填入 Supabase + DeepSeek + MiniMax 凭据
npm run dev
```

## 目录速览

- `src/app/` — Next.js App Router 页面与 API
- `src/components/` — 房间、伙伴立绘、记忆面板卡片等
- `src/lib/llm/` — DeepSeek 5 个调用点 + 降级；`src/lib/vision/` — MiniMax 拍照分析
- `prompts/` — Prompt 模板与 Few-shot 资产
- `supabase/migrations/` — 数据库 schema
- `design/` — 视觉原型（仅参考，不进 build）
- `spec/` — PRD 与实施计划

## 关键命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 本地开发 |
| `npm run build` | 生产构建 |
| `npm run type-check` | TS 类型检查 |
| `npm run db:types` | 从 Supabase 重新生成类型 |
| `npm run prompt:eval` | 跑 Pass 1 调优样本（PRD §15.8.1）|
