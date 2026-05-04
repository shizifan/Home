/**
 * Day 7 · 它眼中的世界（PRD §9.1–§9.7）
 *
 * 使用组件化架构：
 *   - ArchiveReveal：逐项展示动效
 *   - BarrierText：破壁文案（两个版本）
 *   - CompanionLineAfterArchive：档案后的 5 选 1 随机台词
 *
 * 从 API 获取 skipCount 用于三档模式：
 *   - normal（0-2 跳过）：正常生成 5 项
 *   - limited（3-5 跳过）：LLM 提示训练数据较少
 *   - sparse（6+ 跳过）：第 5 项替换为固定反思文案
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { MobileShell } from '@/components/ui/MobileShell';
import { Button } from '@/components/ui/Button';
import { ArchiveReveal, BarrierText, CompanionLineAfterArchive } from '@/components/day7';
import type { ArchiveStage } from '@/components/day7';
import {
  Day7FailureError,
  generateWorldview,
  getCompanionState,
  type WorldviewData,
} from '@/lib/api/client';

export default function WorldviewPage() {
  const router = useRouter();
  const [worldview, setWorldview] = useState<WorldviewData | null>(null);
  const [companionName, setCompanionName] = useState('伙伴');
  const [skipCount, setSkipCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<'preReveal' | 'revealing' | 'breakwall' | 'final'>(
    'preReveal',
  );
  const hasRestored = !!(worldview?.almost_forgot_thing && skipCount < 6);

  const handleStageChange = useCallback((s: ArchiveStage) => {
    if (s === 'allRevealed') {
      setStage('breakwall');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([generateWorldview(), getCompanionState()])
      .then(([res, state]) => {
        if (cancelled) return;
        setWorldview(res.worldview);
        setCompanionName(state.companion?.display_name ?? '伙伴');
        setSkipCount(res.skipCount ?? 0);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setLoading(false);
        setError(
          e instanceof Day7FailureError
            ? e.message
            : '我有点累了，等会儿再来吧。',
        );
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 显示 BarrierText 后 6s 自动进入 final（显示按钮）
  useEffect(() => {
    if (stage !== 'breakwall') return;
    const t = setTimeout(() => setStage('final'), 6500);
    return () => clearTimeout(t);
  }, [stage]);

  // —— Render ——

  if (loading) {
    return (
      <MobileShell>
        <div className="min-h-dvh flex flex-col items-center justify-center px-8">
          <p className="font-title text-h3 text-ink-2">
            让 {companionName} 把这一周的事…
          </p>
          <p className="font-title text-h3 text-ink-2 mt-1">在心里再想一遍。</p>
          <span className="block mt-6 w-12 h-12 rounded-full border-[3px] border-amber-light border-t-transparent animate-spin" />
        </div>
      </MobileShell>
    );
  }

  if (error) {
    return (
      <MobileShell>
        <div className="min-h-dvh flex flex-col items-center justify-center px-8 text-center">
          <p className="font-title text-h2 text-ink-1 mb-3">— {companionName}</p>
          <p className="font-title text-body text-ink-2 leading-relaxed mb-8 max-w-[280px]">
            「{error}」
          </p>
          <Link href="/home">
            <Button size="lg">回到小家</Button>
          </Link>
        </div>
      </MobileShell>
    );
  }

  if (!worldview) return null;

  return (
    <MobileShell>
      <div className="min-h-dvh flex flex-col px-5 pt-8 pb-8">
        {/* 顶部 — 伙伴开场白固定文案 */}
        <header className="mb-5">
          <p className="font-title text-mini text-ink-3 mb-1">— {companionName}</p>
          <p className="font-title text-body text-ink-1 leading-[1.7]">
            「我已经在小家住满 7 天了。这一周你告诉了我好多事，
            <br />
            我也整理了好多记忆——我想给你看看，我现在眼中的世界是什么样的。」
          </p>
        </header>

        {/* 档案卡 */}
        <ArchiveReveal
          worldview={worldview}
          companionName={companionName}
          skipCount={skipCount}
          onStageChange={handleStageChange}
        />

        {/* 破壁文案 */}
        {(stage === 'breakwall' || stage === 'final') && (
          <>
            <CompanionLineAfterArchive companionName={companionName} />
            <div className="mt-3">
              <BarrierText hasSixth={hasRestored} />
            </div>
          </>
        )}

        {/* 操作 */}
        {stage === 'final' && (
          <div className="mt-6">
            <Button size="lg" fullWidth onClick={() => router.push('/day7/graduation')}>
              生成毕业卡 →
            </Button>
          </div>
        )}
      </div>
    </MobileShell>
  );
}
