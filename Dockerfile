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
COPY --from=builder /app/db/migrations ./db/migrations
EXPOSE 3000
CMD ["node", "server.js"]
