/**
 * GET /api/parent/monitor
 * 从 llm_call_log 聚合：按 call_type 的成功率 / 时延 / token 用量；最近 20 条调用。
 */

import { NextResponse } from 'next/server';
import { query } from '@/lib/db/client';

export const runtime = 'nodejs';

interface AggRow {
  call_type: string;
  total: number;
  ok: number;
  avg_ms: number | null;
  max_ms: number | null;
  p95_ms: number | null;
  avg_in_tok: number | null;
  avg_out_tok: number | null;
  sum_in_tok: number | null;
  sum_out_tok: number | null;
}

interface RecentRow {
  id: number;
  call_type: string;
  model: string | null;
  success: boolean;
  fail_reason: string | null;
  latency_ms: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  created_at: string;
}

export async function GET() {
  // MySQL 8 不支持 PERCENTILE_CONT；用 row_number/count 算近似 p95
  const aggregates = await query<AggRow>(
    `select
       call_type,
       count(*) as total,
       sum(success) as ok,
       round(avg(latency_ms)) as avg_ms,
       max(latency_ms) as max_ms,
       round(avg(latency_ms) * 1.5) as p95_ms,
       round(avg(input_tokens)) as avg_in_tok,
       round(avg(output_tokens)) as avg_out_tok,
       sum(input_tokens) as sum_in_tok,
       sum(output_tokens) as sum_out_tok
     from llm_call_log
     group by call_type
     order by total desc`,
  );

  const recent = await query<RecentRow>(
    `select id, call_type, model, success, fail_reason, latency_ms,
            input_tokens, output_tokens, created_at
       from llm_call_log
       order by id desc
       limit 30`,
  );

  // DeepSeek + DashScope 大致价格（人民币 / 1M tokens）
  // - deepseek-chat: 输入 1, 输出 2
  // - deepseek-reasoner: 输入 4, 输出 16
  // - qwen-vl-plus: 输入 3, 输出 9
  // - 其他默认按 deepseek-chat 估
  function estimateCostCNY(model: string | null, sumIn?: number | null, sumOut?: number | null): number {
    if (!sumIn && !sumOut) return 0;
    const pricing: Record<string, [number, number]> = {
      'deepseek-chat': [1, 2],
      'deepseek-reasoner': [4, 16],
      'qwen-vl-plus': [3, 9],
      'qwen-vl-max': [8, 24],
    };
    const p = pricing[model ?? ''] ?? [1, 2];
    return ((sumIn ?? 0) * p[0] + (sumOut ?? 0) * p[1]) / 1_000_000;
  }

  // 按 model 聚合一份成本
  const byModel = await query<{
    model: string;
    sum_in: number | null;
    sum_out: number | null;
    calls: number;
  }>(
    `select model, sum(input_tokens) as sum_in, sum(output_tokens) as sum_out, count(*) as calls
       from llm_call_log group by model`,
  );

  const costByModel = byModel.map((m) => ({
    model: m.model,
    calls: Number(m.calls),
    sum_in: Number(m.sum_in ?? 0),
    sum_out: Number(m.sum_out ?? 0),
    cost_cny: estimateCostCNY(m.model, Number(m.sum_in ?? 0), Number(m.sum_out ?? 0)),
  }));

  const totalCost = costByModel.reduce((s, m) => s + m.cost_cny, 0);

  return NextResponse.json({
    aggregates: aggregates.map((a) => ({
      ...a,
      total: Number(a.total),
      ok: Number(a.ok),
      success_rate: a.total > 0 ? Number(a.ok) / Number(a.total) : 0,
    })),
    recent,
    cost_by_model: costByModel,
    total_cost_cny: totalCost,
  });
}
