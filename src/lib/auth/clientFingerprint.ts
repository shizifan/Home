/**
 * 浏览器侧的稳定指纹（PRD §27.2 软隔离）
 *
 * 不追求"反作弊"等级，只让"同一浏览器在 nickname 相同情况下识别同一用户"成立。
 * 取浏览器 UA + 时区 + 屏幕尺寸 + screen.colorDepth + 一个写在 localStorage 的随机 UUID 拼起来 hash。
 *
 * localStorage UUID 一旦生成不会再变（除非用户清空），所以指纹在同一浏览器上恒定。
 */

const FP_LOCAL_KEY = 'home_fp_seed';

function makeSeed(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 18);
}

async function sha256Hex(input: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const buf = new TextEncoder().encode(input);
    const hash = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // 退路：djb2 hash
  let h = 5381;
  for (let i = 0; i < input.length; i++) h = ((h << 5) + h) ^ input.charCodeAt(i);
  return (h >>> 0).toString(16).padStart(8, '0');
}

export async function getDeviceFingerprint(): Promise<string> {
  if (typeof window === 'undefined') return '';
  let seed = window.localStorage.getItem(FP_LOCAL_KEY);
  if (!seed) {
    seed = makeSeed();
    try {
      window.localStorage.setItem(FP_LOCAL_KEY, seed);
    } catch {
      // localStorage 被禁用 → 每次重新生成（违反稳定性，但至少不崩）
    }
  }
  const parts = [
    seed,
    navigator.userAgent || '',
    Intl.DateTimeFormat().resolvedOptions().timeZone || '',
    String(window.screen?.width ?? 0),
    String(window.screen?.height ?? 0),
    String(window.screen?.colorDepth ?? 0),
    navigator.language || '',
  ].join('|');
  const hash = await sha256Hex(parts);
  return hash.slice(0, 64);
}
