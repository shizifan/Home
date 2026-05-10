#!/usr/bin/env bash
# Home V1.0 — MySQL 数据备份（PRD §27.6）
#
# 用法（在宿主机 crontab 里加一条）：
#   0 3 * * * /opt/home/scripts/backup.sh >> /var/log/home-backup.log 2>&1
#
# 行为：
#   1. 在容器里执行 mysqldump 导出整个 home 数据库
#   2. 用 gzip 压缩
#   3. 写到 BACKUP_DIR（默认 /var/backups/home）+ 上传到 OSS（可选）
#   4. 自动删除 30 天前的本地备份

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/home}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-30}"
DATE_TAG="$(date +%Y%m%d_%H%M%S)"
FILE="$BACKUP_DIR/home_${DATE_TAG}.sql.gz"

mkdir -p "$BACKUP_DIR"

# 找到 docker-compose 的 mysql 容器名（默认 home-mysql-1，可被 PROJECT_NAME 覆盖）
COMPOSE_PROJECT="${COMPOSE_PROJECT_NAME:-home}"
MYSQL_CONTAINER="${MYSQL_CONTAINER:-${COMPOSE_PROJECT}-mysql-1}"

echo "[backup] dumping from container: $MYSQL_CONTAINER → $FILE"

docker exec -i "$MYSQL_CONTAINER" \
  sh -c 'exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction --quick --lock-tables=false "$MYSQL_DATABASE"' \
  | gzip -9 > "$FILE"

SIZE=$(du -h "$FILE" | awk '{print $1}')
echo "[backup] done: $FILE ($SIZE)"

# 可选：上传到阿里云 OSS（需要 ossutil 工具）
if [ -n "${OSS_BUCKET:-}" ] && command -v ossutil >/dev/null 2>&1; then
  REMOTE="oss://${OSS_BUCKET}/home-backup/${DATE_TAG}.sql.gz"
  echo "[backup] uploading to $REMOTE"
  ossutil cp "$FILE" "$REMOTE" --jobs 1 || echo "[backup] OSS upload failed (kept local copy)"
fi

# 清理旧备份
find "$BACKUP_DIR" -name 'home_*.sql.gz' -mtime "+$KEEP_DAYS" -delete
echo "[backup] cleaned files older than $KEEP_DAYS days"
