/**
 * PostgreSQL 连接池（V1.0：从 mysql2 迁移到 pg）
 * 仅 server-side 使用（API routes / Server Components / Server Actions）。
 */

import 'server-only';
import { Pool, QueryResultRow } from 'pg';

let _pool: Pool | null = null;

export function getPool(): Pool {
  if (_pool) return _pool;
  _pool = new Pool({
    host: process.env.PGHOST ?? '127.0.0.1',
    port: parseInt(process.env.PGPORT ?? '5432', 10),
    user: process.env.PGUSER ?? 'root',
    password: process.env.PGPASSWORD ?? '',
    database: process.env.PGDATABASE ?? 'home',
    max: 10,
    idleTimeoutMillis: 30000,
  });
  return _pool;
}

/** 参数化查询：占位符 $1, $2, ...，返回行数组 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params?: unknown[],
): Promise<T[]> {
  const client = await getPool().connect();
  try {
    const result = await client.query<T>(sql, params ?? []);
    return result.rows;
  } finally {
    client.release();
  }
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params?: unknown[],
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

export async function execute(
  sql: string,
  params?: unknown[],
): Promise<{ affectedRows: number }> {
  const client = await getPool().connect();
  try {
    const result = await client.query(sql, params ?? []);
    return { affectedRows: result.rowCount ?? 0 };
  } finally {
    client.release();
  }
}

/** 事务 helper */
export async function withTransaction<T>(
  fn: (client: import('pg').PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** UUID v4 */
export function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return Array.from({ length: 36 }, (_, i) =>
    [8, 13, 18, 23].includes(i) ? '-' : Math.floor(Math.random() * 16).toString(16),
  ).join('');
}

export const SINGLE_USER_ID =
  process.env.SINGLE_USER_ID ?? '00000000-0000-0000-0000-000000000001';
