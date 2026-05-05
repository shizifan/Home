/**
 * 30 秒引导（PRD §17.2 4 张卡片）
 * 横向滑入 0.4s；右上角持续可见跳过按钮；最后一张按钮文案变「带它回家 →」。
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MobileShell } from '@/components/ui/MobileShell';
import { Button } from '@/components/ui/Button';
import { Companion } from '@/components/characters/Companion';
import { Room } from '@/components/room/Room';
import { useCompanionStore } from '@/stores/companionStore';

const CARDS = [
  {
    title: '这里是 Home。一个等着你最喜欢的玩具搬进来的小家。',
    cta: '往下看 →',
  },
  {
    title: '它对这里完全陌生。但它认识你。',
    cta: '往下看 →',
  },
  {
    // PRD §17.2 卡片 3：用「说说」明确暗示语音输入
    title: '接下来 7 天，说说你们的故事。它会一点一点了解你的世界。',
    cta: '往下看 →',
  },
  {
    title: '你也可以钻进它的脑袋，看它记住了什么、忘了什么。它会需要你的帮忙。',
    cta: '带它回家 →',
  },
] as const;

export default function IntroPage() {
  const [idx, setIdx] = useState(0);
  const router = useRouter();
  const { markIntroCompleted } = useCompanionStore();

  const next = () => {
    if (idx < CARDS.length - 1) {
      setIdx(idx + 1);
    } else {
      markIntroCompleted();
      router.push('/onboarding/choose');
    }
  };

  const skip = () => {
    markIntroCompleted();
    router.push('/onboarding/choose');
  };

  const card = CARDS[idx];

  return (
    <MobileShell showStatusBar={false}>
      <div className="min-h-dvh flex flex-col px-6 pt-6 pb-10">
        {/* 顶部：跳过 + 进度点 */}
        <div className="flex items-center justify-between">
          <div className="flex gap-1.5">
            {CARDS.map((_, i) => (
              <span
                key={i}
                className={`h-1 rounded-full transition-all ${
                  i === idx ? 'w-6 bg-ink-1' : 'w-1.5 bg-[rgba(95,94,90,0.3)]'
                }`}
              />
            ))}
          </div>
          <button
            onClick={skip}
            className="font-title text-small text-ink-3 px-2 py-1 cursor-pointer bg-transparent border-0"
          >
            跳过引导
          </button>
        </div>

        {/* 卡片画面 — key={idx} 让每次切换重置动画 */}
        <div className="flex-1 flex flex-col items-center justify-center overflow-hidden">
          <div
            key={idx}
            className="flex flex-col items-center animate-slide-in-x will-change-transform"
          >
            <IntroVisual idx={idx} />
            <p className="font-title text-h2 text-ink-1 text-center mt-10 max-w-[300px] leading-[1.7]">
              {card.title}
            </p>
          </div>
        </div>

        <Button size="lg" fullWidth onClick={next}>
          {card.cta}
        </Button>
      </div>
    </MobileShell>
  );
}

function IntroVisual({ idx }: { idx: number }) {
  // 卡片 1 — 空小屋
  if (idx === 0) {
    return (
      <div className="opacity-90">
        <Room width={260} height={260} photos={[]} items={[]} />
      </div>
    );
  }
  // 卡片 2 — 伙伴飘进来
  if (idx === 1) {
    return (
      <div className="relative">
        <Room width={260} height={260} photos={[]} items={[]}>
          <g transform="translate(280,360) scale(0.8)">
            <Companion presetId="xiaoqinglong" pose="stand" size={140} />
          </g>
        </Room>
      </div>
    );
  }
  // 卡片 3 — 屋内出现照片与物品
  if (idx === 2) {
    return (
      <Room
        width={260}
        height={260}
        photos={[
          { x: 230, y: 250, rot: -6, label: '', tone: '#F4C0D1', wall: 'back' },
          { x: 360, y: 230, rot: 5, label: '', tone: '#85B7EB', wall: 'back' },
        ]}
        items={[{ x: 240, y: 470, kind: 'dumplings' }]}
      >
        <g transform="translate(280,360) scale(0.8)">
          <Companion presetId="xiaoqinglong" pose="stand" size={140} />
        </g>
      </Room>
    );
  }
  // 卡片 4 — 脑袋剖面图
  return <BrainCrossSection />;
}

/** 卡片 4 视觉：「钻进它的脑袋」剖面（从 design/artboard-memory.jsx 借的小图） */
function BrainCrossSection() {
  return (
    <svg width="240" height="200" viewBox="0 0 240 200" aria-hidden>
      <path
        d="M40 110 Q20 30 110 22 Q210 22 230 70 Q250 130 220 165 Q170 190 90 188 Q40 175 40 110 Z"
        fill="#D3D1C7"
        stroke="#5F5E5A"
        strokeWidth="2"
      />
      <path
        d="M86 22 Q80 -4 100 -4 Q116 4 110 26 Z"
        transform="translate(0,12)"
        fill="#6B6A66"
        stroke="#5F5E5A"
        strokeWidth="2"
      />
      <path
        d="M150 18 Q146 -8 168 -8 Q186 0 178 22 Z"
        transform="translate(0,12)"
        fill="#6B6A66"
        stroke="#5F5E5A"
        strokeWidth="2"
      />
      {/* 剖面（虚线）— 内部空间装着 4 类小圆点 */}
      <path
        d="M60 110 Q40 50 110 42 Q200 42 220 90 Q240 140 200 160 Q140 170 80 130 Q60 120 60 110 Z"
        fill="#FFF8EA"
        stroke="#5F5E5A"
        strokeDasharray="4 4"
        strokeWidth="1.5"
      />
      {/* 4 类记忆圆点 */}
      <circle cx="100" cy="80" r="9" fill="#F0997B" />
      <circle cx="150" cy="70" r="7" fill="#AFA9EC" />
      <circle cx="180" cy="105" r="7" fill="#B5D4F4" />
      <circle cx="120" cy="120" r="9" fill="#F0997B" />
      <circle cx="160" cy="135" r="6" fill="#D3D1C7" stroke="#888780" />
      {/* 眼 */}
      <ellipse cx="80" cy="78" rx="4" ry="5" fill="#2C2C2A" />
    </svg>
  );
}
