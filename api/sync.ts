import { auth, pool } from "../src/lib/auth.ts";
import { readLimitedRequestBody } from "../src/lib/readLimitedRequestBody.ts";

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
const profileKeys = new Set([
  "linguaplay-active-space", "linguaplay-audio-quizzes", "linguaplay-card-progress", "linguaplay-confusion-pairs",
  "linguaplay-confusions-by-space", "linguaplay-custom-grammar", "linguaplay-custom-modules", "linguaplay-deleted-modules",
  "linguaplay-german-course-progress", "linguaplay-goal-notified", "linguaplay-learning-plan", "linguaplay-learning-spaces",
  "linguaplay-legacy-seed-name-cleaned", "linguaplay-lessons-by-space", "linguaplay-placement-session",
  "linguaplay-module-order-by-space", "linguaplay-module-overrides", "linguaplay-path-completions-by-space",
  "linguaplay-path-sequences-by-space", "linguaplay-preferences", "linguaplay-progress-by-space", "linguaplay-saved-activities",
  "linguaplay-speech-settings", "linguaplay-stats-by-space", "linguaplay-user-stats", "linguaplay-vacation",
]);
const contentKeys = new Set(["linguaplay-custom-modules", "linguaplay-module-overrides", "linguaplay-deleted-modules", "linguaplay-lessons-by-space", "linguaplay-audio-quizzes", "linguaplay-saved-activities", "linguaplay-custom-grammar"]);
const displayOnlyStatsKeys = new Set(["linguaplay-stats-by-space", "linguaplay-user-stats"]);
const isAllowedProfileKey = (key: string) => profileKeys.has(key) || /^linguaplay-material-(?:folders|folder-assignments):[\w-]{1,100}$/i.test(key);
let schemaReady: Promise<void> | null = null;
async function ensureSchema() {
  schemaReady ??= pool.query(`CREATE TABLE IF NOT EXISTS linguaplay_user_data (
    user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE, data jsonb NOT NULL DEFAULT '{}'::jsonb, updated_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS linguaplay_user_data_keys (
    user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, key text NOT NULL, value text NOT NULL, version bigint NOT NULL DEFAULT 1,
    deleted boolean NOT NULL DEFAULT false, updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,key));
    ALTER TABLE linguaplay_user_data_keys ADD COLUMN IF NOT EXISTS deleted boolean NOT NULL DEFAULT false;`).then(() => undefined).catch((error) => { schemaReady = null; throw error; });
  await schemaReady;
}
function stripDisplayStats(value: string) {
  try {
    const strip = (item: unknown): unknown => {
      if (Array.isArray(item)) return item.map(strip);
      if (typeof item === "string") { try { const parsed: unknown = JSON.parse(item); if (parsed && typeof parsed === "object") return JSON.stringify(strip(parsed)); } catch { return item; } return item; }
      if (!item || typeof item !== "object") return item;
      return Object.fromEntries(Object.entries(item as Record<string,unknown>).filter(([key]) => !["crystals","freezeCount","energy","entitlement","isPro","is_pro","role"].includes(key)).map(([key,child]) => [key,strip(child)]));
    };
    return JSON.stringify(strip(JSON.parse(value)));
  } catch { return value; }
}
function asObject(value: unknown): Record<string,string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value as Record<string,unknown>).filter((entry): entry is [string,string] => typeof entry[1] === "string"));
}
function parsedValue(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return value; }
}
function mergeObjects(server: unknown, incoming: unknown): unknown {
  if (Array.isArray(server) && Array.isArray(incoming)) {
    if ([...server,...incoming].every((item) => item && typeof item === "object" && !Array.isArray(item) && typeof (item as Record<string,unknown>).id === "string")) {
      const byId = new Map<string,unknown>();
      for (const item of [...server,...incoming]) { const id = (item as Record<string,unknown>).id as string; byId.set(id,byId.has(id) ? mergeObjects(byId.get(id),item) : item); }
      return [...byId.values()];
    }
    const values = new Map([...server,...incoming].map((item) => [JSON.stringify(item),item]));
    return [...values.values()];
  }
  if (server && incoming && typeof server === "object" && typeof incoming === "object" && !Array.isArray(server) && !Array.isArray(incoming)) {
    const left = server as Record<string,unknown>; const right = incoming as Record<string,unknown>; const result: Record<string,unknown> = { ...left };
    for (const [key,value] of Object.entries(right)) result[key] = key in left ? mergeObjects(left[key],value) : value;
    return result;
  }
  return incoming;
}
function mergeProfileValue(key: string, server: string | undefined, incoming: string | null): string | null {
  if (incoming === null) return null;
  if (server === undefined) return displayOnlyStatsKeys.has(key) ? stripDisplayStats(incoming) : incoming;
  try {
    const merged = mergeObjects(parsedValue(server),parsedValue(incoming));
    const serialized = typeof merged === "string" ? merged : JSON.stringify(merged);
    return displayOnlyStatsKeys.has(key) ? stripDisplayStats(serialized) : serialized;
  } catch { return displayOnlyStatsKeys.has(key) ? stripDisplayStats(incoming) : incoming; }
}
async function sessionUser(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) return null;
  const role = await pool.query("SELECT role FROM linguaplay_user_roles WHERE user_id=$1", [session.user.id]);
  return { id: session.user.id, role: String(role.rows[0]?.role ?? "student") };
}
async function seedVersionedKeys(userId: string) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('linguaplay-profile:' || $1))", [userId]);
    const legacy = await client.query("SELECT data FROM linguaplay_user_data WHERE user_id=$1 FOR UPDATE", [userId]);
    const data = asObject(legacy.rows[0]?.data);
    for (const [key,value] of Object.entries(data)) if (isAllowedProfileKey(key)) await client.query("INSERT INTO linguaplay_user_data_keys(user_id,key,value,version) VALUES($1,$2,$3,1) ON CONFLICT(user_id,key) DO NOTHING", [userId,key,displayOnlyStatsKeys.has(key) ? stripDisplayStats(value) : value]);
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK").catch(() => undefined); throw error; }
  finally { client.release(); }
}
async function readProfile(userId: string) {
  await seedVersionedKeys(userId);
  const result = await pool.query("SELECT key,value,version FROM linguaplay_user_data_keys WHERE user_id=$1 AND deleted=false", [userId]);
  const data: Record<string,string> = {}; const versions: Record<string,number> = {};
  for (const row of result.rows) { data[row.key] = displayOnlyStatsKeys.has(row.key) ? stripDisplayStats(row.value) : row.value; versions[row.key] = Number(row.version); }
  return { data, versions };
}

