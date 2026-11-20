import { timingSafeEqual } from "node:crypto";
import { auth, pool } from "../src/lib/auth.ts";
import { readLimitedRequestBody } from "../src/lib/readLimitedRequestBody.ts";

const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
const providers = ["azure", "elevenlabs"] as const;
type Provider = typeof providers[number];

let schemaReady: Promise<void> | null = null;
function ensureSchema() {
  schemaReady ??= pool.query("CREATE TABLE IF NOT EXISTS linguaplay_provider_usage (provider text NOT NULL, period_kind text NOT NULL CHECK (period_kind IN ('day','month')), period_key text NOT NULL, user_id text NOT NULL, characters integer NOT NULL DEFAULT 0, requests integer NOT NULL DEFAULT 0, updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(provider,period_kind,period_key,user_id))").then(() => undefined).catch((error) => { schemaReady = null; throw error; });
  return schemaReady;
}

function positiveLimit(name: string) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : null;
}

export async function POST(request: Request) {
  const internalSecret = process.env.LINGUAPLAY_INTERNAL_TTS_SECRET ?? "";
  const suppliedSecret = request.headers.get("x-linguaplay-internal") ?? "";
  const internalBytes = Buffer.from(internalSecret);
  const suppliedBytes = Buffer.from(suppliedSecret);
  if (!internalSecret || internalBytes.length !== suppliedBytes.length || !timingSafeEqual(internalBytes, suppliedBytes)) return json({ error: "Speech is temporarily unavailable." }, 404);
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) return json({ error: "Speech is temporarily unavailable." }, 401);
  const role = await pool.query("SELECT role FROM linguaplay_user_roles WHERE user_id=$1", [session.user.id]);
  if (role.rows[0]?.role !== "owner" || (session.user as { role?: string }).role !== "admin") return json({ error: "Speech is temporarily unavailable." }, 403);
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 1_000) return json({ error: "Invalid request." }, 413);
  let body: Record<string, unknown>;
  try {
    const bytes = await readLimitedRequestBody(request, 1_000);
    if (!bytes) return json({ error: "Invalid request." }, 413);
    const raw = new TextDecoder().decode(bytes);
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return json({ error: "Invalid request." }, 400);
    body = value as Record<string, unknown>;
  } catch { return json({ error: "Invalid request." }, 400); }
  const provider = body.provider;
  const characters = body.characters;
  if (!providers.includes(provider as Provider) || !Number.isInteger(characters) || Number(characters) < 1 || Number(characters) > 2_000) return json({ error: "Invalid request." }, 400);
  const providerName = provider as Provider;
  const prefix = "LINGUAPLAY_TTS_" + providerName.toUpperCase();
  const userDailyCap = positiveLimit(prefix + "_USER_DAILY_CHARS");
  const projectMonthlyCap = positiveLimit(prefix + "_PROJECT_MONTHLY_CHARS");
  if (!userDailyCap || !projectMonthlyCap) return json({ error: "Speech is temporarily unavailable." }, 503);
  try {
    await ensureSchema();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext('linguaplay-tts:' || $1))", [providerName]);
      const usage = await client.query("SELECT period_kind,characters FROM linguaplay_provider_usage WHERE provider=$1 AND ((period_kind='day' AND period_key=to_char(now(),'YYYY-MM-DD') AND user_id=$2) OR (period_kind='month' AND period_key=to_char(now(),'YYYY-MM') AND user_id='*')) FOR UPDATE", [providerName, session.user.id]);
      const dailyUsed = Number(usage.rows.find((row) => row.period_kind === "day")?.characters ?? 0);
      const projectUsed = Number(usage.rows.find((row) => row.period_kind === "month")?.characters ?? 0);
      if (dailyUsed + Number(characters) > userDailyCap || projectUsed + Number(characters) > projectMonthlyCap) {
        await client.query("ROLLBACK");
        return json({ error: "Speech is temporarily unavailable." }, 429);
      }
      await client.query("INSERT INTO linguaplay_provider_usage(provider,period_kind,period_key,user_id,characters,requests) VALUES($1,'day',to_char(now(),'YYYY-MM-DD'),$2,$3,1) ON CONFLICT(provider,period_kind,period_key,user_id) DO UPDATE SET characters=linguaplay_provider_usage.characters+EXCLUDED.characters,requests=linguaplay_provider_usage.requests+1,updated_at=now()", [providerName, session.user.id, Number(characters)]);
      await client.query("INSERT INTO linguaplay_provider_usage(provider,period_kind,period_key,user_id,characters,requests) VALUES($1,'month',to_char(now(),'YYYY-MM'),'*',$2,1) ON CONFLICT(provider,period_kind,period_key,user_id) DO UPDATE SET characters=linguaplay_provider_usage.characters+EXCLUDED.characters,requests=linguaplay_provider_usage.requests+1,updated_at=now()", [providerName, Number(characters)]);
      await client.query("COMMIT");
      return json({ allowed: true });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally { client.release(); }
  } catch { return json({ error: "Speech is temporarily unavailable." }, 503); }
}
