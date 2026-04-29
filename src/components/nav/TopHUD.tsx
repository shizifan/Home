/**
 * 主页顶部 HUD（PRD §10.2）
 * 左：「{伙伴名}的家」+ 副标题（伙伴当前状态描述）
 * 右：DAY {N}/7 标签
 */

interface Props {
  companionName: string;
  subtitle?: string;
  day: number;
}

export function TopHUD({ companionName, subtitle, day }: Props) {
  return (
    <header className="px-5 pt-2 pb-3 flex items-center justify-between">
      <div>
        <h1 className="font-title text-h2 text-ink-1">{companionName}的家</h1>
        {subtitle && <p className="font-title text-small text-ink-3 mt-0.5">{subtitle}</p>}
      </div>
      <div className="bg-amber-light text-amber-deep font-num font-semibold text-mini tracking-[0.14em] px-3 py-1.5 rounded-full">
        DAY {day} / 7
      </div>
    </header>
  );
}
