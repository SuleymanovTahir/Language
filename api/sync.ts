import { auth, pool } from "../src/lib/auth.ts";

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
});
let profileTableReady: Promise<void> | null = null;

async function ensureProfileTable() {
  profileTableReady ??= pool.query(`
    CREATE TABLE IF NOT EXISTS linguaplay_user_data (
      user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
      data jsonb NOT NULL DEFAULT '{}'::jsonb,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `).then(() => undefined).catch((error) => { profileTableReady = null; throw error; });
  await profileTableReady;
}

async function handle(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) return json({ error: "Sign in is required." }, 401);
  await ensureProfileTable();

  if (request.method === "GET") {
    const result = await pool.query("SELECT data FROM linguaplay_user_data WHERE user_id = $1", [session.user.id]);
    return json({ data: result.rows[0]?.data ?? {} });
  }

  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > 3_800_000) return json({ error: "The sync payload is too large. Remove large media files and try again." }, 413);
  let payload: { data?: unknown };
  try { payload = JSON.parse(raw) as { data?: unknown }; } catch { return json({ error: "Invalid JSON payload." }, 400); }
  if (!payload.data || typeof payload.data !== "object" || Array.isArray(payload.data)) return json({ error: "Expected a data object." }, 400);
  const entries = Object.entries(payload.data as Record<string, unknown>);
  if (entries.some(([key, value]) => !key.startsWith("linguaplay-") || typeof value !== "string")) return json({ error: "Invalid profile data." }, 400);

  const role = await pool.query("SELECT role, permissions FROM linguaplay_user_roles WHERE user_id=$1", [session.user.id]);
  const appRole = role.rows[0]?.role ?? (session.user.role === "admin" ? "admin" : "student");
  const permissions = { manageContent: ["owner", "admin", "editor"].includes(appRole), ...(role.rows[0]?.permissions ?? {}) };
  const contentKeys = new Set(["linguaplay-custom-modules", "linguaplay-module-overrides", "linguaplay-deleted-modules", "linguaplay-lessons-by-space", "linguaplay-audio-quizzes", "linguaplay-saved-activities", "linguaplay-custom-grammar"]);
  if (!permissions.manageContent) {
    const existing = await pool.query("SELECT data FROM linguaplay_user_data WHERE user_id=$1", [session.user.id]);
    const merged = { ...(existing.rows[0]?.data ?? {}), ...(payload.data as Record<string, string>) };
    for (const key of contentKeys) {
      const submitted = (payload.data as Record<string, string>)[key];
      const previous = existing.rows[0]?.data?.[key];
      if (submitted !== undefined && submitted !== previous) merged[key] = previous ?? "[]";
    }
    payload.data = merged;
  }

  await pool.query(
    `INSERT INTO linguaplay_user_data (user_id, data, updated_at)
     VALUES ($1, $2::jsonb, now())
     ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
    [session.user.id, JSON.stringify(payload.data)],
  );
  return json({ saved: true });
}

export async function GET(request: Request) { return handle(request); }
export async function PUT(request: Request) { return handle(request); }
