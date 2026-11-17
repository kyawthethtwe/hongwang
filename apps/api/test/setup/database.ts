import { existsSync } from 'node:fs';
import path from 'node:path';
import { sql } from 'drizzle-orm';
import { Client } from 'pg';
import type { Database } from '../../src/database/database.module';
import { runMigrations } from '../../src/database/migrate';

/** Set by the global setup when the e2e database can't be used; e2e suites then skip. */
export const SKIP_ENV = 'E2E_DB_SKIP_REASON';

export function testDatabaseUrl(): string | undefined {
  const envFile = path.join(__dirname, '../../.env');
  if (existsSync(envFile)) process.loadEnvFile(envFile); // never overrides variables already set
  return process.env.DATABASE_URL_TEST || undefined;
}

/** postgres://user:***@host:port/db, for log lines. */
export const redact = (url: string) => {
  try {
    const u = new URL(url);
    if (u.password) u.password = '***';
    return u.toString();
  } catch {
    return '<invalid DATABASE_URL_TEST>';
  }
};

const INVALID_CATALOG = '3D000'; // database does not exist

/**
 * Creates the test database if it doesn't exist (connecting to the server's `postgres` database),
 * then applies every migration. Returns why the e2e suites must be skipped, or null when ready.
 * A failing migration is a real error (e.g. PostGIS missing) and throws.
 */
export async function prepareTestDatabase(): Promise<string | null> {
  const url = testDatabaseUrl();
  if (!url) return 'DATABASE_URL_TEST is not set (see apps/api/.env.example)';

  const probe = new Client({ connectionString: url, connectionTimeoutMillis: 5_000 });
  try {
    await probe.connect();
  } catch (err) {
    if ((err as { code?: string }).code !== INVALID_CATALOG) {
      return `can't reach ${redact(url)} (${(err as Error).message})`;
    }
    try {
      await createDatabase(url);
    } catch (createErr) {
      return `can't create the test database at ${redact(url)} (${(createErr as Error).message})`;
    }
  } finally {
    await probe.end().catch(() => undefined);
  }

  await runMigrations(url);
  return null;
}

async function createDatabase(url: string) {
  const target = new URL(url);
  const name = decodeURIComponent(target.pathname.replace(/^\//, ''));
  if (!name) throw new Error('DATABASE_URL_TEST has no database name');
  const admin = new URL(url);
  admin.pathname = '/postgres';
  const client = new Client({ connectionString: admin.toString(), connectionTimeoutMillis: 5_000 });
  await client.connect();
  try {
    const exists = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
    if (!exists.rowCount) await client.query(`CREATE DATABASE "${name.replace(/"/g, '""')}"`);
  } finally {
    await client.end();
  }
}

/** Empties every application table (keeps the migrations journal and PostGIS's spatial_ref_sys). */
export async function truncateAll(db: Database) {
  const { rows } = await db.execute<{ tablename: string }>(
    sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'spatial_ref_sys'`,
  );
  if (!rows.length) return;
  const tables = rows.map((r) => `"${r.tablename.replace(/"/g, '""')}"`).join(', ');
  await db.execute(sql.raw(`TRUNCATE ${tables} RESTART IDENTITY CASCADE`));
}
