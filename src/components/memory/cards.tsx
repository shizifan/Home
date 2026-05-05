/**
 * 记忆面板的 4 种卡片组件（PRD §5.4–§5.7）
 * 完全静态展示，纠正动作回调上提到 page。
 */

import type { ReactNode } from 'react';

export interface ConceptCardProps {
  color: string;
  iconBg: string;
  iconText: string;
  name: string;
  summary: string;
  evidence: string[];
  onMenu?: () => void;
  /** P2: PRD §12.7 二手知识标识 — 来源伙伴名（'firsthand' 时不传）*/
  secondhandFrom?: string;
}

export function ConceptCard({
  color,
  iconBg,
  iconText,
  name,
  summary,
  evidence,
  onMenu,
  secondhandFrom,
}: ConceptCardProps) {
  return (
    <div
      className="bg-white border border-[rgba(95,94,90,0.18)] rounded-card p-4 mb-2.5 relative"
      style={{ borderLeft: `4px solid ${color}` }}
    >
      <div className="flex items-center gap-2.5 mb-1.5">
        <span
          className="w-7 h-7 rounded-md flex items-center justify-center font-title text-[13px] text-white font-semibold"
          style={{ background: iconBg }}
        >
          {iconText}
        </span>
        <span className="font-title text-h3 text-ink-1 font-medium flex-1">{name}</span>
        {secondhandFrom && (
          <span
            className="font-title text-mini text-amber-mid bg-amber-light/50 border border-amber-DEFAULT rounded-full px-2 py-0.5"
            title="二手知识：从其他伙伴那里问来的，可能不准"
          >
            听 {secondhandFrom} 说的
          </span>
        )}
        <button
          onClick={onMenu}
          className="font-num text-h3 text-ink-3 tracking-[2px] cursor-pointer bg-transparent border-0 px-1"
          aria-label="操作菜单"
        >
          ⋮
        </button>
      </div>
      <p className="font-title text-sub text-ink-1 leading-[1.55] mb-2">{summary}</p>
      {secondhandFrom && (
        <p className="font-title text-mini text-amber-mid mb-2 italic">
          ⚠ 这件事是听来的，可能不太准
        </p>
      )}
      <p className="font-title text-mini text-ink-3 mb-1">我从这些事知道的：</p>
      <ul className="m-0 pl-3.5">
        {evidence.map((e, i) => (
          <li key={i} className="font-title text-small text-ink-2 leading-[1.6]">
            {e}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function UncertainCard({
  title,
  body,
  onClarify,
}: {
  title: string;
  body: string;
  onClarify?: () => void;
}) {
  return (
    <div className="bg-m-uncertain/10 border border-m-uncertain/50 rounded-card p-4 mb-2.5">
      <h3 className="font-title text-h3 text-ink-1 font-medium mb-1.5">❓ {title}</h3>
      <p className="font-title text-sub text-ink-2 leading-[1.6] mb-3">{body}</p>
      <button
        onClick={onClarify}
        className="bg-m-uncertain text-ink-1 border-0 rounded-full px-4 py-2 font-title text-small font-medium cursor-pointer"
      >
        告诉它真实的感受 →
      </button>
    </div>
  );
}

export function SetAsideCard({
  title,
  quote,
  reason,
  confirmed,
  onRestore,
  onConfirm,
}: {
  title: string;
  quote: string;
  reason: string;
  /** 已确认开玩笑（user_corrected=true）→ 隐藏按钮，加 ✓ */
  confirmed?: boolean;
  onRestore?: () => void;
  onConfirm?: () => void;
}) {
  return (
    <div className="bg-m-setaside/20 border border-m-setaside/60 rounded-card p-4 mb-2.5">
      <h3 className="font-title text-sub text-ink-1 font-medium mb-1">🌙 {title}</h3>
      {quote && <p className="font-title text-small text-ink-2 italic mb-1.5">{quote}</p>}
      <p className="font-title text-small text-ink-2 leading-[1.6] mb-2.5">{reason}</p>

      {confirmed ? (
        <p className="font-title text-mini text-ink-3 mt-1">
          ✓ 你确认过了，让它先放着
        </p>
      ) : (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={onRestore}
            className="bg-amber-light text-amber-deep rounded-full px-3.5 py-1.5 font-title text-small cursor-pointer border-0"
          >
            其实是真的，记起来
          </button>
          <button
            onClick={onConfirm}
            className="bg-transparent text-ink-3 border border-[rgba(95,94,90,0.3)] rounded-full px-3.5 py-1.5 font-title text-small cursor-pointer"
          >
            就是开玩笑
          </button>
        </div>
      )}
    </div>
  );
}

export interface UnknownItem {
  id: string;
  name: string;
}

export function UnknownCard({
  items,
  onPick,
}: {
  items: UnknownItem[];
  onPick?: (item: UnknownItem) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="bg-m-unknown/30 border border-dashed border-[rgba(95,94,90,0.3)] rounded-card p-4 mb-2.5">
      <p className="font-title text-small text-ink-2 mb-2.5">这些是常见的事，但你还没跟我说过：</p>
      <div className="flex flex-wrap gap-2">
        {items.map((it) => (
          <button
            key={it.id}
            onClick={() => onPick?.(it)}
            className="font-title text-sub text-ink-2 bg-white border border-[rgba(95,94,90,0.2)] rounded-full px-3 py-1.5 cursor-pointer"
          >
            · {it.name}
          </button>
        ))}
      </div>
      <p className="font-title text-small text-ink-3 mt-3">你想告诉我哪一个？还是先不说？</p>
    </div>
  );
}

export function SectionHeader({
  color,
  title,
  count,
  icon,
}: {
  color: string;
  title: string;
  count?: number;
  icon: 'heart' | 'q' | 'moon' | 'fog';
}) {
  return (
    <div className="flex items-center gap-2 mt-4 mb-2.5 px-1">
      <SectionIcon kind={icon} color={color} />
      <span className="font-title text-h3 text-ink-1 font-medium">{title}</span>
      {count != null && <span className="font-num text-small text-ink-3">· {count}</span>}
      <span className="flex-1 h-px bg-[rgba(95,94,90,0.15)]" />
    </div>
  );
}

function SectionIcon({ kind, color }: { kind: 'heart' | 'q' | 'moon' | 'fog'; color: string }) {
  if (kind === 'heart')
    return (
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
        <path
          d="M10 17 Q3 12 3 8 Q3 4 7 4 Q9 4 10 6 Q11 4 13 4 Q17 4 17 8 Q17 12 10 17 Z"
          fill={color}
          stroke="#5F5E5A"
          strokeWidth="1.2"
        />
      </svg>
    );
  if (kind === 'q')
    return (
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
        <circle cx="10" cy="10" r="8" fill={color} stroke="#5F5E5A" strokeWidth="1.2" />
        <text x="10" y="14" textAnchor="middle" fontFamily="var(--f-title)" fontSize="12" fontWeight="700" fill="#2C2C2A">
          ?
        </text>
      </svg>
    );
  if (kind === 'moon')
    return (
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
        <path
          d="M14 4 Q6 4 6 10 Q6 16 14 16 Q9 14 9 10 Q9 6 14 4 Z"
          fill={color}
          stroke="#5F5E5A"
          strokeWidth="1.2"
        />
      </svg>
    );
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
      <ellipse cx="7" cy="11" rx="4" ry="3" fill={color} opacity="0.6" stroke="#5F5E5A" strokeWidth="1" />
      <ellipse cx="13" cy="9" rx="5" ry="3" fill={color} opacity="0.5" stroke="#5F5E5A" strokeWidth="1" />
    </svg>
  );
}

export function PanelHeader({
  companionName,
  onBack,
}: {
  companionName: string;
  onBack: () => void;
}) {
  return (
    <header className="px-4 py-3 flex items-center gap-3 border-b border-[rgba(95,94,90,0.12)]">
      <button onClick={onBack} aria-label="返回" className="bg-transparent border-0 p-1 cursor-pointer">
        <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
          <path d="M14 4 L7 11 L14 18" stroke="#2C2C2A" strokeWidth="2" fill="none" strokeLinecap="round" />
        </svg>
      </button>
      <BrainIcon />
      <div className="flex-1">
        <h1 className="font-title text-h3 text-ink-1 font-medium">它的脑袋</h1>
        <p className="font-title text-mini text-ink-3 mt-0.5">{companionName}在想这些事</p>
      </div>
    </header>
  );
}

function BrainIcon(): ReactNode {
  return (
    <svg width="58" height="48" viewBox="0 0 58 48" aria-hidden>
      <path
        d="M8 24 Q4 8 22 6 Q42 6 50 18 Q56 30 50 38 Q40 44 22 42 Q8 38 8 24 Z"
        fill="#D3D1C7"
        stroke="#5F5E5A"
        strokeWidth="1.5"
      />
      <path d="M18 8 Q16 0 22 0 Q26 4 24 10 Z" fill="#6B6A66" stroke="#5F5E5A" strokeWidth="1" />
      <path d="M30 6 Q28 -2 34 -2 Q38 2 36 8 Z" fill="#6B6A66" stroke="#5F5E5A" strokeWidth="1" />
      <path
        d="M14 24 Q10 14 24 12 Q42 12 46 22 Q50 32 42 36 Q26 38 14 24 Z"
        fill="#FFF8EA"
        stroke="#5F5E5A"
        strokeWidth="1"
        strokeDasharray="2 2"
      />
      <circle cx="22" cy="22" r="2.5" fill="#F0997B" />
      <circle cx="32" cy="20" r="2" fill="#AFA9EC" />
      <circle cx="38" cy="28" r="2" fill="#B5D4F4" />
      <circle cx="26" cy="30" r="2" fill="#F0997B" />
      <ellipse cx="20" cy="20" rx="1.6" ry="2" fill="#2C2C2A" />
    </svg>
  );
}
