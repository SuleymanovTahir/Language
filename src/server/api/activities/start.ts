import { auth, ensureInitialAppRole, pool } from "../../../lib/auth.ts";
import { readLimitedRequestBody } from "../../../lib/readLimitedRequestBody.ts";
import type { PoolClient } from "pg";

const configuredRefillMinutes = Number(process.env.LINGUAPLAY_ENERGY_REFILL_MINUTES ?? 30);
export const ENERGY_CAP = 22;
const REFILL_MS = Number.isInteger(configuredRefillMinutes)
  ? Math.max(1, Math.min(1440, configuredRefillMinutes)) * 60 * 1000
  : 30 * 60 * 1000;
const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

let tablesReady: Promise<void> | null = null;
export function ensureEnergyTables() {
  tablesReady ??= pool
    .query(`
    CREATE TABLE IF NOT EXISTS linguaplay_energy_accounts (
      user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
      energy integer NOT NULL DEFAULT 22 CHECK (energy BETWEEN 0 AND 22),
      energy_cap_version integer NOT NULL DEFAULT 2,
      next_at timestamptz,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS linguaplay_energy_ledger (
      id bigserial PRIMARY KEY,
      user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      amount integer NOT NULL,
      balance_after integer NOT NULL,
      next_at_after timestamptz,
      reason text NOT NULL,
      activity_id text,
      idempotency_key text NOT NULL,
      is_pro boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE(user_id,idempotency_key)
    );
    CREATE INDEX IF NOT EXISTS linguaplay_energy_ledger_user_time_idx ON linguaplay_energy_ledger(user_id,created_at DESC);
    ALTER TABLE linguaplay_energy_ledger ADD COLUMN IF NOT EXISTS next_at_after timestamptz;
    ALTER TABLE linguaplay_energy_ledger ADD COLUMN IF NOT EXISTS is_pro boolean NOT NULL DEFAULT false;
    ALTER TABLE linguaplay_energy_accounts ADD COLUMN IF NOT EXISTS energy_cap_version integer NOT NULL DEFAULT 1;
    UPDATE linguaplay_energy_accounts
      SET energy=LEAST(22,GREATEST(0,round(energy::numeric * 22 / 5)::integer)),
          next_at=CASE WHEN energy >= 5 THEN NULL ELSE next_at END,
          energy_cap_version=2,updated_at=now()
      WHERE energy_cap_version < 2;
    ALTER TABLE linguaplay_energy_accounts ALTER COLUMN energy SET DEFAULT 22;
    CREATE TABLE IF NOT EXISTS linguaplay_energy_game_streaks (
      user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      session_id text NOT NULL,
      activity_id text NOT NULL,
      streak integer NOT NULL DEFAULT 0,
      awarded jsonb NOT NULL DEFAULT '[]'::jsonb,
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY(user_id,session_id)
    );
    CREATE TABLE IF NOT EXISTS linguaplay_energy_answer_events (
      user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      event_id text NOT NULL,
      session_id text NOT NULL,
      correct boolean NOT NULL,
      bonus integer NOT NULL DEFAULT 0,
      balance_after integer NOT NULL,
      streak integer NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY(user_id,event_id)
    );
  `)
    .then(() => undefined)
    .catch((error) => {
      tablesReady = null;
      throw error;
    });
  return tablesReady;
}

type EnergySnapshot = { energy: number; nextAt: string | null; now: Date };

