/**
 * 毕业卡页 /day7/graduation（PRD §8 + §9.8）
 *
 * 1080×1920 竖版分享卡：等距小屋 + 6 项档案 + 4 栏数据。
 * 在移动端按比例缩放展示，"保存到相册"导出原始 1080×1920 PNG。
 */

'use client';

import { forwardRef, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as htmlToImage from 'html-to-image';
import { MobileShell } from '@/components/ui/MobileShell';
import { Button } from '@/components/ui/Button';
import { Room } from '@/components/room/Room';
import { Companion } from '@/components/characters/Companion';
import { deriveRoomLayout } from '@/lib/room/derivedLayout';
import {
  getCompanionState,
  getWorldview,
  type CompanionStateResponse,
  type WorldviewData,
} from '@/lib/api/client';
import type { CompanionPresetId } from '@/components/characters/types';

export default function GraduationPage() {
  const router = useRouter();
  const cardRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<CompanionStateResponse | null>(null);
  const [worldview, setWorldview] = useState<WorldviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedUrl, setSavedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getCompanionState(), getWorldview()])
      .then(([s, w]) => {
        setState(s);
        setWorldview(w);
      })
      .catch((e) => setError((e as Error)?.message ?? '加载失败'))
      .finally(() => setLoading(false));
  }, []);

  const onSave = async () => {
    if (saving || !cardRef.current) return;
    setSaving(true);
    try {
      const dataUrl = await htmlToImage.toJpeg(cardRef.current, {
        quality: 0.92,
        pixelRatio: 1, // card 内部已经按 1080px 渲染
        cacheBust: true,
      });
      setSavedUrl(dataUrl);
    } catch (e) {
      setError((e as Error)?.message ?? '生成图片失败');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <MobileShell>
        <div className="min-h-dvh flex items-center justify-center">
          <p className="font-title text-h3 text-ink-3">让 {state?.companion?.display_name ?? '它'} 整理这一周…</p>
        </div>
      </MobileShell>
    );
  }
  if (error || !state?.companion || !worldview) {
    return (
      <MobileShell>
        <div className="min-h-dvh flex flex-col items-center justify-center px-8 text-center gap-4">
          <p className="font-title text-h2 text-ink-1">还差最后一步</p>
          <p className="font-title text-body text-ink-2 leading-relaxed max-w-[280px]">
            {error ?? '档案还没有生成，先去看一下"它眼中的世界"吧。'}
          </p>
          <Button onClick={() => router.replace('/day7/worldview')}>看档案</Button>
        </div>
      </MobileShell>
    );
  }

  const c = state.companion;
  const presetId = c.preset_id as CompanionPresetId;
  const stats = worldview.stats ?? { photos: 0, conversations: 0, corrections: 0 };
  const layout = deriveRoomLayout({
    remembered: state.remembered_concepts ?? [],
    photos: state.photos,
  });

  return (
    <MobileShell>
      <header className="px-5 pt-3 pb-2 flex items-center justify-between border-b border-[rgba(95,94,90,0.12)]">
        <button
          onClick={() => router.back()}
          aria-label="返回"
          className="bg-transparent border-0 p-1 cursor-pointer"
        >
          <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
            <path d="M14 4 L7 11 L14 18" stroke="#2C2C2A" strokeWidth="2" fill="none" strokeLinecap="round" />
          </svg>
        </button>
        <h1 className="font-title text-h3 text-ink-1">毕业卡</h1>
        <span className="w-7" />
      </header>

      <div className="px-4 py-4 overflow-y-auto" style={{ height: 'calc(100dvh - 44px - 50px - 100px)' }}>
        {/* 缩放预览 */}
        <div
          className="mx-auto"
          style={{
            width: 360,
            transformOrigin: 'top center',
          }}
        >
          <div style={{ transform: 'scale(0.333)', transformOrigin: 'top left', width: 1080, height: 1920 }}>
            <GraduationCard
              ref={cardRef}
              companionName={c.display_name}
              presetId={presetId}
              worldview={worldview}
              stats={stats}
              layout={layout}
            />
          </div>
          {/* 占位以撑开滚动高度（缩放后 = 1920 * 0.333 ≈ 640） */}
          <div style={{ height: 640 - 1920 + 1920 * 0.333 }} />
        </div>
      </div>

      {savedUrl ? (
        <SaveResultBar
          dataUrl={savedUrl}
          onClose={() => setSavedUrl(null)}
        />
      ) : (
        <div className="absolute left-0 right-0 bottom-0 h-[100px] bg-[#FFF8EA] border-t border-[rgba(95,94,90,0.15)] flex items-center px-5 gap-3">
          <Button variant="ghost" onClick={() => router.push('/home')}>
            回小家
          </Button>
          <Button fullWidth onClick={onSave} disabled={saving}>
            {saving ? '生成中…' : '保存到相册'}
          </Button>
        </div>
      )}
    </MobileShell>
  );
}

