# Home V1.0 部署指南（阿里云 · Docker 方式）

> 适用于 V1.0 体验阶段（< 100 用户）。正式上线请按 P7 / V0.7 升级方案重新审视安全与扩缩容。

---

## 0. 前置条件 · 一定要先做的事

### 0.1 ICP 备案（硬阻塞）

如果用国内域名 + 阿里云国内服务器，**必须 ICP 备案**。

- 阿里云控制台 → 备案系统提交：5–15 工作日
- 备案期间可以用 IP 访问做内测，但浏览器会有警告
- **建议在写代码的同时就提交备案，节省项目周期**

### 0.2 阿里云资源开通

最小配置（PRD §21.7）：

| 资源 | 规格 | 月费（参考） |
|---|---|---|
| ECS | 2 核 4G（如 ecs.t6-c1m2.large）| ¥150 |
| RDS MySQL | 1 核 1G（也可用 ECS 自建 MySQL）| ¥80 |
| Redis | 256MB（也可不开，用 in-memory）| ¥30 |
| OSS | 标准存储 + 流量按量 | ¥20 |
| **合计** | | **约 ¥300/月** |

简化方案：**只开 1 台 ECS（4 核 8G 更稳）**，里面跑 Docker compose（应用 + MySQL + Redis），OSS 仅用作备份桶。一台机器 + Docker 是 V1.0 阶段最简的部署模式。

### 0.3 域名 + HTTPS

- 阿里云 SSL 证书 → 免费证书一年期
- nginx 做反向代理（80/443 → app:3000）

---

## 1. 部署步骤（Docker 一台机方案）

### 1.1 安装 Docker

```bash
# Ubuntu 22.04
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# 退出重连让权限生效
```

### 1.2 拉代码 + 配置环境变量

```bash
mkdir -p /opt/game && cd /opt/game
git clone https://github.com/shizifan/Home.git .
cp .env.example .env.production
# 编辑：填好 MYSQL_PASSWORD / DEEPSEEK_API_KEY / DASHSCOPE_API_KEY / ADMIN_KEY 等
vi .env.production
```

`.env.production` **必填**字段：

```
NODE_ENV=production
RESOLVE_USER_REQUIRE_COOKIE=1

MYSQL_PASSWORD=<生成一个强密码>
MYSQL_DATABASE=home

DEEPSEEK_API_KEY=<...>
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
DEEPSEEK_MODEL=deepseek-chat
DEEPSEEK_MODEL_DAY7=deepseek-chat

DASHSCOPE_API_KEY=<...>

ADMIN_KEY=<随机长字符串，至少 32 字符>

# ⚠️ HTTP 部署（还没上 HTTPS）必须设 0，否则浏览器丢弃 Set-Cookie 导致全局 401
# 上了 HTTPS 后改回 1
COOKIE_SECURE=0

# 可选：
RATE_IP_CREATE_USER_LIMIT=5
RATE_GLOBAL_DAILY_USER_LIMIT=50
RATE_USER_DAILY_LLM_LIMIT=30

# 可选：阿里云 OSS 备份桶
OSS_BUCKET=home-backup
```

### 1.3 起服务

```bash
cd /opt/game
# Docker compose 默认会读取当前目录的 .env，但我们用 .env.production 显式指定
docker compose --env-file .env.production up -d --build

# 看日志
docker compose logs -f app
```

### 1.4 第一次跑 DB 迁移

```bash
# 等 mysql healthcheck 转 healthy 后
for f in db/migrations/*.sql; do
  docker compose exec -T mysql sh -c \
    "mysql -uroot -p\$MYSQL_ROOT_PASSWORD \$MYSQL_DATABASE" < "$f"
done

# 加载 seed（8 个伙伴 preset）
docker compose exec -T mysql sh -c \
  "mysql -uroot -p\$MYSQL_ROOT_PASSWORD \$MYSQL_DATABASE" < db/seed.sql
```

### 1.5 nginx 反向代理（HTTPS）

`/etc/nginx/sites-available/home`：