export async function loadEnergy(client: PoolClient, userId: string): Promise<EnergySnapshot> {
  let result = await client.query(
    `SELECT energy,next_at,now() AS db_now FROM linguaplay_energy_accounts WHERE user_id=$1 FOR UPDATE`,
    [userId],
  );
  if (!result.rowCount) {
    result = await client.query(
      `
      INSERT INTO linguaplay_energy_accounts(user_id,energy,next_at,updated_at) VALUES($1,$2,NULL,now())
      ON CONFLICT(user_id) DO NOTHING
      RETURNING energy,next_at,now() AS db_now
    `,
      [userId, ENERGY_CAP],
    );
    if (!result.rowCount)
      result = await client.query(
        `SELECT energy,next_at,now() AS db_now FROM linguaplay_energy_accounts WHERE user_id=$1 FOR UPDATE`,
        [userId],
      );
    if (result.rowCount)
      await client.query(
        `INSERT INTO linguaplay_energy_ledger(user_id,amount,balance_after,next_at_after,reason,idempotency_key) VALUES($1,$2,$2,NULL,'Initial account energy','initial-grant') ON CONFLICT(user_id,idempotency_key) DO NOTHING`,
        [userId, ENERGY_CAP],
      );
  }
  const row = result.rows[0] as {
    energy: number;
    next_at: Date | string | null;
    db_now: Date | string;
  };
  let energy = Number(row.energy);
  const now = new Date(row.db_now);
  let nextAt = row.next_at ? new Date(row.next_at) : null;
  if (energy > ENERGY_CAP) {
    const previousEnergy = energy;
    energy = ENERGY_CAP;
    nextAt = null;
    await client.query(
      "UPDATE linguaplay_energy_accounts SET energy=$2,next_at=NULL,updated_at=now() WHERE user_id=$1",
      [userId, ENERGY_CAP],
    );
    await client.query(
      `INSERT INTO linguaplay_energy_ledger(user_id,amount,balance_after,next_at_after,reason,idempotency_key)
      VALUES($1,$2,$3,NULL,'Balance capped to current configuration',$4) ON CONFLICT(user_id,idempotency_key) DO NOTHING`,
      [userId, ENERGY_CAP - previousEnergy, ENERGY_CAP, `cap-normalize:${ENERGY_CAP}`],
    );
  }
  if (energy < ENERGY_CAP && !nextAt) {
    nextAt = new Date(now.getTime() + REFILL_MS);
    await client.query(
      "UPDATE linguaplay_energy_accounts SET next_at=$2,updated_at=now() WHERE user_id=$1",
      [userId, nextAt],
    );
  }
  if (energy < ENERGY_CAP && nextAt && now.getTime() >= nextAt.getTime()) {
    const restored = Math.min(
      ENERGY_CAP - energy,
      1 + Math.floor((now.getTime() - nextAt.getTime()) / REFILL_MS),
    );
    const priorNextAt = nextAt;
    energy += restored;
    nextAt = energy >= ENERGY_CAP ? null : new Date(nextAt.getTime() + restored * REFILL_MS);
    await client.query(
      "UPDATE linguaplay_energy_accounts SET energy=$2,next_at=$3,updated_at=now() WHERE user_id=$1",
      [userId, energy, nextAt],
    );
    await client.query(
      `
      INSERT INTO linguaplay_energy_ledger(user_id,amount,balance_after,next_at_after,reason,idempotency_key)
      VALUES($1,$2,$3,$4,'Time refill',$5) ON CONFLICT(user_id,idempotency_key) DO NOTHING
    `,
      [userId, restored, energy, nextAt, `refill:${priorNextAt.toISOString()}`],
    );
  }
  return { energy, nextAt: nextAt?.toISOString() ?? null, now };
}

export async function hasPro(client: PoolClient, userId: string) {
  const result = await client.query(
    `
    SELECT EXISTS(
      SELECT 1 FROM linguaplay_user_entitlements
      WHERE user_id=$1 AND status='active'
        AND (starts_at IS NULL OR starts_at <= now())
        AND ends_at IS NOT NULL AND ends_at > now()
      UNION ALL
      SELECT 1 FROM linguaplay_entitlements
      WHERE account_id=$1 AND feature='pro' AND status='active'
        AND starts_at <= now() AND ends_at > now()
    ) AS active
  `,
    [userId],
  );
  return Boolean(result.rows[0]?.active);
}

export async function hasUnlimitedEnergy(client: PoolClient, userId: string) {
  const result = await client.query("SELECT role FROM linguaplay_user_roles WHERE user_id=$1", [
    userId,
  ]);
  return ["owner", "admin"].includes(String(result.rows[0]?.role ?? ""));
}