function SaveResultBar({ dataUrl, onClose }: { dataUrl: string; onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/85 px-5">
      <button
        onClick={onClose}
        aria-label="关闭"
        className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/15 text-white border-0 cursor-pointer flex items-center justify-center text-xl"
      >
        ✕
      </button>
      <div className="text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={dataUrl}
          alt="毕业卡"
          className="max-w-full max-h-[78dvh] mx-auto rounded-card border border-white/20 shadow-2xl"
        />
        <p className="font-title text-body text-white/80 mt-3 leading-relaxed">
          长按图片 → "保存到相册"
        </p>
        <p className="font-title text-mini text-white/60 mt-1">
          移动设备可直接保存
        </p>
        <a
          href={dataUrl}
          download={`home-graduation-${Date.now()}.jpg`}
          className="inline-block mt-4 px-5 py-2 bg-amber-light text-amber-deep rounded-full font-title text-small no-underline"
        >
          下载到电脑
        </a>
      </div>
    </div>
  );
}

// ──────────────────── 1080×1920 卡片本体 ────────────────────
interface GradCardProps {
  companionName: string;
  presetId: CompanionPresetId;
  worldview: WorldviewData;
  stats: { photos: number; conversations: number; corrections: number };
  layout: ReturnType<typeof deriveRoomLayout>;
}