```nginx
server {
  listen 80;
  server_name home.example.com;
  return 301 https://$server_name$request_uri;
}

server {
  listen 443 ssl http2;
  server_name home.example.com;

  ssl_certificate     /etc/ssl/home.example.com/fullchain.pem;
  ssl_certificate_key /etc/ssl/home.example.com/privkey.pem;

  client_max_body_size 5m;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/home /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

---

## 2. 备份 + 监控

### 2.1 数据备份（每天凌晨）

```bash
# 给宿主机加 crontab
crontab -e
# 添加：
0 3 * * * /opt/game/scripts/backup.sh >> /var/log/game-backup.log 2>&1
```

需要上传到 OSS 时，先在 ECS 上装 [ossutil](https://help.aliyun.com/zh/oss/developer-reference/install-ossutil) 并 `ossutil config` 配好 AK/SK，再在 `.env.production` 设 `OSS_BUCKET=home-backup`。

### 2.2 每日日报

```bash
# 写到日志文件
0 9 * * * /opt/game/scripts/daily-monitor.sh >> /var/log/game-monitor.log 2>&1

# 想接企业微信 / 飞书机器人，把 daily-monitor.sh 输出 pipe 给 curl 就行
```

---

## 3. 上线后验证

```bash
# 健康检查
curl https://home.example.com/api/auth/me
# 应该返回 { "user": null }

# 创建测试用户
curl -c /tmp/cookies.txt -X POST https://home.example.com/api/auth/start \
  -H 'content-type: application/json' \
  -d '{"nickname":"测试","fingerprint":"abcd1234"}'

# 用 cookie 访问 me
curl -b /tmp/cookies.txt https://home.example.com/api/auth/me
# 应该返回 { "user": {...} }

# 管理员看板
curl "https://home.example.com/api/admin/users?key=$ADMIN_KEY" | jq
```

---

## 4. 升级 / 重启

```bash
cd /opt/game
git pull
docker compose --env-file .env.production up -d --build app
# 老应用容器会被无缝替换；MySQL / Redis 不动数据
```

数据库迁移有新文件时手动跑：

```bash
# 假设新增了 0008_xxx.sql
docker compose exec -T mysql sh -c \
  "mysql -uroot -p\$MYSQL_ROOT_PASSWORD \$MYSQL_DATABASE" < db/migrations/0008_xxx.sql
```

---

## 5. 限流参数调优

PRD §27.4 默认值已嵌进 docker-compose.yml；运营初期紧一点，活跃后再放宽：

| 变量 | 默认 | 含义 |
|---|---|---|
| `RATE_IP_CREATE_USER_LIMIT` | 5 | 1 小时内同一 IP 最多创建 N 个新用户 |
| `RATE_GLOBAL_DAILY_USER_LIMIT` | 50 | 每日全局新用户上限（防恶意刷）|
| `RATE_USER_DAILY_LLM_LIMIT` | 30 | 单用户每天 LLM 调用上限 |

修改后 `docker compose up -d` 重启 app 即生效。

---

## 6. 常见问题

### Q: docker compose up 后 app 容器一直 restart

看 `docker compose logs app`：
- "Cannot find module ws" → 检查 .dockerignore 没把 node_modules 排掉？应该是排掉的，重新 build
- "ER_BAD_FIELD_ERROR" → DB 迁移没跑全，按 §1.4 重跑

### Q: 数据库连不上

- 检查 `.env.production` 的 `MYSQL_PASSWORD` 与 `docker-compose.yml` 是否一致
- 容器名：`docker compose ps` 看 mysql 服务名（默认 `home-mysql-1`）

### Q: 想看老用户的 cookie

家长中心 `/parent` 已经做了用户级数据查看；管理员能看所有用户在 `/admin?key=...`。

---

## 7. V1.1 升级路径（白名单审核制）

V1.0 → V0.7 升级时（PRD §27.5）：

1. `users` 表加 `phone / invitation_code / approved_at` 字段
2. 现有 V1.0 用户自动标 `status='approved'`
3. 老用户下次登录提示"补充手机号"
4. 之后新用户走"手机号 + 邀请码"路径

不会丢失 V1.0 的任何数据。
