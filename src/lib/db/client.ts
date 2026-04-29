/**
 * MySQL 连接池
 * 仅 server-side 使用（API routes / Server Components / Server Actions）。
 * 不要在 'use client' 文件里 import。
 */

import 'server-only';
import mysql from 'mysql2/promise';

let _pool: mysql.Pool | null = null;

export function getPool(): mysql.Pool {
  if (_pool) return _pool;
  _pool = mysql.createPool({
    host: process.env.MYSQL_HOST ?? '127.0.0.1',
    port: Number(process.env.MYSQL_PORT ?? 3306),
    user: process.env.MYSQL_USER ?? 'root',
    password: process.env.MYSQL_PASSWORD ?? '',
    database: process.env.MYSQL_DATABASE ?? 'home',
    charset: 'utf8mb4',
    timezone: 'Z',
    connectionLimit: 10,
    namedPlaceholders: true,
    decimalNumbers: true,
    dateStrings: false,
    // 不要让 mysql2 自动 JSON.parse — 我们用 zod 在业务层解析
    typeCast: (field, next) => {
      if (field.type === 'JSON') {
        const v = field.string('utf8');
        return v == null ? null : JSON.parse(v);
      }
      return next();
    },
  });
  return _pool;
}

type Params = Record<string, unknown>;

/**
 * 简易查询 helper：参数化（占位符 :name），返回行数组。
 * 错误透传给上层。
 */
export async function query<T = Record<string, unknown>>(
  sql: string,
  params?: Params,
): Promise<T[]> {
  // mysql2 的 execute 类型签名对 namedPlaceholders 支持不友好；运行时正常。
  const [rows] = await getPool().execute(sql, (params ?? {}) as never);
  return rows as T[];
}

export async function queryOne<T = Record<string, unknown>>(
  sql: string,
  params?: Params,
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

export async function execute(
  sql: string,
  params?: Params,
): Promise<{ affectedRows: number; insertId: number }> {
  const [res] = await getPool().execute(sql, (params ?? {}) as never);
  const r = res as { affectedRows: number; insertId: number };
  return { affectedRows: r.affectedRows, insertId: r.insertId };
}

/** 事务 helper */
export async function withTransaction<T>(
  fn: (conn: mysql.PoolConnection) => Promise<T>,
): Promise<T> {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const out = await fn(conn);
    await conn.commit();
    return out;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/** UUID v4（CHAR(36)） */
export function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  // 极简退路（仅 dev fallback）
  return Array.from({ length: 36 }, (_, i) =>
    [8, 13, 18, 23].includes(i) ? '-' : Math.floor(Math.random() * 16).toString(16),
  ).join('');
}

export const SINGLE_USER_ID =
  process.env.SINGLE_USER_ID ?? '00000000-0000-0000-0000-000000000001';
