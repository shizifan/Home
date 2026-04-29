/**
 * 跨日分隔（PRD §3 主题）
 *   ─── Day 2 · 这是我们家 ───
 */

export function DayBreak({ day, title }: { day: number; title: string }) {
  return (
    <div className="flex items-center gap-3 my-5 px-2">
      <span className="flex-1 h-px bg-[rgba(95,94,90,0.18)]" />
      <span className="font-num text-mini text-ink-3 tracking-[0.16em]">
        DAY {day} · {title}
      </span>
      <span className="flex-1 h-px bg-[rgba(95,94,90,0.18)]" />
    </div>
  );
}
