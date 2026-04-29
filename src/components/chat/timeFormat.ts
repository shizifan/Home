/**
 * 跨 30 分钟才显示一次的时间戳规则。
 * shouldShow(prevAt, currAt) → boolean
 * formatHHmm(at) → "15:34"
 */

const THIRTY_MIN = 30 * 60 * 1000;

export function shouldShowTimestamp(
  prevAt: string | null | undefined,
  currAt: string,
): boolean {
  if (!prevAt) return true; // 第一条
  return new Date(currAt).getTime() - new Date(prevAt).getTime() >= THIRTY_MIN;
}

export function formatHHmm(at: string): string {
  const d = new Date(at);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}
