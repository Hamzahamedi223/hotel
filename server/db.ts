import fs from 'node:fs';
import path from 'node:path';
import { AsyncLocalStorage } from 'node:async_hooks';
import pg from 'pg';

/**
 * Postgres access for the API.
 *
 *  * Production (Vercel): DATABASE_URL points at Supabase's connection pooler.
 *  * Local dev without DATABASE_URL: an embedded Postgres (PGlite) stored in
 *    ./data/pglite, so the app runs with zero setup.
 *
 * Services keep the SQLite-era call shape — all/get/run with `?`
 * placeholders — so the business logic ported over unchanged apart from
 * `await`. `?` is rewritten to `$1, $2…` here.
 */

interface Conn {
  query(sql: string, params?: any[]): Promise<{ rows: any[]; rowCount: number }>;
}

// COUNT/SUM over integers come back as int8/numeric; the UI expects numbers.
pg.types.setTypeParser(20, (v) => parseInt(v, 10));
pg.types.setTypeParser(1700, (v) => parseFloat(v));

let pool: pg.Pool | null = null;
let lite: any = null;
const txStore = new AsyncLocalStorage<Conn>();
let ready: Promise<void> | null = null;

async function getLite() {
  if (!lite) {
    const { PGlite } = await import('@electric-sql/pglite');
    const dir = path.join(process.cwd(), 'data', 'pglite');
    fs.mkdirSync(dir, { recursive: true });
    lite = new PGlite(dir, { parsers: { 20: (v: string) => parseInt(v, 10), 1700: (v: string) => parseFloat(v) } });
  }
  return lite;
}

function getPool() {
  if (!pool) {
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL!) ? undefined : { rejectUnauthorized: false },
      max: 3,
    });
  }
  return pool;
}

const useLite = () => !process.env.DATABASE_URL;

function liteConn(db: any): Conn {
  return {
    async query(sql, params = []) {
      const r = await db.query(sql, params);
      return { rows: r.rows, rowCount: r.affectedRows ?? r.rows.length };
    },
  };
}

async function conn(): Promise<Conn> {
  const tx = txStore.getStore();
  if (tx) return tx;
  if (useLite()) return liteConn(await getLite());
  const p = getPool();
  return { query: async (sql, params) => { const r = await p.query(sql, params); return { rows: r.rows, rowCount: r.rowCount ?? 0 }; } };
}

function toPg(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

export async function all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  return (await (await conn()).query(toPg(sql), params)).rows as T[];
}

export async function get<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
  return (await all<T>(sql, params))[0];
}

export async function run(sql: string, params: any[] = []): Promise<{ lastInsertRowid: number; changes: number }> {
  let q = toPg(sql);
  const isInsert = /^\s*INSERT\s/i.test(q) && !/\bRETURNING\b/i.test(q) && !/^\s*INSERT INTO settings\b/i.test(q);
  if (isInsert) q += ' RETURNING id';
  const r = await (await conn()).query(q, params);
  return { lastInsertRowid: isInsert ? r.rows[0]?.id ?? 0 : 0, changes: r.rowCount };
}

/** Runs fn in one SQL transaction: commits on success, rolls back and re-throws on error. */
export async function transaction<T>(fn: () => Promise<T>): Promise<T> {
  if (txStore.getStore()) return fn(); // already inside one
  if (useLite()) {
    const db = await getLite();
    return db.transaction((tx: any) => txStore.run(liteConn(tx), fn));
  }
  const client = await getPool().connect();
  const c: Conn = { query: async (sql, params) => { const r = await client.query(sql, params); return { rows: r.rows, rowCount: r.rowCount ?? 0 }; } };
  try {
    await client.query('BEGIN');
    const result = await txStore.run(c, fn);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/** Executes a multi-statement SQL script (no parameters). */
export async function exec(sqlText: string): Promise<void> {
  if (useLite()) {
    await (await getLite()).exec(sqlText);
    return;
  }
  await getPool().query(sqlText);
}

/** Creates tables / seeds core data once per server instance. */
export function ensureReady(init: () => Promise<void>): Promise<void> {
  if (!ready) ready = init().catch((err) => { ready = null; throw err; });
  return ready;
}
