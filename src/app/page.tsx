/**
 * 启动页 / （PRD §11.2.1）
 */

'use client';

import Link from 'next/link';
import { MobileShell } from '@/components/ui/MobileShell';
import { Button } from '@/components/ui/Button';
import { Companion } from '@/components/characters/Companion';
import { useCompanionStore } from '@/stores/companionStore';

export default function LaunchPage() {
  const { companionId, introCompleted } = useCompanionStore();

  const ctaHref = companionId
    ? '/home'
    : introCompleted
      ? '/onboarding/choose'
      : '/intro';
  const ctaLabel = companionId ? '回到小家' : '开始';

  return (
    <MobileShell showStatusBar={false}>
      <div className="min-h-dvh flex flex-col items-center justify-between px-8 pt-20 pb-12">
        <div />

        <div className="flex flex-col items-center">
          <h1 className="font-title text-[64px] leading-none text-ink-1 tracking-wider">
            Home
          </h1>
          <p className="font-title text-h3 text-ink-2 mt-3 text-center">给你最喜欢的玩具一个数字小家</p>

          <div className="mt-12">
            <Companion presetId="xiaoqinglong" pose="stand" size={180} />
          </div>
        </div>

        <div className="w-full flex flex-col items-center gap-4">
          <Link href={ctaHref}>
            <Button size="lg">{ctaLabel}</Button>
          </Link>
          <p className="font-title text-mini text-ink-3 text-center max-w-[260px] leading-relaxed">
            一个 8–12 岁孩子的 7 天体验
          </p>
        </div>
      </div>
    </MobileShell>
  );
}
