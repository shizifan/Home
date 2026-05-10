/**
 * 限流（PRD §27.4）
 *
 * 三档限流：
 *   1. IP 限流：1 小时内同一 IP 最多创建 5 个用户
 *   2. 全局每日上限：每日最多新增 50 用户
 *   3. 单用户每日 LLM 调用上限：30 次（保护成本不被恶意刷）
 *
 * 后端：默认 in-memory（适合单机部署）；如设了 REDIS_URL 则走 Redis（多实例）。
 * V1.0 单机部署优先 in-memory；切到多实例时只需改 env，业务代码无感知。
 */

import 'server-only';

// ─────────────── 通用 Counter（in-memory）───────────────

interface Bucket {
  count: number;
  expiresAt: number; // ms timestamp
}

const buckets = new Map<string, Bucket>();

function nowMs() {
  return Date.now();
}

/** 增计数；返回当前总数；TTL 到期会自动重置 */
function bumpInMemory(key: string, ttlSec: number): number {
  const t = nowMs();
  const cur = buckets.get(key);
  if (!cur || cur.expiresAt <= t) {
    const fresh: Bucket = { count: 1, expiresAt: t + ttlSec * 1000 };
    buckets.set(key, fresh);
    return 1;
  }
  cur.count += 1;
  return cur.count;
}

function getInMemory(key: string): number {
  const t = nowMs();
  const cur = buckets.get(key);
  if (!cur || cur.expiresAt <= t) return 0;
  return cur.count;
}

// ─────────────── Redis 适配（如果有）───────────────

let _redis: { incr: (k: string) => Promise<number>; expire: (k: string, s: number) => Promise<unknown>; get: (k: string) => Promise<string | null> } | null = null;
let _redisInitTried = false;

async function getRedisClient() {
  if (_redisInitTried) return _redis;
  _redisInitTried = true;
  const url = process.env.REDIS_URL;
  if (!url) return null;
  try {
    // 动态 import，没装 ioredis 也不影响（typescript 不强制把它列为依赖）
    // @ts-expect-error optional dependency
    const mod = await import('ioredis').catch(() => null);
    if (!mod) return null;
    const RedisCtor = (mod as { default?: unknown; Redis?: unknown }).default ??
      (mod as { Redis?: unknown }).Redis;
    if (!RedisCtor) return null;
    _redis = new (RedisCtor as new (url: string) => NonNullable<typeof _redis>)(url);
    return _redis;
  } catch (e) {
    console.warn('[rateLimit] redis init failed, fall back to in-memory:', e);
    return null;
  }
}

async function bump(key: string, ttlSec: number): Promise<number> {
  const r = await getRedisClient();
  if (!r) return bumpInMemory(key, ttlSec);
  const n = await r.incr(key);
  if (n === 1) await r.expire(key, ttlSec);
  return Number(n);
}

async function getCount(key: string): Promise<number> {
  const r = await getRedisClient();
  if (!r) return getInMemory(key);
  const v = await r.get(key);
  return Number(v ?? 0);
}

// ─────────────── 公开 API ───────────────

export interface RateCheckResult {
  ok: boolean;
  /** 命中限制时填；ok=true 时为 null */
  reason?: 'ip_create_user' | 'global_daily_user' | 'user_daily_llm';
  /** 用于错误响应的提示 */
  message?: string;
  /** 当前使用次数 */
  used?: number;
  /** 上限 */
  limit?: number;
}

/** 1 小时内同 IP 不超过 5 次创建用户 */
export async function checkIpCreateUser(
  ip: string,
): Promise<RateCheckResult> {
  const key = `rl:ip_create:${ip}`;
  const limit = Number(process.env.RATE_IP_CREATE_USER_LIMIT ?? 5);
  const used = await bump(key, 60 * 60); // 1h TTL
  if (used > limit) {
    return {
      ok: false,
      reason: 'ip_create_user',
      message: '今天体验名额已满，明天再来？',
      used,
      limit,
    };
  }
  return { ok: true, used, limit };
}

/** 每日全局新增用户数 */
export async function checkGlobalDailyUser(): Promise<RateCheckResult> {
  const day = new Date().toISOString().slice(0, 10);
  const key = `rl:global_daily_user:${day}`;
  const limit = Number(process.env.RATE_GLOBAL_DAILY_USER_LIMIT ?? 50);
  const used = await bump(key, 24 * 60 * 60);
  if (used > limit) {
    return {
      ok: false,
      reason: 'global_daily_user',
      message: '今天体验名额已满，明天再来？',
      used,
      limit,
    };
  }
  return { ok: true, used, limit };
}

/** 单用户每日 LLM 调用次数（在 callLLM 入口或路由侧调用）*/
export async function checkUserDailyLLM(
  userId: string,
): Promise<RateCheckResult> {
  const day = new Date().toISOString().slice(0, 10);
  const key = `rl:user_llm:${userId}:${day}`;
  const limit = Number(process.env.RATE_USER_DAILY_LLM_LIMIT ?? 30);
  const used = await bump(key, 24 * 60 * 60);
  if (used > limit) {
    return {
      ok: false,
      reason: 'user_daily_llm',
      message: '今天玩得有点累了，明天再来吧。',
      used,
      limit,
    };
  }
  return { ok: true, used, limit };
}

/** 不消耗 quota 的查询（监控用）*/
export async function peekUserDailyLLM(userId: string): Promise<number> {
  const day = new Date().toISOString().slice(0, 10);
  return await getCount(`rl:user_llm:${userId}:${day}`);
}

/** 工具：从 Request 拿 IP（兼容反代 X-Forwarded-For）*/
export function readIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  const real = req.headers.get('x-real-ip');
  if (real) return real;
  return 'unknown';
}
