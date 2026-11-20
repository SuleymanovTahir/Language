import { createHash, createHmac, randomBytes } from "node:crypto";
import { isIP } from "node:net";
import { pool } from "../../lib/auth.ts";

const COOKIE = "linguaplay_guest_id";
const json = (data: unknown, status = 200, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers,
    },
  });

function tokenFrom(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  return (
    cookie
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${COOKIE}=`))
      ?.slice(COOKIE.length + 1) ?? ""
  );
}
function cookieHeader(request: Request, token: string) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE}=${token}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax${secure}`;
}
function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
async function ensureTable() {
  await pool.query(`CREATE TABLE IF NOT EXISTS linguaplay_guest_trials (
    token_hash text PRIMARY KEY,
    first_game_at timestamptz NOT NULL,
    blocked_until timestamptz NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS linguaplay_guest_ip_trials (
    ip_hash text PRIMARY KEY,
    blocked_until timestamptz NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
  )`);
}

function ipHash(request: Request) {
  if (!process.env.VERCEL) return null;
  const forwarded = request.headers.get("x-vercel-forwarded-for") ?? "";
  // Vercel appends the connecting address to the forwarded chain; never use the client-supplied first entry.
  const candidate =
    forwarded
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .at(-1) ?? "";
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || !isIP(candidate)) return null;
  return createHmac("sha256", secret).update(candidate).digest("hex");
}

export async function GET(request: Request) {
  try {
    await ensureTable();
    const remoteHash = ipHash(request);
    if (process.env.VERCEL && !remoteHash)
      return json({ error: "Trial service is unavailable." }, 503);
    let token = tokenFrom(request);
    let headers: HeadersInit = {};
    if (!token || !/^[\w-]{32,100}$/.test(token)) {
      token = randomBytes(32).toString("base64url");
      headers = { "Set-Cookie": cookieHeader(request, token) };
    }
    const result = await pool.query(
      `
    SELECT
      (SELECT blocked_until FROM linguaplay_guest_trials WHERE token_hash=$1) AS token_blocked_until,
      (SELECT blocked_until FROM linguaplay_guest_ip_trials WHERE ip_hash=$2) AS ip_blocked_until
  `,
      [hashToken(token), remoteHash],
    );
    const candidates = [result.rows[0]?.token_blocked_until, result.rows[0]?.ip_blocked_until]
      .filter((value) => value !== null && value !== undefined)
      .map((value) => new Date(value).getTime())
      .filter(Number.isFinite);
    const latestBlockedUntil = candidates.length ? Math.max(...candidates) : null;
    const blockedUntil =
      latestBlockedUntil === null ? null : new Date(latestBlockedUntil).toISOString();
    return json(
      { eligible: !blockedUntil || new Date(blockedUntil).getTime() <= Date.now(), blockedUntil },
      200,
      headers,
    );
  } catch {
    return json({ error: "Trial service is unavailable." }, 503);
  }
}

export async function POST(request: Request) {
  try {
    await ensureTable();
  } catch {
    return json({ error: "Trial service is unavailable." }, 503);
  }
  const remoteHash = ipHash(request);
  if (process.env.VERCEL && !remoteHash)
    return json({ error: "Trial service is unavailable." }, 503);
  let token = tokenFrom(request);
  let headers: HeadersInit = {};
  if (!token || !/^[\w-]{32,100}$/.test(token)) {
    token = randomBytes(32).toString("base64url");
    headers = { "Set-Cookie": cookieHeader(request, token) };
  }
  const key = hashToken(token);
  let client;
  try {
    client = await pool.connect();
  } catch {
    return json({ error: "Trial service is unavailable." }, 503);
  }
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('linguaplay-guest-trial:' || $1))", [
      remoteHash ?? key,
    ]);
    if (remoteHash) {
      const ipClaim = await client.query(
        `
        INSERT INTO linguaplay_guest_ip_trials (ip_hash,blocked_until,updated_at)
        VALUES ($1,now()+interval '30 days',now())
        ON CONFLICT (ip_hash) DO UPDATE SET blocked_until=now()+interval '30 days',updated_at=now()
        WHERE linguaplay_guest_ip_trials.blocked_until <= now()
        RETURNING blocked_until
      `,
        [remoteHash],
      );
      if (!ipClaim.rowCount) {
        const blocked = await client.query(
          "SELECT blocked_until FROM linguaplay_guest_ip_trials WHERE ip_hash=$1",
          [remoteHash],
        );
        await client.query("ROLLBACK");
        return json(
          { allowed: false, blockedUntil: new Date(blocked.rows[0].blocked_until).toISOString() },
          200,
          headers,
        );
      }
    }
    const tokenClaim = await client.query(
      `
      INSERT INTO linguaplay_guest_trials (token_hash,first_game_at,blocked_until,updated_at)
      VALUES ($1,now(),now()+interval '30 days',now())
      ON CONFLICT (token_hash) DO UPDATE SET first_game_at=now(),blocked_until=now()+interval '30 days',updated_at=now()
      WHERE linguaplay_guest_trials.blocked_until <= now()
      RETURNING blocked_until
    `,
      [key],
    );
    if (!tokenClaim.rowCount) {
      const blocked = await client.query(
        "SELECT blocked_until FROM linguaplay_guest_trials WHERE token_hash=$1",
        [key],
      );
      await client.query("ROLLBACK");
      return json(
        { allowed: false, blockedUntil: new Date(blocked.rows[0].blocked_until).toISOString() },
        200,
        headers,
      );
    }
    await client.query("COMMIT");
    return json(
      { allowed: true, blockedUntil: new Date(tokenClaim.rows[0].blocked_until).toISOString() },
      200,
      headers,
    );
  } catch {
    await client.query("ROLLBACK").catch(() => undefined);
    return json({ error: "Trial service is unavailable." }, 503);
  } finally {
    client.release();
  }
}
