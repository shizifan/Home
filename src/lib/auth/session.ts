/**
 * 用户会话（PRD §27.2 昵称软隔离方案）
 *
 * 客户端 → 服务端识别用户的两条路径：
 *   1. cookie `home_uid`：服务端在创建/找回用户时下发；之后所有 API 默认靠它认人
 *   2. 头部 `x-home-fingerprint`：浏览器指纹（前端生成的稳定哈希）；用于:
 *      - 同昵称冲突时区分浏览器
 *      - cookie 丢失时辅助找回（可选）
 *
 * 当前 SINGLE_USER_ID 仍然作为 dev / 自动化测试的"无 cookie 也能跑"的兜底，
 * 但生产路径要求 cookie 必须存在。受 RESOLVE_USER_REQUIRE_COOKIE 环境变量控制。
 */

import 'server-only';

import { cookies } from 'next/headers';

import { execute, query, queryOne, SINGLE_USER_ID, uuid } from '@/lib/db/client';

const COOKIE_NAME = 'home_uid';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 年
const FINGERPRINT_HEADER = 'x-home-fingerprint';

export interface AppUser {
  id: string;
  nickname: string | null;
  device_fingerprint: string | null;
  status: string;
  created_at: string;
  last_active_at?: string | null;
}

const USER_FIELDS = `
  id, nickname, device_fingerprint, status,
  parent_phone, child_nickname, child_age,
  consent_at, consent_version,
  last_active_at, created_at, updated_at
`;

async function findUserById(id: string): Promise<AppUser | null> {
  return await queryOne<AppUser>(
    `select ${USER_FIELDS} from users where id = :id`,
    { id },
  );
}

async function bumpUserLastActive(id: string): Promise<void> {
  try {
    await execute(
      `update users set last_active_at = current_timestamp(3) where id = :id`,
      { id },
    );
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === 'ER_BAD_FIELD_ERROR') return; // 0006 没跑就忽略
    throw err;
  }
}

/**
 * 解析当前请求的用户。
 *
 * 优先级：
 *   1. cookie home_uid → DB 查
 *   2. dev 模式（NODE_ENV !== 'production' 且 RESOLVE_USER_REQUIRE_COOKIE !== '1'）→ 回退 SINGLE_USER_ID
 *   3. 否则 null（API 应返回 401）
 *
 * 已识别成功时会异步 bump last_active_at（fire-and-forget 不阻塞）。
 */
export async function resolveCurrentUser(): Promise<AppUser | null> {
  const jar = await cookies();
  const cookieUid = jar.get(COOKIE_NAME)?.value;
  if (cookieUid) {
    const user = await findUserById(cookieUid);
    if (user) {
      // 异步 bump，不等
      void bumpUserLastActive(user.id);
      return user;
    }
  }

  // dev 兜底：保留 SINGLE_USER_ID 路径（让 seed-graduate / E2E 不需要 cookie）
  const requireCookie =
    process.env.NODE_ENV === 'production' ||
    process.env.RESOLVE_USER_REQUIRE_COOKIE === '1';
  if (!requireCookie) {
    const fallback = await findUserById(SINGLE_USER_ID);
    if (fallback) {
      void bumpUserLastActive(fallback.id);
      return fallback;
    }
  }

  return null;
}

/** 强制版本：未拿到用户直接 throw（API 入口可 catch 转成 401） */
export class NoUserError extends Error {
  constructor() {
    super('no_user');
    this.name = 'NoUserError';
  }
}

export async function requireCurrentUser(): Promise<AppUser> {
  const u = await resolveCurrentUser();
  if (!u) throw new NoUserError();
  return u;
}

// ─────────────── 创建 / 找回 ───────────────

export interface CreateOrLookupArgs {
  nickname: string;
  device_fingerprint?: string | null;
}

export interface CreateOrLookupResult {
  user: AppUser;
  created: boolean;
  /** 同昵称在 DB 里有几条（仅 nickname 匹配，不限设备）— 用于 UI 提示"昵称已被使用" */
  homonym_count: number;
}

/**
 * 创建或找回用户：
 *   - 如果 (nickname, device_fingerprint) 命中：返回既有用户
 *   - 否则：创建新用户
 *   - 同时返回 homonym_count（仅 nickname 匹配的总条目数，含本次新建）
 */
export async function createOrLookupUser(
  args: CreateOrLookupArgs,
): Promise<CreateOrLookupResult> {
  const nickname = args.nickname.trim();
  if (!nickname) throw new Error('nickname_required');
  const fp = args.device_fingerprint?.slice(0, 100) ?? null;

  // 1. 先看 (nickname, device_fingerprint) 是否已有
  const existing = fp
    ? await queryOne<AppUser>(
        `select ${USER_FIELDS} from users
           where nickname = :n and device_fingerprint = :fp
           limit 1`,
        { n: nickname, fp },
      )
    : null;
  if (existing) {
    void bumpUserLastActive(existing.id);
    const homonym = await queryOne<{ n: number }>(
      `select count(*) as n from users where nickname = :n`,
      { n: nickname },
    );
    return {
      user: existing,
      created: false,
      homonym_count: homonym?.n ?? 1,
    };
  }

  // 2. 没命中 → 新建
  const id = uuid();
  await execute(
    `insert into users (id, nickname, device_fingerprint, status)
       values (:id, :n, :fp, 'active')`,
    { id, n: nickname, fp },
  );
  const user = await findUserById(id);
  if (!user) throw new Error('user_insert_lost');
  void bumpUserLastActive(user.id);

  const homonym = await queryOne<{ n: number }>(
    `select count(*) as n from users where nickname = :n`,
    { n: nickname },
  );
  return { user, created: true, homonym_count: homonym?.n ?? 1 };
}

/** "用昵称回来"：列出该昵称下所有用户，按 last_active_at desc 排序 */
export async function lookupByNickname(
  nickname: string,
): Promise<AppUser[]> {
  const n = nickname.trim();
  if (!n) return [];
  return await query<AppUser>(
    `select ${USER_FIELDS} from users
       where nickname = :n
       order by coalesce(last_active_at, created_at) desc
       limit 20`,
    { n },
  );
}

// ─────────────── cookie 写入（用于 /start 提交后下发）───────────────

export async function setUserCookie(userId: string): Promise<void> {
  const jar = await cookies();
  // Secure flag：默认生产环境开（要求 HTTPS）。HTTP 部署阶段必须设 COOKIE_SECURE=0 关闭，
  // 否则浏览器会丢弃 Set-Cookie，导致所有需鉴权 API 持续 401。
  const secure =
    process.env.COOKIE_SECURE === '0'
      ? false
      : process.env.NODE_ENV === 'production';
  jar.set(COOKIE_NAME, userId, {
    maxAge: COOKIE_MAX_AGE,
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
  });
}

export async function clearUserCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

// ─────────────── 读 fingerprint header ───────────────

export function readFingerprintHeader(req: Request): string | null {
  const v = req.headers.get(FINGERPRINT_HEADER);
  return v ? v.slice(0, 100) : null;
}
