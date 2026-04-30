# Home

7 天 AI 启蒙 H5，面向 8–12 岁儿童。

详见 [spec/Home_MVP_PRD_V0.5.md](spec/Home_MVP_PRD_V0.5.md) 和 [spec/Home_MVP_Implementation_Plan_V0.1.md](spec/Home_MVP_Implementation_Plan_V0.1.md)。

## 起步

```bash
npm install
cp .env.example .env.local   # 填入 MySQL + DeepSeek + DashScope (Qwen-VL) 凭据
npm run db:migrate           # 初始化数据库 schema 并写入种子数据
npm run dev
```

## 目录速览

- `src/app/` — Next.js App Router 页面与 API
- `src/components/` — 房间、伙伴立绘、记忆面板卡片等
- `src/lib/llm/` — DeepSeek 5 个调用点 + 降级；`src/lib/vision/` — DashScope Qwen-VL 拍照分析
- `src/lib/db/` — MySQL 连接池与查询封装
- `prompts/` — Prompt 模板与 Few-shot 资产
- `db/migrations/`、`db/seed.sql` — MySQL schema 与种子数据
- `design/` — 视觉原型（仅参考，不进 build）
- `spec/` — PRD 与实施计划

## 关键命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 本地开发 |
| `npm run build` | 生产构建 |
| `npm run type-check` | TS 类型检查 |
| `npm run lint` | ESLint 检查 |
| `npm run format` | Prettier 格式化 `src/` 与 `prompts/` |
| `npm run db:migrate` | 应用 `db/migrations/` 并写入 `db/seed.sql` |
| `npm run db:reset` | 删除并重建 `home` 数据库后重新迁移 |
| `npm run prompt:eval` | 跑 Pass 1 调优样本（PRD §15.8.1）|
