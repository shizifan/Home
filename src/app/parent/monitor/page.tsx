/**
 * LLM 绩效面板（家长视角）
 * 数据源：/api/parent/monitor → llm_call_log 表聚合
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { MobileShell } from '@/components/ui/MobileShell';
import { getMonitor, type MonitorResponse } from '@/lib/api/client';

const CALL_TYPE_LABEL: Record<string, string> = {
  pass1: 'Pass 1（归类）',
  pass2: 'Pass 2（对话）',
  concept_detail: '概念详情',
  correction: '纠正反馈',
  day7: 'Day 7 档案',
  vision: 'Vision（识图）',
};

export default function MonitorPage() {
  const [data, setData] = useState<MonitorResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMonitor()
      .then(setData)
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  return (
    <MobileShell>
      <header className="px-5 pt-3 pb-2 flex items-center justify-between border-b border-[rgba(95,94,90,0.12)]">
        <Link href="/parent" className="font-title text-small text-ink-3 no-underline">
          ← 家长中心
        </Link>
        <h1 className="font-title text-h3 text-ink-1">LLM 绩效</h1>
        <span className="w-12" />
      </header>

      <div className="overflow-y-auto" style={{ height: 'calc(100dvh - 44px - 50px)' }}>
        {loading && <p className="text-center font-title text-body text-ink-3 py-12">加载中…</p>}

        {!loading && data && (
          <>
            {/* 总成本 */}
            <section className="px-5 pt-5">
              <div className="bg-amber-light/40 border border-amber-light rounded-card px-4 py-3 flex items-baseline gap-3">
                <span className="font-num text-h2 font-semibold text-amber-deep">
                  ¥{data.total_cost_cny.toFixed(4)}
                </span>
                <span className="font-title text-small text-amber-mid">
                  累计 LLM 成本（截至现在）
                </span>
              </div>
            </section>

            {/* 按 call_type 聚合 */}
            <section className="px-5 pt-5">
              <h2 className="font-title text-h3 text-ink-1 mb-2">各调用点</h2>
              <div className="flex flex-col gap-2">
                {data.aggregates.map((a) => (
                  <AggCard key={a.call_type} agg={a} />
                ))}
              </div>
            </section>

            {/* 按模型 */}
            <section className="px-5 pt-5">
              <h2 className="font-title text-h3 text-ink-1 mb-2">各模型用量</h2>
              <div className="bg-white border border-[rgba(95,94,90,0.12)] rounded-card overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-[#FFF8EA]">
                    <tr>
                      <th className="font-title text-mini text-ink-3 px-3 py-2">模型</th>
                      <th className="font-title text-mini text-ink-3 px-3 py-2 text-right">调用</th>
                      <th className="font-title text-mini text-ink-3 px-3 py-2 text-right">in tok</th>
                      <th className="font-title text-mini text-ink-3 px-3 py-2 text-right">out tok</th>
                      <th className="font-title text-mini text-ink-3 px-3 py-2 text-right">¥</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.cost_by_model.map((m) => (
                      <tr key={m.model} className="border-t border-[rgba(95,94,90,0.08)]">
                        <td className="font-num text-small text-ink-1 px-3 py-2 truncate max-w-[100px]">
                          {m.model}
                        </td>
                        <td className="font-num text-small text-ink-2 px-3 py-2 text-right">{m.calls}</td>
                        <td className="font-num text-small text-ink-2 px-3 py-2 text-right">
                          {fmtNum(m.sum_in)}
                        </td>
                        <td className="font-num text-small text-ink-2 px-3 py-2 text-right">
                          {fmtNum(m.sum_out)}
                        </td>
                        <td className="font-num text-small text-amber-deep px-3 py-2 text-right">
                          {m.cost_cny.toFixed(4)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* 最近调用 */}
            <section className="px-5 py-5">
              <h2 className="font-title text-h3 text-ink-1 mb-2">最近 30 次调用</h2>
              <div className="flex flex-col gap-1">
                {data.recent.map((r) => (
                  <RecentRow key={r.id} row={r} />
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </MobileShell>
  );
}

function AggCard({ agg }: { agg: MonitorResponse['aggregates'][number] }) {
  const okPct = agg.success_rate * 100;
  const isAtRisk = okPct < 80;
  return (
    <div
      className={clsx(
        'bg-white border rounded-card px-4 py-3',
        isAtRisk
          ? 'border-[rgba(226,75,74,0.4)] bg-[rgba(226,75,74,0.04)]'
          : 'border-[rgba(95,94,90,0.12)]',
      )}
    >
      <div className="flex items-baseline justify-between mb-1">
        <span className="font-title text-h3 text-ink-1">
          {CALL_TYPE_LABEL[agg.call_type] ?? agg.call_type}
        </span>
        <span
          className={clsx(
            'font-num text-small',
            isAtRisk ? 'text-[#E24B4A]' : 'text-ink-2',
          )}
        >
          {okPct.toFixed(0)}% 成功
        </span>
      </div>
      <div className="flex flex-wrap gap-3 text-mini font-num text-ink-3">
        <span>
          总 <span className="text-ink-1">{agg.total}</span> 次
        </span>
        <span>
          均 <span className="text-ink-1">{agg.avg_ms ?? '-'}ms</span>
        </span>
        <span>
          max <span className="text-ink-1">{agg.max_ms ?? '-'}ms</span>
        </span>
        {agg.avg_in_tok != null && (
          <span>
            in tok ~ <span className="text-ink-1">{Math.round(agg.avg_in_tok)}</span>
          </span>
        )}
        {agg.avg_out_tok != null && (
          <span>
            out tok ~ <span className="text-ink-1">{Math.round(agg.avg_out_tok)}</span>
          </span>
        )}
      </div>
    </div>
  );
}

function RecentRow({ row }: { row: MonitorResponse['recent'][number] }) {
  return (
    <div
      className={clsx(
        'flex items-center gap-2 px-3 py-1.5 rounded text-mini',
        row.success ? 'bg-white' : 'bg-[rgba(226,75,74,0.06)]',
      )}
    >
      <span
        className={clsx('font-num font-semibold', row.success ? 'text-[#1D9E75]' : 'text-[#E24B4A]')}
      >
        {row.success ? '✓' : '✗'}
      </span>
      <span className="font-title text-ink-2 w-20 truncate">
        {CALL_TYPE_LABEL[row.call_type] ?? row.call_type}
      </span>
      <span className="font-num text-ink-3 w-16 text-right">
        {row.latency_ms ?? '-'}ms
      </span>
      <span className="font-num text-ink-3 flex-1 truncate">
        {row.fail_reason ?? row.model ?? ''}
      </span>
      <span className="font-num text-ink-3">{fmtTime(row.created_at)}</span>
    </div>
  );
}

function fmtTime(at: string): string {
  const d = new Date(at);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function fmtNum(n: number): string {
  if (n === 0) return '-';
  if (n < 1000) return String(n);
  return `${(n / 1000).toFixed(1)}k`;
}