async function handle(request: Request) {
  const user = await sessionUser(request);
  if (!user) return json({ error: "Sign in is required." }, 401);
  await ensureSchema();
  if (request.method === "GET") return json(await readProfile(user.id));

  const raw = await readLimitedRequestBody(request, 3_800_000);
  if (!raw) return json({ error: "The sync payload is too large. Remove large media files and try again." }, 413);
  let payload: { patch?: unknown; versions?: unknown; data?: unknown };
  try { payload = JSON.parse(new TextDecoder().decode(raw)) as typeof payload; } catch { return json({ error: "Invalid JSON payload." }, 400); }
  const patch = payload.patch === undefined ? asObject(payload.data) : payload.patch;
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return json({ error: "Expected a profile patch." }, 400);
  const entries = Object.entries(patch as Record<string,unknown>);
  if (entries.length > 100 || entries.some(([key,value]) => !isAllowedProfileKey(key) || (value !== null && typeof value !== "string") || (typeof value === "string" && new TextEncoder().encode(value).byteLength > 300_000))) return json({ error: "Invalid profile patch." }, 400);
  if (user.role !== "owner" && user.role !== "admin" && entries.some(([key]) => contentKeys.has(key))) return json({ error: "Персональные материалы больше не синхронизируются как общий контент. Используйте каталог материалов." }, 403);
  const versions = payload.versions && typeof payload.versions === "object" && !Array.isArray(payload.versions) ? payload.versions as Record<string,unknown> : {};
  const client = await pool.connect(); const conflicts: string[] = [];
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('linguaplay-profile:' || $1))", [user.id]);
    await client.query("INSERT INTO linguaplay_user_data(user_id,data) VALUES($1,'{}'::jsonb) ON CONFLICT(user_id) DO NOTHING", [user.id]);
    const legacyResult = await client.query("SELECT data FROM linguaplay_user_data WHERE user_id=$1 FOR UPDATE", [user.id]);
    const mergedData = asObject(legacyResult.rows[0]?.data);
    for (const [key,value] of entries) {
      const current = await client.query("SELECT value,version,deleted FROM linguaplay_user_data_keys WHERE user_id=$1 AND key=$2 FOR UPDATE", [user.id,key]);
      const previous = current.rows[0];
      const currentVersion = Number(previous?.version ?? 0);
      const baseVersion = Number(versions[key] ?? 0);
      const serverValue = previous && !previous.deleted ? String(previous.value) : mergedData[key];
      const conflict = Boolean(previous && baseVersion !== currentVersion);
      if (conflict) conflicts.push(key);
      const nextValue = conflict && value === null ? serverValue ?? null : mergeProfileValue(key,serverValue,value as string|null);
      if (nextValue === null) {
        await client.query(`INSERT INTO linguaplay_user_data_keys(user_id,key,value,version,deleted) VALUES($1,$2,'',$3,true)
          ON CONFLICT(user_id,key) DO UPDATE SET value='',version=EXCLUDED.version,deleted=true,updated_at=now()`, [user.id,key,currentVersion+1]);
        delete mergedData[key];
      } else {
        const finalValue = nextValue ?? "";
        await client.query(`INSERT INTO linguaplay_user_data_keys(user_id,key,value,version,deleted) VALUES($1,$2,$3,$4,$5)
          ON CONFLICT(user_id,key) DO UPDATE SET value=EXCLUDED.value,version=EXCLUDED.version,deleted=EXCLUDED.deleted,updated_at=now()`, [user.id,key,finalValue,currentVersion+1,false]);
        mergedData[key] = finalValue;
      }
    }
    await client.query("UPDATE linguaplay_user_data SET data=$2::jsonb,updated_at=now() WHERE user_id=$1", [user.id,JSON.stringify(mergedData)]);
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK").catch(() => undefined); throw error; }
  finally { client.release(); }
  const result = await readProfile(user.id);
  return json({ saved: true, ...result, conflicts });
}

export async function GET(request: Request) { return handle(request); }
export async function PUT(request: Request) { return handle(request); }
