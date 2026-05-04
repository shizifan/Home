/**
 * 毕业卡组件 — 1080×1920 竖版分享卡
 *
 * PRD §10.2-§10.4 / Plan_04 §2：
 *   等距小屋 + 6 项档案 + 4 栏数据。
 *   使用 forwardRef 兼容 html-to-image 导出。
 */

import { forwardRef } from 'react';
import { Room } from '@/components/room/Room';
import { Companion } from '@/components/characters/Companion';
import type { CompanionPresetId } from '@/components/characters/types';
import type { WorldviewData } from '@/lib/api/client';
import type { DerivedLayout } from '@/lib/room/derivedLayout';

export interface GradCardStats {
  photos: number;
  conversations: number;
  corrections: number;
}

export interface GraduationCardProps {
  companionName: string;
  presetId: CompanionPresetId;
  worldview: WorldviewData;
  stats: GradCardStats;
  layout: DerivedLayout;
}

const GraduationCard = forwardRef<HTMLDivElement, GraduationCardProps>(
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
            <span
              style={{
                fontFamily: 'var(--f-title)',
                fontSize: 38,
                color: '#2C2C2A',
                fontWeight: 500,
                letterSpacing: '0.04em',
              }}
            >
              Home
            </span>
            <span
              style={{
                fontFamily: 'var(--f-num)',
                fontSize: 16,
                color: '#888780',
                letterSpacing: '0.18em',
              }}
            >
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

        {/* 等距小屋 */}
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
            <span style={{ fontFamily: 'var(--f-title)', fontSize: 26, color: '#2C2C2A' }}>
              它眼中的世界
            </span>
            <span style={{ flex: 1, height: 1, background: 'rgba(95,94,90,0.25)' }} />
            <span
              style={{
                fontFamily: 'var(--f-num)',
                fontSize: 12,
                color: '#888780',
                letterSpacing: '0.16em',
              }}
            >
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

export default GraduationCard;
