# Home V1.0 — 多阶段构建 Dockerfile
# 阶段 1：deps 安装；阶段 2：build 出 .next/standalone；阶段 3：runtime 运行
#
# 用法：
#   docker build -t home-app:1.0 .
#   docker run --env-file .env.production -p 3000:3000 home-app:1.0
# 推荐配合 docker-compose.yml 一起用（包含 MySQL + Redis）。

# ─── 1. deps ───
FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

# ─── 2. build ───
FROM node:20-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Next.js standalone 模式要求 next.config.mjs 设置 output:'standalone'
RUN npm run build

# ─── 3. runtime ───
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
# 强制要求 cookie 解析用户（拒绝 SINGLE_USER_ID 兜底）— 生产即此模式
ENV RESOLVE_USER_REQUIRE_COOKIE=1

# 非 root 用户运行
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Next.js standalone 输出
COPY --from=builder /app/public ./public
# uploads 目录（用户语音 + 卡片）由 volume 挂载到 /app/public/uploads_voice 等
RUN mkdir -p ./public/uploads ./public/uploads_voice && \
    chown -R nextjs:nodejs ./public

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# 数据资产（道具池 / 剧本骨架 / 系统题库 / 预设伙伴 memory_bank）
COPY --from=builder --chown=nextjs:nodejs /app/data ./data
# Prompt 模板
COPY --from=builder --chown=nextjs:nodejs /app/prompts ./prompts
# DB 迁移脚本（容器内 db:migrate 用得上）
COPY --from=builder --chown=nextjs:nodejs /app/db ./db

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
