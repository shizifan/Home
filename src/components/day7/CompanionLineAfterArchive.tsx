/**
 * 档案卡后的伙伴台词（5 选 1 随机）
 *
 * PRD §9.7 / Plan_04 §1.6：
 *   档案展示完毕后伙伴说固定台词（非 LLM 生成）。
 */

'use client';

import { useMemo } from 'react';

const LINES = [
  '你看，这就是你这一周告诉我的全部。',
  '我现在眼里就这些了。',
  '这是我从你身上学到的。',
  '7 天前我什么都不知道。现在我有这些了。',
  '这就是我的世界。是你给我的。',
];

interface CompanionLineAfterArchiveProps {
  companionName: string;
}

export default function CompanionLineAfterArchive({
  companionName,
}: CompanionLineAfterArchiveProps) {
  const line = useMemo(() => LINES[Math.floor(Math.random() * LINES.length)], []);

  return (
    <div className="mt-4 mb-2" style={{ animation: 'fadeIn 1.2s ease' }}>
      <span className="font-title text-mini text-ink-3">— {companionName}</span>
      <p className="font-title text-body text-ink-1 mt-1 leading-[1.6]">
        「{line}」
      </p>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px) }
          to { opacity: 1; transform: translateY(0) }
        }
      `}</style>
    </div>
  );
}
