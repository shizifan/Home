/**
 * 毕业卡页 /day7/graduation（PRD §10.1–§10.4）
 *
 * 1080×1920 竖版分享卡：等距小屋 + 6 项档案 + 4 栏数据。
 * 在移动端按比例缩放展示，"保存到相册"导出原始 1080×1920 JPG。
 * 支持 Web Share API 分享（带有 feature detection 降级）。
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as htmlToImage from 'html-to-image';
import { MobileShell } from '@/components/ui/MobileShell';
import { Button } from '@/components/ui/Button';
import { GraduationCard } from '@/components/day7';
import type { GradCardStats, GradCardLayout } from '@/components/day7';
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
        pixelRatio: 1,
        cacheBust: true,
      });
      setSavedUrl(dataUrl);
    } catch (e) {
      setError((e as Error)?.message ?? '生成图片失败');
    } finally {
      setSaving(false);
    }
  };

  const onShare = async () => {
    if (!savedUrl) return;
    try {
      const blob = await (await fetch(savedUrl)).blob();
      const file = new File([blob], 'home-graduation.jpg', { type: 'image/jpeg' });
      if (navigator.share) {
        await navigator.share({
          files: [file],
          title: '我的 Home 毕业卡',
        });
      }
    } catch {
      // 用户取消分享或设备不支持，静默处理
    }
  };

  if (loading) {
    return (
      <MobileShell>
        <div className="min-h-dvh flex items-center justify-center">
          <p className="font-title text-h3 text-ink-3">
            让 {state?.companion?.display_name ?? '它'} 整理这一周…
          </p>
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
  const stats: GradCardStats = {
    photos: worldview.stats?.cards_count ?? 0,
    conversations: worldview.stats?.conversations_count ?? 0,
    corrections: worldview.stats?.corrections_count ?? 0,
  };
  const layout: GradCardLayout = deriveRoomLayout({
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
            <path
              d="M14 4 L7 11 L14 18"
              stroke="#2C2C2A"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
            />
          </svg>
        </button>
        <h1 className="font-title text-h3 text-ink-1">毕业卡</h1>
        <span className="w-7" />
      </header>

      <div
        className="px-4 py-4 overflow-y-auto"
        style={{ height: 'calc(100dvh - 44px - 50px - 100px)' }}
      >
        {/* 缩放预览 */}
        <div
          className="mx-auto"
          style={{
            width: 360,
            transformOrigin: 'top center',
          }}
        >
          <div
            style={{
              transform: 'scale(0.333)',
              transformOrigin: 'top left',
              width: 1080,
              height: 1920,
            }}
          >
            <GraduationCard
              ref={cardRef}
              companionName={c.display_name}
              presetId={presetId}
              worldview={worldview}
              stats={stats}
              layout={layout}
            />
          </div>
          <div style={{ height: 640 - 1920 + 1920 * 0.333 }} />
        </div>
      </div>

      {savedUrl ? (
        <SaveResultBar dataUrl={savedUrl} onClose={() => setSavedUrl(null)} onShare={onShare} />
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

function SaveResultBar({
  dataUrl,
  onClose,
  onShare,
}: {
  dataUrl: string;
  onClose: () => void;
  onShare: () => void;
}) {
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
          长按图片 → &ldquo;保存到相册&rdquo;
        </p>

        {/* Web Share API 按钮 */}
        {typeof navigator !== 'undefined' && navigator.share && (
          <Button size="sm" className="mt-3" onClick={onShare}>
            分享给朋友
          </Button>
        )}

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