export async function runWithAccount<T>(
  userId: string,
  operation: (client: PoolClient) => Promise<T>,
) {
  await ensureEnergyTables();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('linguaplay-energy-user:' || $1))", [
      userId,
    ]);
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) return json({ error: "Sign in is required." }, 401);
  await ensureInitialAppRole(session.user.id);
  try {
    const result = await runWithAccount(session.user.id, async (client) => {
      const energy = await loadEnergy(client, session.user.id);
      return {
        ...energy,
        isPro: await hasPro(client, session.user.id),
        unlimitedEnergy: await hasUnlimitedEnergy(client, session.user.id),
        cap: ENERGY_CAP,
        refillMs: REFILL_MS,
      };
    });
    return json(result);
  } catch {
    return json({ error: "Unable to load energy." }, 503);
  }
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) return json({ error: "Sign in is required." }, 401);
  await ensureInitialAppRole(session.user.id);
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 2_000) return json({ error: "Invalid activity request." }, 413);
  let body: Record<string, unknown>;
  try {
    const bytes = await readLimitedRequestBody(request, 2_000);
    if (!bytes) return json({ error: "Invalid activity request." }, 413);
    const raw = new TextDecoder().decode(bytes);
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value))
      return json({ error: "Invalid activity request." }, 400);
    body = value as Record<string, unknown>;
  } catch {
    return json({ error: "Invalid JSON." }, 400);
  }
  const activityId = typeof body.activityId === "string" ? body.activityId.trim() : "";
  const idempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey : "";
  if (!/^[\w-]{1,120}$/.test(activityId) || !/^[A-Za-z0-9:_-]{8,100}$/.test(idempotencyKey))
    return json({ error: "Invalid activity request." }, 400);

  try {
    const result = await runWithAccount(session.user.id, async (client) => {
      const previous = await client.query(
        `
        SELECT id::text AS "sessionId",balance_after AS energy,next_at_after AS "nextAt",is_pro AS "isPro",now() AS "serverNow"
        FROM linguaplay_energy_ledger WHERE user_id=$1 AND idempotency_key=$2
      `,
        [session.user.id, idempotencyKey],
      );
      if (previous.rowCount) {
        const unlimitedEnergy = await hasUnlimitedEnergy(client, session.user.id);
        return {
          ...previous.rows[0],
          unlimitedEnergy,
          cap: ENERGY_CAP,
          refillMs: REFILL_MS,
          idempotent: true,
        };
      }

      const snapshot = await loadEnergy(client, session.user.id);
      const isPro = await hasPro(client, session.user.id);
      const unlimitedEnergy = await hasUnlimitedEnergy(client, session.user.id);
      if (!isPro && !unlimitedEnergy && snapshot.energy <= 0)
        return {
          ...snapshot,
          isPro,
          unlimitedEnergy,
          cap: ENERGY_CAP,
          refillMs: REFILL_MS,
          exhausted: true,
        };
      const energy = isPro || unlimitedEnergy ? snapshot.energy : snapshot.energy - 1;
      const nextAt =
        !isPro && !unlimitedEnergy && energy < ENERGY_CAP
          ? (snapshot.nextAt ?? new Date(snapshot.now.getTime() + REFILL_MS).toISOString())
          : energy >= ENERGY_CAP
            ? null
            : snapshot.nextAt;
      await client.query(
        "UPDATE linguaplay_energy_accounts SET energy=$2,next_at=$3,updated_at=now() WHERE user_id=$1",
        [session.user.id, energy, nextAt],
      );
      const created = await client.query(
        `
        INSERT INTO linguaplay_energy_ledger(user_id,amount,balance_after,next_at_after,reason,activity_id,idempotency_key,is_pro)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8)
        RETURNING id::text AS "sessionId"
      `,
        [
          session.user.id,
          isPro || unlimitedEnergy ? 0 : -1,
          energy,
          nextAt,
          isPro ? "PRO activity" : unlimitedEnergy ? "Admin activity" : "Activity start",
          activityId,
          idempotencyKey,
          isPro,
        ],
      );
      return {
        sessionId: created.rows[0].sessionId,
        energy,
        nextAt,
        now: snapshot.now,
        isPro,
        unlimitedEnergy,
        cap: ENERGY_CAP,
        refillMs: REFILL_MS,
        idempotent: false,
      };
    });
    if ("exhausted" in result && result.exhausted) return json(result, 429);
    return json(result);
  } catch {
    return json({ error: "Unable to start activity." }, 503);
  }
}
