/**
 * 路由级 cookie 预检（PRD §27.2 多用户软隔离的第一层防御）
 *
 * 防御链路：
 *   1. [此处] middleware：cookie 不存在 → 302 /start（廉价 Edge 检查，不查 DB）
 *   2. API route：cookie 存在但无效 → 401（guardUserOnly / guardWithCompanion）
 *   3. apiFetch（client.ts）：拿到 401 → 清 zustand store + window.location → /start
 *
 * 设计要点：
 *   - Edge runtime 不能查 DB；只做 cookie 存在性检查
 *   - "存在但无效"（用户被删 / uid 假值）由第 2、3 层兜底
 */

import { NextResponse, type NextRequest } from 'next/server';

/** 不需要 cookie 的路径前缀（注册入口 / 法务页 / API / 静态资源 / admin 用 ADMIN_KEY 自鉴权）*/
const PUBLIC_PREFIXES = [
  '/start',
  '/legal/',
  '/admin',
  '/api/',
  '/_next/',
];

const PUBLIC_EXACT = new Set(['/favicon.ico']);

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_EXACT.has(pathname)) return NextResponse.next();
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  if (!req.cookies.get('home_uid')) {
    const url = req.nextUrl.clone();
    url.pathname = '/start';
    url.search = '';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
