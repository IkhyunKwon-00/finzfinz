import { ensureAppStateTable, getDbPool } from "@/lib/db";

export const runtime = "nodejs";
export const revalidate = 0;

export async function GET(request: Request) {
  const db = getDbPool();
  if (!db) {
    return Response.json({ value: null }, { status: 200 });
  }

  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");
  if (!key) {
    return Response.json({ error: "key required" }, { status: 400 });
  }

  try {
    await ensureAppStateTable();
    const result = await db.query("select value from app_state where key = $1", [
      key,
    ]);
    const value = result.rows?.[0]?.value ?? null;
    return Response.json({ value });
  } catch {
    return Response.json({ value: null }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const db = getDbPool();
  if (!db) {
    return Response.json({ ok: false }, { status: 503 });
  }

  let payload: { key?: string; value?: number } = {};
  try {
    payload = await request.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }

  const { key, value } = payload;
  if (!key || typeof value !== "number") {
    return Response.json({ ok: false }, { status: 400 });
  }

  try {
    await ensureAppStateTable();
    await db.query(
      "insert into app_state (key, value, updated_at) values ($1, $2, now()) " +
        "on conflict (key) do update set value = excluded.value, updated_at = now()",
      [key, value]
    );
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}
