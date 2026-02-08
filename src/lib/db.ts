import { Pool } from "pg";

let pool: Pool | null = null;
let initPromise: Promise<void> | null = null;

export function getDbPool() {
  if (!process.env.DATABASE_URL) {
    return null;
  }
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 2,
      idleTimeoutMillis: 10_000,
    });
  }
  return pool;
}

export async function ensureAppStateTable() {
  const db = getDbPool();
  if (!db) {
    return null;
  }
  if (!initPromise) {
    initPromise = db
      .query(
        "create table if not exists app_state (" +
          "key text primary key, " +
          "value double precision, " +
          "updated_at timestamptz default now()" +
          ")"
      )
      .then(() => undefined);
  }
  return initPromise;
}
