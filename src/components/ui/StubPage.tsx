/**
 * 通用占位页：用于 P1 阶段还未实装的路由。
 * 显示路由名 + 计划在哪个 Phase 实装 + 返回主页按钮。
 */

'use client';

import Link from 'next/link';
import { MobileShell } from './MobileShell';
import { Button } from './Button';

interface Props {
  title: string;
  subtitle: string;
  /** 计划实装的 Phase，例如 'P2 (Day 1 切片)' */
  plannedPhase: string;
  prdRef?: string;
  backHref?: string;
}

export function StubPage({ title, subtitle, plannedPhase, prdRef, backHref = '/home' }: Props) {
  return (
    <MobileShell>
      <div className="min-h-dvh flex flex-col px-7 pt-10 pb-10">
        <div className="flex-1 flex flex-col justify-center">
          <span className="inline-block bg-amber-light text-amber-deep font-num text-mini tracking-[0.16em] rounded-full px-3 py-1 self-start">
            P1 STUB
          </span>
          <h1 className="font-title text-h1 text-ink-1 mt-3">{title}</h1>
          <p className="font-title text-h3 text-ink-2 mt-2 leading-relaxed">{subtitle}</p>
          <p className="font-title text-small text-ink-3 mt-6">
            实装计划：<span className="text-ink-1">{plannedPhase}</span>
          </p>
          {prdRef && (
            <p className="font-title text-small text-ink-3 mt-1">
              PRD 参考：<span className="text-ink-2">{prdRef}</span>
            </p>
          )}
        </div>
        <Link href={backHref}>
          <Button size="lg" fullWidth>
            回到小家
          </Button>
        </Link>
      </div>
    </MobileShell>
  );
}