const GraduationCard = forwardRef<HTMLDivElement, GradCardProps>(
  ({ companionName, presetId, worldview, stats, layout }, ref) => {
    return (
      <div
        ref={ref}
        style={{
          width: 1080,
          height: 1920,
          background: '#FAEEDA',
          position: 'relative',
          fontFamily: 'var(--f-body)',
          overflow: 'hidden',
        }}
      >
        {/* 纸纹 */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: 0.4,
            pointerEvents: 'none',
            backgroundImage:
              'radial-gradient(circle at 1px 1px, rgba(95,94,90,0.08) 1px, transparent 1px)',
            backgroundSize: '14px 14px',
          }}
        />

        {/* HEADER */}
        <div
          style={{
            position: 'absolute',
            top: 60,
            left: 60,
            right: 60,
            height: 60,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
            <span style={{ fontFamily: 'var(--f-title)', fontSize: 38, color: '#2C2C2A', fontWeight: 500, letterSpacing: '0.04em' }}>
              Home
            </span>
            <span style={{ fontFamily: 'var(--f-num)', fontSize: 16, color: '#888780', letterSpacing: '0.18em' }}>
              · 数字小家
            </span>
          </div>
          <div
            style={{
              background: '#FAC775',
              color: '#633806',
              fontFamily: 'var(--f-num)',
              fontSize: 18,
              fontWeight: 600,
              letterSpacing: '0.18em',
              padding: '10px 20px',
              borderRadius: 999,
            }}
          >
            DAY 7 · 毕业
          </div>
        </div>

        {/* 等距小屋 100–680 */}
        <div
          style={{
            position: 'absolute',
            top: 140,
            left: 60,
            right: 60,
            height: 600,
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <div style={{ width: 900, height: 600, position: 'relative' }}>
            <Room
              width={900}
              height={600}
              photos={layout.photos}
              familyFrames={layout.frames}
              items={layout.items}
              mood={layout.mood}
            >
              <g transform="translate(280, 360) scale(0.9)">
                <Companion presetId={presetId} pose="stand" size={160} />
              </g>
            </Room>
          </div>
        </div>

        {/* 标题 */}
        <div style={{ position: 'absolute', top: 760, left: 60, right: 60, textAlign: 'center' }}>
          <div
            style={{
              fontFamily: 'var(--f-num)',
              fontSize: 18,
              letterSpacing: '0.32em',
              color: '#888780',
              marginBottom: 12,
            }}
          >
            这是我的
          </div>
          <h1
            style={{
              margin: 0,
              fontFamily: 'var(--f-title)',
              fontSize: 76,
              fontWeight: 500,
              color: '#2C2C2A',
              letterSpacing: '0.04em',
            }}
          >
            {companionName}
          </h1>
          <div style={{ marginTop: 10, fontFamily: 'var(--f-title)', fontSize: 22, color: '#5F5E5A' }}>
            它在 Home 住了 7 天
          </div>
        </div>

        {/* 档案 6 项 */}
        <div style={{ position: 'absolute', top: 960, left: 100, right: 100 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
            <span style={{ fontFamily: 'var(--f-title)', fontSize: 26, color: '#2C2C2A' }}>它眼中的世界</span>
            <span style={{ flex: 1, height: 1, background: 'rgba(95,94,90,0.25)' }} />
            <span style={{ fontFamily: 'var(--f-num)', fontSize: 12, color: '#888780', letterSpacing: '0.16em' }}>
              WORLDVIEW · {worldview.almost_forgot_thing ? '6' : '5'} ITEMS
            </span>
          </div>

          <DRow label="最重要的人" value={worldview.most_important_person ?? '—'} />
          <DRow label="最好玩的事" value={worldview.most_fun_thing ?? '—'} />
          <DRow label="最好吃的" value={worldview.most_delicious_thing ?? '—'} />
          <DRow label="最害怕的" value={worldview.most_scary_thing ?? '—'} />
          <DRow label="不知道的" value={worldview.unknown_thing ?? '—'} accent="amber" />
          {worldview.almost_forgot_thing && (
            <DRow label="差点忘了的" value={worldview.almost_forgot_thing} accent="gold" />
          )}
        </div>

        {/* 数据统计 */}
        <div style={{ position: 'absolute', top: 1660, left: 100, right: 100 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              borderTop: '1px solid rgba(95,94,90,0.25)',
              borderBottom: '1px solid rgba(95,94,90,0.25)',
              padding: '18px 0',
            }}
          >
            <Stat n={stats.photos} label="张照片" />
            <Stat n={stats.conversations} label="句对话" />
            <Stat n={stats.corrections} label="次纠正" highlight={stats.corrections > 0} />
            <Stat n={7} label="天陪伴" />
          </div>
        </div>

        {/* footer */}
        <div
          style={{
            position: 'absolute',
            bottom: 60,
            left: 60,
            right: 60,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ fontFamily: 'var(--f-title)', fontSize: 18, color: '#5F5E5A' }}>
            home.app · 给你最喜欢的玩具一个数字小家
          </div>
        </div>
      </div>
    );
  },
);
GraduationCard.displayName = 'GraduationCard';

function DRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: 'amber' | 'gold';
}) {
  const isAmber = accent === 'amber';
  const isGold = accent === 'gold';
  const baseStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '180px 1fr',
    columnGap: 24,
    alignItems: 'baseline',
    padding: '20px 24px',
    borderRadius: 6,
    marginBottom: 8,
    position: 'relative',
  };
  const boxStyle: React.CSSProperties = isGold
    ? { ...baseStyle, background: 'rgba(239,159,39,0.18)', boxShadow: 'inset 0 0 0 1.5px #EF9F27' }
    : isAmber
      ? { ...baseStyle, background: 'rgba(186,117,23,0.06)' }
      : baseStyle;

  return (
    <div style={boxStyle}>
      {isGold && <span style={{ position: 'absolute', left: -2, top: 22, fontSize: 22 }}>⭐</span>}
      <div
        style={{
          fontFamily: 'var(--f-title)',
          fontSize: 22,
          color: isGold ? '#854F0B' : isAmber ? '#BA7517' : '#888780',
          fontWeight: 500,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: 'var(--f-title)',
          fontSize: 28,
          lineHeight: 1.5,
          color: isGold ? '#633806' : isAmber ? '#BA7517' : '#2C2C2A',
          fontWeight: isGold || isAmber ? 500 : 400,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function Stat({ n, label, highlight }: { n: number; label: string; highlight?: boolean }) {
  return (
    <div style={{ textAlign: 'center', borderRight: '1px solid rgba(95,94,90,0.18)' }}>
      <div
        style={{
          fontFamily: 'var(--f-num)',
          fontSize: 48,
          fontWeight: 600,
          color: highlight ? '#BA7517' : '#2C2C2A',
          lineHeight: 1,
        }}
      >
        {n}
      </div>
      <div style={{ fontFamily: 'var(--f-title)', fontSize: 16, color: '#5F5E5A', marginTop: 8 }}>
        {label}
      </div>
    </div>
  );
}
