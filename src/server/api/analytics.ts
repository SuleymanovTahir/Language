import { createHmac, randomBytes } from "node:crypto";
import { pool } from "../../lib/auth.ts";

let schemaReady: Promise<void> | null = null;

export function ensureAnalyticsSchema() {
  schemaReady ??= pool
    .query(`
      CREATE TABLE IF NOT EXISTS linguaplay_analytics_events (
        id bigserial PRIMARY KEY,
        user_id text REFERENCES "user"(id) ON DELETE CASCADE,
        visitor_id text,
        event_type text NOT NULL,
        route text,
        action text,
        activity text,
        country text,
        region text,
        ip_hash text,
        device_type text,
        browser text,
        os text,
        locale text,
        referrer_host text,
        payload jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        CHECK (user_id IS NOT NULL OR visitor_id IS NOT NULL)
      );
      CREATE INDEX IF NOT EXISTS linguaplay_analytics_time_idx ON linguaplay_analytics_events(created_at DESC);
      CREATE INDEX IF NOT EXISTS linguaplay_analytics_user_time_idx ON linguaplay_analytics_events(user_id,created_at DESC);
      CREATE INDEX IF NOT EXISTS linguaplay_analytics_visitor_time_idx ON linguaplay_analytics_events(visitor_id,created_at DESC);
      CREATE INDEX IF NOT EXISTS linguaplay_analytics_type_time_idx ON linguaplay_analytics_events(event_type,created_at DESC);
      CREATE TABLE IF NOT EXISTS linguaplay_analytics_daily_snapshots (
        snapshot_day date PRIMARY KEY,
        metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS linguaplay_analytics_settings (
        id integer PRIMARY KEY CHECK (id=1),
        tracking_started_at timestamptz NOT NULL DEFAULT now()
      );
      INSERT INTO linguaplay_analytics_settings(id) VALUES(1) ON CONFLICT(id) DO NOTHING;
      CREATE TABLE IF NOT EXISTS clickling_feedback (
        id bigserial PRIMARY KEY,
        user_id text REFERENCES "user"(id) ON DELETE CASCADE,
        rating integer NOT NULL CHECK(rating BETWEEN 1 AND 5),
        choice text,
        text text,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      ALTER TABLE clickling_feedback ALTER COLUMN user_id DROP NOT NULL;
      ALTER TABLE clickling_feedback ADD COLUMN IF NOT EXISTS visitor_id text;
      ALTER TABLE clickling_feedback ADD COLUMN IF NOT EXISTS country text;
      ALTER TABLE clickling_feedback ADD COLUMN IF NOT EXISTS region text;
      ALTER TABLE clickling_feedback ADD COLUMN IF NOT EXISTS ip_hash text;
      ALTER TABLE clickling_feedback ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
      CREATE INDEX IF NOT EXISTS clickling_feedback_created_idx ON clickling_feedback(created_at DESC);
      CREATE INDEX IF NOT EXISTS clickling_feedback_user_created_idx ON clickling_feedback(user_id,created_at DESC);
    `)
    .then(() => undefined)
    .catch((error) => {
      schemaReady = null;
      throw error;
    });
  return schemaReady;
}

function secret() {
  const value = process.env.BETTER_AUTH_SECRET;
  if (!value) throw new Error("BETTER_AUTH_SECRET is required for analytics pseudonyms.");
  return value;
}

function digest(value: string) {
  return createHmac("sha256", secret()).update(value).digest("hex");
}

