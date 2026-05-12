#!/usr/bin/env bash
# Home V1.0 — 每日监控汇总（PRD §25.7 最小集）
#
# 行为：扫 llm_call_log 表统计昨日数据，生成纯文本汇总，写到 /var/log/game-monitor.log。
# 用 cron 每天 9:00 跑一次；接邮件 / 飞书 / 企业微信由用户额外接入（脚本只产出文本）。
#
# 用法：
#   0 9 * * * /opt/game/scripts/daily-monitor.sh

set -euo pipefail

COMPOSE_PROJECT="${COMPOSE_PROJECT_NAME:-home}"
MYSQL_CONTAINER="${MYSQL_CONTAINER:-${COMPOSE_PROJECT}-mysql-1}"

YESTERDAY="$(date -d 'yesterday' +%Y-%m-%d 2>/dev/null || date -v-1d +%Y-%m-%d)"

run_sql() {
  docker exec -i "$MYSQL_CONTAINER" \
    sh -c 'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -N -B "$MYSQL_DATABASE"' \
    -e "$1" 2>/dev/null
}

cat <<EOF
=== Home 日报 · $YESTERDAY ===

[ 用户活跃 ]
$(run_sql "
  select
    (select count(*) from users where date(created_at) = '$YESTERDAY') as 'users_new',
    (select count(*) from users where date(last_active_at) = '$YESTERDAY') as 'users_active'
")

[ LLM 调用统计 ]
$(run_sql "
  select call_type,
         count(*) as 'calls',
         sum(case when success=1 then 1 else 0 end) as 'success',
         round(avg(latency_ms),0) as 'avg_ms',
         max(latency_ms) as 'max_ms'
  from llm_call_log
  where date(created_at) = '$YESTERDAY'
  group by call_type
")

[ Day 7 失败次数（关键告警） ]
$(run_sql "
  select count(*) as 'day7_failed'
  from llm_call_log
  where date(created_at) = '$YESTERDAY'
    and call_type='day7'
    and success=0
")

[ 卡片生成质量 ]
$(run_sql "
  select count(*) as 'cards_total',
         sum(case when is_fallback_text_card=1 then 1 else 0 end) as 'fallback_text',
         sum(case when child_action='confirmed' then 1 else 0 end) as 'confirmed',
         sum(case when child_action='rejected' then 1 else 0 end) as 'rejected'
  from cards
  where date(created_at) = '$YESTERDAY'
")

[ 出门活动 ]
$(run_sql "
  select trip_type,
         count(*) as 'trips',
         sum(case when status='returned' then 1 else 0 end) as 'returned'
  from trips
  where date(created_at) = '$YESTERDAY'
  group by trip_type
")

[ 客户端 telemetry · 端到端时长（PRD §28.4：describe_e2e ≤ 15s）]
$(run_sql "
  select model as 'event',
         count(*) as 'samples',
         round(avg(latency_ms)/1000, 1) as 'avg_s',
         round(max(latency_ms)/1000, 1) as 'max_s'
  from llm_call_log
  where date(created_at) = '$YESTERDAY'
    and call_type='client_telemetry'
  group by model
")
EOF