function readCookie(request: Request, name: string) {
  const header = request.headers.get("cookie") ?? "";
  for (const item of header.split(";")) {
    const [key, ...rest] = item.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return "";
}

function requestIp(request: Request) {
  const raw = request.headers.get("x-vercel-forwarded-for") || "";
  return raw.split(",")[0]?.trim().slice(0, 100) || "";
}

function parseAgent(userAgent: string) {
  const ua = userAgent.toLowerCase();
  const device_type = /ipad|tablet|kindle/.test(ua)
    ? "tablet"
    : /mobile|iphone|ipod|android/.test(ua)
      ? "mobile"
      : "desktop";
  const browser = /edg\//.test(ua)
    ? "Edge"
    : /opr\//.test(ua)
      ? "Opera"
      : /firefox\//.test(ua)
        ? "Firefox"
        : /chrome\//.test(ua)
          ? "Chrome"
          : /safari\//.test(ua)
            ? "Safari"
            : "Other";
  const os = /windows/.test(ua)
    ? "Windows"
    : /iphone|ipad|ios/.test(ua)
      ? "iOS"
      : /android/.test(ua)
        ? "Android"
        : /mac os|macintosh/.test(ua)
          ? "macOS"
          : /linux/.test(ua)
            ? "Linux"
            : "Other";
  return { device_type, browser, os };
}

export type AnalyticsActor = {
  visitorId: string;
  cookie: string | null;
  country: string | null;
  region: string | null;
  ipHash: string | null;
  deviceType: string;
  browser: string;
  os: string;
  locale: string | null;
  referrerHost: string | null;
};

export function getAnalyticsActor(request: Request): AnalyticsActor {
  const cookieName = "clickling_visitor";
  const current = readCookie(request, cookieName);
  const valid = /^[a-f0-9]{64}$/.test(current);
  const token = valid ? current : randomBytes(32).toString("hex");
  const userAgent = (request.headers.get("user-agent") ?? "").slice(0, 500);
  const agent = parseAgent(userAgent);
  let referrerHost: string | null = null;
  try {
    const referrer = request.headers.get("referer");
    if (referrer) referrerHost = new URL(referrer).host.slice(0, 160);
  } catch {}
  return {
    visitorId: digest(`visitor:${token}`),
    cookie: valid ? null : `${cookieName}=${token}; Path=/; Max-Age=315360000; HttpOnly; SameSite=Lax${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`,
    country: request.headers.get("x-vercel-ip-country")?.slice(0, 8) || null,
    region: request.headers.get("x-vercel-ip-country-region")?.slice(0, 80) || null,
    ipHash: requestIp(request) ? digest(`ip:${requestIp(request)}`) : null,
    deviceType: agent.device_type,
    browser: agent.browser,
    os: agent.os,
    locale: request.headers.get("accept-language")?.split(",")[0]?.slice(0, 35) || null,
    referrerHost,
  };
}

export function withVisitorCookie(
  response: Response,
  actor: AnalyticsActor,
  enabled = true,
) {
  if (enabled && actor.cookie) response.headers.append("Set-Cookie", actor.cookie);
  return response;
}

export async function saveAnalyticsEvent(args: {
  userId: string | null;
  actor: AnalyticsActor;
  type: string;
  route?: string | null;
  action?: string | null;
  activity?: string | null;
  payload?: Record<string, unknown>;
}, executor: { query: (sql: string, values?: unknown[]) => Promise<unknown> } = pool) {
  await executor.query(
    `INSERT INTO linguaplay_analytics_events
      (user_id,visitor_id,event_type,route,action,activity,country,region,ip_hash,device_type,browser,os,locale,referrer_host,payload)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb)`,
    [
      args.userId,
      args.userId ? null : args.actor.visitorId,
      args.type,
      args.route ?? null,
      args.action ?? null,
      args.activity ?? null,
      args.actor.country,
      args.actor.region,
      args.actor.ipHash,
      args.actor.deviceType,
      args.actor.browser,
      args.actor.os,
      args.actor.locale,
      args.actor.referrerHost,
      JSON.stringify(args.payload ?? {}),
    ],
  );
}

export async function captureDailyAnalyticsSnapshot() {
  await ensureAnalyticsSchema();
  await pool.query(`
    WITH p AS (
      SELECT ((now() AT TIME ZONE 'UTC')::date - 1)::date AS day,
        (((now() AT TIME ZONE 'UTC')::date - 1)::timestamp AT TIME ZONE 'UTC') AS start_at
    ), activity AS NOT MATERIALIZED (
      SELECT user_id,NULL::text AS visitor_id,created_at FROM linguaplay_events
      UNION ALL SELECT user_id,visitor_id,created_at FROM linguaplay_analytics_events
    ), current_window AS (
      SELECT DISTINCT user_id FROM activity,p WHERE user_id IS NOT NULL AND created_at>=p.start_at-interval '29 days' AND created_at<p.start_at+interval '1 day'
    ), prior_window AS (
      SELECT DISTINCT user_id FROM activity,p WHERE user_id IS NOT NULL AND created_at>=p.start_at-interval '59 days' AND created_at<p.start_at-interval '29 days'
    ), revenue AS (
      SELECT currency,SUM(amount_minor)::bigint AS gross_minor,
        (SUM(amount_minor) FILTER (WHERE created_at>=p.start_at-interval '29 days'))::bigint AS gross_30d_minor,
        COUNT(*)::int AS payments,
        COUNT(DISTINCT account_id)::int AS paying_customers
      FROM linguaplay_payments,p
      WHERE lower(status) IN ('paid','succeeded','complete','completed','captured','settled')
        AND created_at<p.start_at+interval '1 day'
      GROUP BY currency
    ), mrr AS (
      SELECT plan.currency,SUM(CASE plan.interval WHEN 'month' THEN plan.amount_minor::numeric WHEN 'year' THEN plan.amount_minor::numeric/12 ELSE 0 END)::numeric AS mrr_minor
      FROM linguaplay_subscriptions s JOIN linguaplay_plans plan ON plan.code=s.plan_code
      CROSS JOIN p boundary
      WHERE lower(s.status) IN ('active','trialing') AND s.period_start<boundary.start_at+interval '1 day' AND s.period_end>=boundary.start_at+interval '1 day'
      GROUP BY plan.currency
    ), metrics AS (
      SELECT jsonb_build_object(
        'new_users', (SELECT COUNT(*)::int FROM "user",p WHERE "createdAt">=p.start_at AND "createdAt"<p.start_at+interval '1 day'),
        'total_users', (SELECT COUNT(*)::int FROM "user",p WHERE "createdAt"<p.start_at+interval '1 day'),
        'dau', (SELECT COUNT(DISTINCT COALESCE('u:'||user_id,'v:'||visitor_id))::int FROM activity,p WHERE created_at>=p.start_at AND created_at<p.start_at+interval '1 day'),
        'wau', (SELECT COUNT(DISTINCT COALESCE('u:'||user_id,'v:'||visitor_id))::int FROM activity,p WHERE created_at>=p.start_at-interval '6 days' AND created_at<p.start_at+interval '1 day'),
        'mau', (SELECT COUNT(DISTINCT COALESCE('u:'||user_id,'v:'||visitor_id))::int FROM activity,p WHERE created_at>=p.start_at-interval '29 days' AND created_at<p.start_at+interval '1 day'),
        'guest_mau', (SELECT COUNT(DISTINCT visitor_id)::int FROM linguaplay_analytics_events,p WHERE visitor_id IS NOT NULL AND created_at>=p.start_at-interval '29 days' AND created_at<p.start_at+interval '1 day'),
        'retained_users_30d', (SELECT COUNT(*)::int FROM current_window c JOIN prior_window old USING(user_id)),
        'churned_users_30d', (SELECT COUNT(*)::int FROM prior_window old WHERE NOT EXISTS (SELECT 1 FROM current_window c WHERE c.user_id=old.user_id)),
        'active_users_previous_30d', (SELECT COUNT(*)::int FROM prior_window),
        'user_churn_rate_30d', COALESCE(ROUND(100.0*(SELECT COUNT(*) FROM prior_window old WHERE NOT EXISTS (SELECT 1 FROM current_window c WHERE c.user_id=old.user_id))/NULLIF((SELECT COUNT(*) FROM prior_window),0),1),0),
        'active_subscriptions', (SELECT COUNT(*)::int FROM linguaplay_subscriptions s,p WHERE lower(status) IN ('active','trialing') AND period_start<p.start_at+interval '1 day' AND period_end>=p.start_at+interval '1 day'),
        'cancelled_subscriptions_30d', (SELECT COUNT(*)::int FROM linguaplay_subscriptions s,p WHERE lower(status) IN ('canceled','cancelled','expired') AND updated_at>=p.start_at-interval '29 days' AND updated_at<p.start_at+interval '1 day'),
        'revenue_by_currency', COALESCE((SELECT jsonb_agg(jsonb_build_object('currency',currency,'gross_minor',gross_minor,'gross_30d_minor',gross_30d_minor,'payments',payments,'paying_customers',paying_customers,'ltv_minor',CASE WHEN paying_customers>0 THEN round(gross_minor::numeric/paying_customers,2) ELSE NULL END)) FROM revenue),'[]'::jsonb),
        'mrr_by_currency', COALESCE((SELECT jsonb_agg(jsonb_build_object('currency',currency,'mrr_minor',mrr_minor)) FROM mrr),'[]'::jsonb)
      ) AS value
    )
    INSERT INTO linguaplay_analytics_daily_snapshots(snapshot_day,metrics,updated_at)
      SELECT p.day,metrics.value,now() FROM p,metrics
      ON CONFLICT(snapshot_day) DO NOTHING
  `);
}
