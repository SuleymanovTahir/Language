import { auth, ensureInitialAppRole, pool } from "../src/lib/auth.ts";
import { hashPassword } from "better-auth/crypto";
import { ensureEngagementSchema } from "../src/server/api/engagement.ts";
import {
  captureDailyAnalyticsSnapshot,
  ensureAnalyticsSchema,
} from "../src/server/api/analytics.ts";
import { ensureBillingSchema } from "../src/server/api/billingSchema.ts";
import { ensureLearningEvents } from "../src/server/api/learningEventsSchema.ts";
import { ENERGY_CAP, ensureEnergyTables } from "../src/server/api/activities/start.ts";
import { randomUUID } from "node:crypto";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
const flags = ["manageContent", "manageUsers", "viewAnalytics", "manageSettings"] as const;
const configuredEnergyRefill = Number(process.env.LINGUAPLAY_ENERGY_REFILL_MINUTES ?? 30);
const ENERGY_REFILL_MINUTES = Number.isInteger(configuredEnergyRefill)
  ? Math.max(1, Math.min(1440, configuredEnergyRefill))
  : 30;
type Permission = (typeof flags)[number];
const defaults = (role: string): Record<Permission, boolean> => ({
  manageContent: ["owner", "admin"].includes(role),
  manageUsers: role === "owner",
  viewAnalytics: role === "owner",
  manageSettings: role === "owner",
});
const text = (value: unknown, max = 300) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";
const isoOrNull = (value: unknown) => {
  if (value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

async function actorFor(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) return null;
  await ensureInitialAppRole(session.user.id);
  const result = await pool.query(
    "SELECT role, permissions FROM linguaplay_user_roles WHERE user_id=$1",
    [session.user.id],
  );
  const row = result.rows[0];
  const role = row?.role ?? "student";
  const rawPerms = parseJson(row?.permissions);
  const permissions = { ...defaults(role), ...rawPerms } as Record<Permission, boolean>;
  permissions.manageContent = ["owner", "admin"].includes(role);
  permissions.manageUsers = role === "owner" || (role === "admin" && Boolean(rawPerms.manageUsers));
  permissions.manageSettings = role === "owner";
  permissions.viewAnalytics =
    role === "owner" || (role === "admin" && Boolean(rawPerms.viewAnalytics));
  return { user: session.user, role, permissions };
}

async function ownerFor(request: Request) {
  const actor = await actorFor(request);
  if (!actor) return { response: json({ error: "Войдите в аккаунт владельца." }, 401) } as const;
  if (actor.role !== "owner")
    return {
      response: json({ error: "Эта страница доступна только владельцу сайта." }, 403),
    } as const;
  return { actor } as const;
}

async function userAdminFor(request: Request) {
  const actor = await actorFor(request);
  if (!actor) return { response: json({ error: "Войдите в аккаунт." }, 401) } as const;
  if (actor.role === "owner" || (actor.role === "admin" && actor.permissions.manageUsers)) {
    return { actor } as const;
  }
  return {
    response: json(
      {
        error:
          "Недостаточно прав. Требуется роль владельца или администратора с правом управления пользователями.",
      },
      403,
    ),
  } as const;
}

function parseJson(value: unknown): Record<string, any> {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" ? (value as Record<string, any>) : {};
}
function asNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}
function profileSummary(raw: unknown, serverEnergy: unknown) {
  const data = parseJson(raw);
  const statSpaces = parseJson(data["linguaplay-stats-by-space"]);
  const progressSpaces = parseJson(data["linguaplay-progress-by-space"]);
  const statRows = Object.values(statSpaces).map((value) => parseJson(value));
  const cards = Object.values(progressSpaces).flatMap((value) =>
    Object.values(parseJson(value)).map((entry) => parseJson(entry)),
  );
  return {
    xp: statRows.reduce((sum, item) => sum + asNumber(item.xp), 0),
    crystals: statRows.reduce((sum, item) => sum + asNumber(item.crystals), 0),
    energy: Math.max(
      0,
      Math.min(
        ENERGY_CAP,
        Number.isFinite(Number(serverEnergy)) ? Number(serverEnergy) : ENERGY_CAP,
      ),
    ),
    answers: statRows.reduce((sum, item) => sum + asNumber(item.answers), 0),
    correct: statRows.reduce((sum, item) => sum + asNumber(item.correct), 0),
    learned_words: cards.filter((item) => asNumber(item.level) >= 2).length,
    last_local_study_day:
      statRows
        .map((item) => (typeof item.lastStudyDay === "string" ? item.lastStudyDay : ""))
        .sort()
        .at(-1) || null,
  };
}

export async function POST(request: Request) {
  let body: Record<string, any>;
  try {
    body = (await request.json()) as Record<string, any>;
  } catch {
    return json({ error: "Invalid JSON payload." }, 400);
  }

  if (body.action === "save-menu-settings") {
    const gate = await userAdminFor(request);
    if ("response" in gate) return gate.response;
    await pool.query(
      `CREATE TABLE IF NOT EXISTS clickling_site_settings(key text PRIMARY KEY, value jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`,
    );
    await pool.query(
      `INSERT INTO clickling_site_settings(key, value, updated_at) VALUES('menu_visibility', $1::jsonb, now())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [JSON.stringify(body.settings)],
    );
    return json({ saved: true });
  }

  if (body.action === "create-user") {
    const gate = await userAdminFor(request);
    if ("response" in gate) return gate.response;

    const name = text(body.name, 80);
    let email = text(body.email, 254).toLowerCase();
    const password = typeof body.password === "string" ? body.password : "";
    const role = text(body.role, 20) || "student";
    const isOwner = gate.actor.role === "owner";

    if (name.length < 2) return json({ error: "Имя должно содержать не менее 2 символов." }, 400);

    const hasAt = email.includes("@");
    if (!hasAt) {
      if (!isOwner) {
        return json(
          { error: "Только владелец сайта может создавать пользователей с логином без @." },
          403,
        );
      }
      if (!/^[a-zA-Z0-9._-]{2,50}$/.test(email)) {
        return json(
          {
            error:
              "Логин без @ должен состоять из латинских букв, цифр, точек или дефисов (от 2 до 50 символов).",
          },
          400,
        );
      }
      email = `${email}@clickling.local`;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: "Укажите корректный email (логин)." }, 400);
    }
    if (password.length < 8 || password.length > 128)
      return json({ error: "Пароль должен содержать от 8 до 128 символов." }, 400);
    if (!["admin", "student"].includes(role))
      return json({ error: "Выберите роль: ученик или администратор." }, 400);

    const canGrantUserManagement = gate.actor.role === "owner";
    const suppliedPerms = parseJson(body.permissions);
    const permissions: Record<Permission, boolean> = {
      manageContent: role === "admin" ? Boolean(suppliedPerms.manageContent ?? true) : false,
      manageUsers:
        role === "admin" && canGrantUserManagement ? Boolean(suppliedPerms.manageUsers) : false,
      viewAnalytics: role === "admin" ? Boolean(suppliedPerms.viewAnalytics) : false,
      manageSettings: false,
    };
    const allowedSections = ["today", "library", "catalog", "path", "materials", "games", "stats"];
    const hiddenSections = Array.isArray(suppliedPerms.hiddenSections)
      ? suppliedPerms.hiddenSections
          .filter((item): item is string => typeof item === "string")
          .filter((item) => allowedSections.includes(item))
      : [];
    Object.assign(permissions, { hiddenSections });

    const existing = await pool.query('SELECT id FROM "user" WHERE lower(email)=$1', [email]);
    if (existing.rowCount && existing.rowCount > 0)
      return json({ error: "Пользователь с таким email уже зарегистрирован." }, 409);

    const newUserId = randomUUID();
    const accountId = randomUUID();
    const hashedPassword = await hashPassword(password);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO "user" (id, name, email, "emailVerified", role, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, true, $4, now(), now())`,
        [newUserId, name, email, role === "admin" ? "admin" : "user"],
      );
      await client.query(
        `INSERT INTO "account" (id, "userId", "accountId", "providerId", password, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, 'credential', $4, now(), now())`,
        [accountId, newUserId, newUserId, hashedPassword],
      );
      await client.query(
        `INSERT INTO linguaplay_user_roles (user_id, role, permissions, updated_at)
         VALUES ($1, $2, $3::jsonb, now())
         ON CONFLICT (user_id) DO UPDATE SET role=EXCLUDED.role, permissions=EXCLUDED.permissions, updated_at=now()`,
        [newUserId, role, JSON.stringify(permissions)],
      );
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }

    await audit(gate.actor.user.id, newUserId, "create-user", { name, email, role, permissions });
    return json({
      created: true,
      user: { id: newUserId, name, email, role, permissions },
    });
  }

  const gate = await ownerFor(request);
  if ("response" in gate) return gate.response;
  if (body.action !== "deploy-github-production")
    return json({ error: "Неизвестное действие." }, 400);

  const hookUrl = process.env.VERCEL_DEPLOY_HOOK_URL;
  if (!hookUrl)
    return json(
      {
        error:
          "Deploy Hook не настроен. Создайте Production Deploy Hook в Vercel и добавьте его URL в VERCEL_DEPLOY_HOOK_URL.",
      },
      503,
    );
  let parsed: URL;
  try {
    parsed = new URL(hookUrl);
  } catch {
    return json({ error: "VERCEL_DEPLOY_HOOK_URL имеет неверный формат." }, 503);
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.hostname !== "api.vercel.com" ||
    !parsed.pathname.startsWith("/v1/integrations/deploy/")
  )
    return json({ error: "Разрешены только HTTPS Deploy Hook адреса Vercel." }, 503);
  try {
    const response = await fetch(parsed, { method: "POST", signal: AbortSignal.timeout(15_000) });
    if (!response.ok)
      return json(
        {
          error: `Vercel отклонил запуск деплоя (HTTP ${response.status}). Проверьте Deploy Hook в настройках проекта.`,
        },
        502,
      );
    return json({
      triggered: true,
      source: "github",
      message: "Production-деплой запущен из подключённой GitHub-ветки.",
    });
  } catch {
    return json({ error: "Не удалось связаться с Vercel. Попробуйте ещё раз." }, 502);
  }
}

export async function GET(request: Request) {
  try {
    return await getAdminData(request);
  } catch (error) {
    console.error("Admin API GET failed", error);
    return json({ error: "Не удалось загрузить данные панели администратора." }, 500);
  }
}

async function getAdminData(request: Request) {
  const gate = await userAdminFor(request);
  if ("response" in gate) return gate.response;
  if (new URL(request.url).searchParams.get("view") === "analytics") return getAnalytics();
  await ensureEngagementSchema();
  await ensureAnalyticsSchema();
  await ensureEnergyTables();
  await ensureBillingSchema();

  const [users, events, active, subscriptions] = await Promise.all([
    pool.query(`SELECT u.id,u.name,u.email,u."emailVerified" AS email_verified,u.image,u.role AS auth_role,u."createdAt" AS created_at,
      u.banned,u."banReason" AS ban_reason,u."banExpires" AS ban_expires,r.role,r.permissions,
      COALESCE(e.event_count,0) AS event_count,COALESCE(e.errors,0) AS errors,
      GREATEST(e.last_activity,a.last_activity) AS last_activity,s.last_login,GREATEST(e.last_activity,s.last_login,a.last_activity) AS last_seen,
      ent.status AS pro_status,ent.starts_at AS pro_starts_at,ent.ends_at AS pro_ends_at,d.data AS profile_data,COALESCE(en.energy,22) AS server_energy,cw.balance AS crystal_balance
      FROM "user" u LEFT JOIN linguaplay_user_roles r ON r.user_id=u.id
      LEFT JOIN LATERAL (SELECT COUNT(*)::int AS event_count,COUNT(*) FILTER (WHERE is_correct=false)::int AS errors,MAX(created_at) AS last_activity FROM linguaplay_events WHERE user_id=u.id) e ON true
      LEFT JOIN LATERAL (SELECT MAX(created_at) AS last_activity FROM linguaplay_analytics_events WHERE user_id=u.id) a ON true
      LEFT JOIN LATERAL (SELECT MAX("updatedAt") AS last_login FROM "session" WHERE "userId"=u.id) s ON true
      LEFT JOIN LATERAL (
        SELECT status,starts_at,ends_at FROM (
          SELECT status,starts_at,ends_at FROM linguaplay_user_entitlements WHERE user_id=u.id
          UNION ALL SELECT status,starts_at,ends_at FROM linguaplay_entitlements WHERE account_id=u.id AND feature='pro'
        ) entitlement_rows
        ORDER BY CASE WHEN status='active' AND (starts_at IS NULL OR starts_at<=now()) AND ends_at>now() THEN 0 ELSE 1 END,
          ends_at DESC NULLS LAST LIMIT 1
      ) ent ON true LEFT JOIN linguaplay_user_data d ON d.user_id=u.id
      LEFT JOIN linguaplay_energy_accounts en ON en.user_id=u.id
      LEFT JOIN clickling_ai_wallet cw ON cw.user_id=u.id
      ORDER BY u."createdAt" DESC`),
    pool.query(`SELECT e.id,e.user_id,u.name,e.event_type,e.module_title,e.activity,e.round_index,e.round_total,e.is_correct,e.payload-'prompt'-'selectedAnswer'-'correctAnswer'-'answer'-'text' AS payload,e.created_at
      FROM linguaplay_events e JOIN "user" u ON u.id=e.user_id ORDER BY e.created_at DESC LIMIT 200`),
    pool.query(
      `SELECT s.user_id,u.name,s.activity_title,s.module_title,s.current_index,s.total,s.updated_at FROM linguaplay_active_sessions s JOIN "user" u ON u.id=s.user_id ORDER BY s.updated_at DESC`,
    ),
    pool.query(
      `SELECT s.id::text,s.account_id,u.name,u.email,p.name AS plan_name,s.status,p.amount_minor,p.currency,
              s.period_start,s.period_end,s.cancel_at_period_end,s.provider
       FROM linguaplay_subscriptions s
       JOIN "user" u ON u.id=s.account_id
       JOIN linguaplay_plans p ON p.code=s.plan_code
       ORDER BY s.period_start DESC LIMIT 300`,
    ),
  ]);
  const now = Date.now();
  return json({
    users: users.rows.map((row) => {
      const proStartsAt = row.pro_starts_at ? new Date(row.pro_starts_at).toISOString() : null;
      const proEndsAt = row.pro_ends_at ? new Date(row.pro_ends_at).toISOString() : null;
      const summary = profileSummary(row.profile_data, row.server_energy);
      const lastSeen = row.last_seen;
      return {
        ...row,
        profile_data: undefined,
        role: row.role ?? "student",
        permissions: row.permissions ?? {},
        ...summary,
        crystals: Number(row.crystal_balance ?? summary.crystals),
        energy_cap: ENERGY_CAP,
        is_pro:
          row.pro_status === "active" &&
          (!proStartsAt || new Date(proStartsAt).getTime() <= now) &&
          Boolean(proEndsAt) &&
          typeof proEndsAt === "string" &&
          new Date(proEndsAt).getTime() > now,
        last_seen: lastSeen ? new Date(lastSeen).toISOString() : null,
        dormant_days: lastSeen
          ? Math.floor((now - new Date(lastSeen).getTime()) / 86_400_000)
          : null,
      };
    }),
    events: events.rows,
    active: active.rows,
    subscriptions: subscriptions.rows,
    actor: { id: gate.actor.user.id, role: gate.actor.role },
    menuSettings: await (async () => {
      try {
        await pool.query(
          `CREATE TABLE IF NOT EXISTS clickling_site_settings(key text PRIMARY KEY, value jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`,
        );
        const r = await pool.query(
          "SELECT value FROM clickling_site_settings WHERE key='menu_visibility'",
        );
        return r.rows[0]?.value ?? null;
      } catch {
        return null;
      }
    })(),
  });
}

async function getAnalytics() {
  await ensureEngagementSchema();
  await ensureAnalyticsSchema();
  await ensureBillingSchema();
  await ensureLearningEvents();
  await captureDailyAnalyticsSnapshot();
  const [
    daily,
    users,
    actions,
    pages,
    recent,
    actors,
    devices,
    locations,
    retention,
    commerce,
    snapshots,
    learning,
  ] = await Promise.all([
    pool.query(`WITH activity AS NOT MATERIALIZED (
        SELECT date_trunc('day',created_at AT TIME ZONE 'UTC') AS day,'u:'||user_id AS identity FROM linguaplay_events WHERE created_at>=now()-interval '30 days'
        UNION ALL SELECT date_trunc('day',created_at AT TIME ZONE 'UTC'),COALESCE('u:'||user_id,'v:'||visitor_id) FROM linguaplay_analytics_events WHERE created_at>=now()-interval '30 days'
      ), active_daily AS (SELECT day,COUNT(DISTINCT identity)::int AS active_users FROM activity GROUP BY day), signups AS (
        SELECT date_trunc('day',"createdAt" AT TIME ZONE 'UTC') AS day,COUNT(*)::int AS signups FROM "user" WHERE "createdAt">=now()-interval '30 days' GROUP BY 1
      ) SELECT COALESCE(s.day,a.day)::date AS day,COALESCE(s.signups,0)::int AS signups,COALESCE(a.active_users,0)::int AS active_users
        FROM signups s FULL OUTER JOIN active_daily a ON a.day=s.day ORDER BY day`),
    pool.query(`WITH activity AS NOT MATERIALIZED (
        SELECT user_id,NULL::text AS visitor_id,created_at FROM linguaplay_events
        UNION ALL SELECT user_id,visitor_id,created_at FROM linguaplay_analytics_events
      ), previous_active AS (
        SELECT DISTINCT user_id FROM activity WHERE user_id IS NOT NULL AND created_at>=now()-interval '60 days' AND created_at<now()-interval '30 days'
      ), current_active AS (
        SELECT DISTINCT user_id FROM activity WHERE user_id IS NOT NULL AND created_at>=now()-interval '30 days'
      ), previous_guests AS (
        SELECT DISTINCT visitor_id FROM linguaplay_analytics_events WHERE visitor_id IS NOT NULL AND created_at>=now()-interval '60 days' AND created_at<now()-interval '30 days'
      ), current_guests AS (
        SELECT DISTINCT visitor_id FROM linguaplay_analytics_events WHERE visitor_id IS NOT NULL AND created_at>=now()-interval '30 days'
      ), seen AS (
        SELECT u.id,u.name,u.email,u."createdAt" AS created_at,GREATEST(s.last_seen,e.last_seen,a.last_seen) AS last_seen
        FROM "user" u
        LEFT JOIN LATERAL (SELECT MAX("updatedAt") AS last_seen FROM "session" WHERE "userId"=u.id) s ON true
        LEFT JOIN LATERAL (SELECT MAX(created_at) AS last_seen FROM linguaplay_events WHERE user_id=u.id) e ON true
        LEFT JOIN LATERAL (SELECT MAX(created_at) AS last_seen FROM linguaplay_analytics_events WHERE user_id=u.id) a ON true
      )
      SELECT COUNT(*) FILTER (WHERE created_at>=now()-interval '7 days')::int AS new_users_7d,
      COUNT(*) FILTER (WHERE last_seen<now()-interval '14 days' OR (last_seen IS NULL AND created_at<now()-interval '14 days'))::int AS dormant_users,
      COUNT(*) FILTER (WHERE last_seen>=now()-interval '7 days')::int AS active_users_7d,
      (SELECT COUNT(*)::int FROM "user") AS total_users,
      (SELECT COUNT(DISTINCT COALESCE('u:'||user_id,'v:'||visitor_id))::int FROM activity WHERE created_at>=(date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')) AS dau,
      (SELECT COUNT(DISTINCT COALESCE('u:'||user_id,'v:'||visitor_id))::int FROM activity WHERE created_at>=now()-interval '7 days') AS wau,
      (SELECT COUNT(DISTINCT COALESCE('u:'||user_id,'v:'||visitor_id))::int FROM activity WHERE created_at>=now()-interval '30 days') AS mau,
      (SELECT COUNT(DISTINCT visitor_id)::int FROM linguaplay_analytics_events WHERE visitor_id IS NOT NULL AND created_at>=now()-interval '30 days') AS guests_30d,
      (SELECT COUNT(*)::int FROM previous_active) AS active_users_previous_30d,
      (SELECT COUNT(*)::int FROM current_active c JOIN previous_active p USING(user_id)) AS retained_users_30d,
      (SELECT COUNT(*)::int FROM previous_active p WHERE NOT EXISTS(SELECT 1 FROM current_active c WHERE c.user_id=p.user_id)) AS churned_users_30d,
      COALESCE(ROUND(100.0*(SELECT COUNT(*) FROM previous_active p WHERE NOT EXISTS(SELECT 1 FROM current_active c WHERE c.user_id=p.user_id))/NULLIF((SELECT COUNT(*) FROM previous_active),0),1),0)::float AS user_churn_rate_30d,
      (SELECT COUNT(*)::int FROM previous_guests p WHERE EXISTS(SELECT 1 FROM current_guests c WHERE c.visitor_id=p.visitor_id)) AS returning_guests_30d,
      (SELECT COUNT(*)::int FROM previous_guests p WHERE NOT EXISTS(SELECT 1 FROM current_guests c WHERE c.visitor_id=p.visitor_id)) AS churned_guests_30d,
      COALESCE(ROUND(100.0*(SELECT COUNT(*) FROM previous_guests p WHERE NOT EXISTS(SELECT 1 FROM current_guests c WHERE c.visitor_id=p.visitor_id))/NULLIF((SELECT COUNT(*) FROM previous_guests),0),1),0)::float AS guest_churn_rate_30d,
      COALESCE((SELECT ROUND(100.0*COUNT(DISTINCT COALESCE('u:'||user_id,'v:'||visitor_id)) FILTER (WHERE created_at>=(date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'))/NULLIF(COUNT(DISTINCT COALESCE('u:'||user_id,'v:'||visitor_id)) FILTER (WHERE created_at>=now()-interval '30 days'),0),1)::float FROM activity),0) AS stickiness,
      (SELECT COUNT(*)::int FROM clickling_feedback) AS feedback_count,
      (SELECT ROUND(AVG(rating)::numeric,1)::float FROM clickling_feedback) AS feedback_average
      FROM seen`),
    pool.query(`WITH actions AS (
        SELECT payload->>'action' AS action,payload->>'route' AS route FROM linguaplay_events WHERE event_type='target-action' AND created_at>=now()-interval '30 days'
        UNION ALL SELECT action,route FROM linguaplay_analytics_events WHERE event_type='target-action' AND created_at>=now()-interval '30 days'
      ) SELECT action,route,COUNT(*)::int AS clicks FROM actions GROUP BY 1,2 ORDER BY clicks DESC LIMIT 20`),
    pool.query(`WITH page_views AS (
        SELECT payload->>'route' AS route,'u:'||user_id AS identity FROM linguaplay_events WHERE event_type='page-view' AND created_at>=now()-interval '30 days'
        UNION ALL SELECT route,COALESCE('u:'||user_id,'v:'||visitor_id) FROM linguaplay_analytics_events WHERE event_type='page-view' AND created_at>=now()-interval '30 days'
      ) SELECT route,COUNT(*)::int AS views,COUNT(DISTINCT identity)::int AS users FROM page_views WHERE route IS NOT NULL GROUP BY route ORDER BY views DESC`),
    pool.query(`WITH recent AS (
        SELECT e.id,u.name,u.email,e.payload->>'route' AS route,e.payload->>'action' AS action,e.created_at,e.user_id,NULL::text AS country,NULL::text AS region,NULL::text AS device_type
          FROM linguaplay_events e JOIN "user" u ON u.id=e.user_id WHERE e.event_type='target-action'
        UNION ALL SELECT a.id,COALESCE(u.name,'Гость · '||left(a.visitor_id,10)),u.email,a.route,a.action,a.created_at,a.user_id,a.country,a.region,a.device_type
          FROM linguaplay_analytics_events a LEFT JOIN "user" u ON u.id=a.user_id WHERE a.event_type='target-action'
      ) SELECT id,name,email,route,action,created_at,country,region,device_type FROM recent ORDER BY created_at DESC LIMIT 100`),
    pool.query(`SELECT a.id,a.user_id,u.name,u.email,a.visitor_id,a.event_type,a.route,a.action,a.activity,a.country,a.region,a.ip_hash,
        a.device_type,a.browser,a.os,a.locale,a.referrer_host,a.payload,a.created_at,
        CASE WHEN a.user_id IS NOT NULL THEN COALESCE(u.name,'Пользователь') ELSE 'Гость' END AS author
      FROM linguaplay_analytics_events a LEFT JOIN "user" u ON u.id=a.user_id
      ORDER BY a.created_at DESC LIMIT 100`),
    pool.query(`SELECT device_type,browser,os,COUNT(*)::int AS events,
        COUNT(DISTINCT COALESCE('u:'||user_id,'v:'||visitor_id))::int AS people
      FROM linguaplay_analytics_events WHERE created_at>=now()-interval '30 days'
      GROUP BY device_type,browser,os ORDER BY people DESC,events DESC LIMIT 20`),
    pool.query(`SELECT country,region,COUNT(*)::int AS events,
        COUNT(DISTINCT COALESCE('u:'||user_id,'v:'||visitor_id))::int AS people
      FROM linguaplay_analytics_events WHERE created_at>=now()-interval '30 days'
      GROUP BY country,region ORDER BY people DESC,events DESC LIMIT 20`),
    pool.query(`WITH cohorts AS (
        SELECT id,"createdAt" AS signup_at,date_trunc('week',"createdAt" AT TIME ZONE 'UTC')::date AS cohort_week
        FROM "user" WHERE "createdAt">=(SELECT tracking_started_at FROM linguaplay_analytics_settings WHERE id=1)
      ), activity AS NOT MATERIALIZED (
        SELECT user_id,created_at FROM linguaplay_events
        UNION ALL SELECT user_id,created_at FROM linguaplay_analytics_events WHERE user_id IS NOT NULL
      ) SELECT c.cohort_week,COUNT(DISTINCT c.id)::int AS cohort_size,
        COUNT(DISTINCT c.id) FILTER (WHERE c.signup_at+interval '7 days'<=now())::int AS activation_eligible,
        COUNT(DISTINCT c.id) FILTER (WHERE c.signup_at+interval '7 days'<=now() AND EXISTS(SELECT 1 FROM activity a WHERE a.user_id=c.id AND a.created_at>=c.signup_at AND a.created_at<c.signup_at+interval '7 days'))::int AS activated_7d,
        COUNT(DISTINCT c.id) FILTER (WHERE c.signup_at+interval '2 days'<=now())::int AS d1_eligible,
        COUNT(DISTINCT c.id) FILTER (WHERE c.signup_at+interval '2 days'<=now() AND EXISTS(SELECT 1 FROM activity a WHERE a.user_id=c.id AND a.created_at>=c.signup_at+interval '1 day' AND a.created_at<c.signup_at+interval '2 days'))::int AS d1_retained,
        COUNT(DISTINCT c.id) FILTER (WHERE c.signup_at+interval '8 days'<=now())::int AS d7_eligible,
        COUNT(DISTINCT c.id) FILTER (WHERE c.signup_at+interval '8 days'<=now() AND EXISTS(SELECT 1 FROM activity a WHERE a.user_id=c.id AND a.created_at>=c.signup_at+interval '7 days' AND a.created_at<c.signup_at+interval '8 days'))::int AS d7_retained,
        COUNT(DISTINCT c.id) FILTER (WHERE c.signup_at+interval '31 days'<=now())::int AS d30_eligible,
        COUNT(DISTINCT c.id) FILTER (WHERE c.signup_at+interval '31 days'<=now() AND EXISTS(SELECT 1 FROM activity a WHERE a.user_id=c.id AND a.created_at>=c.signup_at+interval '30 days' AND a.created_at<c.signup_at+interval '31 days'))::int AS d30_retained
      FROM cohorts c GROUP BY c.cohort_week ORDER BY c.cohort_week DESC`),
    pool.query(`WITH paid AS (
        SELECT currency,SUM(amount_minor)::bigint AS gross_minor,
          (SUM(amount_minor) FILTER (WHERE created_at>=now()-interval '30 days'))::bigint AS gross_30d_minor,
          COUNT(*)::int AS successful_payments,COUNT(DISTINCT account_id)::int AS paying_customers,
          ROUND(SUM(amount_minor)::numeric/NULLIF(COUNT(DISTINCT account_id),0),2)::numeric AS ltv_minor
        FROM linguaplay_payments
        WHERE lower(status) IN ('paid','succeeded','complete','completed','captured','settled')
        GROUP BY currency
      ), subs AS (
        SELECT COUNT(*) FILTER (WHERE lower(s.status) IN ('active','trialing') AND s.period_end>now())::int AS active_subscriptions,
          COUNT(*) FILTER (WHERE lower(s.status) IN ('canceled','cancelled','expired') AND s.updated_at>=now()-interval '30 days')::int AS cancellations_30d,
          COUNT(*) FILTER (WHERE lower(s.status) IN ('past_due','unpaid'))::int AS past_due_subscriptions
        FROM linguaplay_subscriptions s JOIN linguaplay_plans p ON p.code=s.plan_code
      ), mrr AS (
        SELECT p.currency,SUM(CASE p.interval WHEN 'month' THEN p.amount_minor::numeric WHEN 'year' THEN p.amount_minor::numeric/12 ELSE 0 END)::numeric AS mrr_minor
        FROM linguaplay_subscriptions s JOIN linguaplay_plans p ON p.code=s.plan_code
        WHERE lower(s.status) IN ('active','trialing') AND s.period_end>now() GROUP BY p.currency
      ) SELECT COALESCE((SELECT jsonb_agg(to_jsonb(paid) ORDER BY currency) FROM paid),'[]'::jsonb) AS by_currency,
          COALESCE((SELECT jsonb_agg(jsonb_build_object('currency',currency,'mrr_minor',mrr_minor) ORDER BY currency) FROM mrr),'[]'::jsonb) AS mrr_by_currency,
          subs.active_subscriptions,subs.cancellations_30d,subs.past_due_subscriptions,
          (SELECT COUNT(DISTINCT account_id)::int FROM linguaplay_payments WHERE lower(status) IN ('paid','succeeded','complete','completed','captured','settled')) AS paying_accounts,
          (SELECT COUNT(*)::int FROM linguaplay_payments WHERE lower(status) IN ('failed','declined','canceled','cancelled') AND created_at>=now()-interval '30 days') AS failed_payments_30d,
          (SELECT COUNT(*)::int FROM "user") AS total_accounts
        FROM subs`),
    pool.query(
      `SELECT snapshot_day,metrics FROM linguaplay_analytics_daily_snapshots ORDER BY snapshot_day DESC LIMIT 3650`,
    ),
    pool.query(`SELECT language_code,level,skill,variant_id,COUNT(*) FILTER (WHERE NOT skipped)::int AS answers,
        COUNT(DISTINCT session_id)::int AS sessions,
        COUNT(*) FILTER (WHERE first_try_correct=true)::int AS first_try_correct,
        ROUND(AVG(attempt_count) FILTER (WHERE NOT skipped)::numeric,2)::float AS average_attempts,
        COUNT(*) FILTER (WHERE hint_used)::int AS hints_used,
        COUNT(*) FILTER (WHERE skipped)::int AS skipped,
        ROUND(AVG(duration_ms) FILTER (WHERE duration_ms IS NOT NULL AND NOT skipped)::numeric)::int AS average_duration_ms
      FROM linguaplay_learning_events WHERE created_at>=now()-interval '30 days'
      GROUP BY language_code,level,skill,variant_id HAVING COUNT(*) FILTER (WHERE NOT skipped)>=5
      ORDER BY sessions DESC,answers DESC LIMIT 40`),
  ]);
  const dormant = await pool.query(`WITH seen AS (
      SELECT u.id,u.name,u.email,u."createdAt" AS created_at,GREATEST(s.last_seen,e.last_seen,a.last_seen) AS last_seen
      FROM "user" u
      LEFT JOIN LATERAL (SELECT MAX("updatedAt") AS last_seen FROM "session" WHERE "userId"=u.id) s ON true
      LEFT JOIN LATERAL (SELECT MAX(created_at) AS last_seen FROM linguaplay_events WHERE user_id=u.id) e ON true
      LEFT JOIN LATERAL (SELECT MAX(created_at) AS last_seen FROM linguaplay_analytics_events WHERE user_id=u.id) a ON true
    ) SELECT id,name,email,created_at,last_seen FROM seen
      WHERE last_seen<now()-interval '14 days' OR (last_seen IS NULL AND created_at<now()-interval '14 days')
      ORDER BY last_seen ASC NULLS FIRST LIMIT 100`);
  const feedback =
    await pool.query(`SELECT f.id,f.rating,f.choice,f.text,f.created_at,f.country,f.region,f.ip_hash,f.metadata,f.visitor_id,
      u.id AS user_id,u.name,u.email,
      CASE WHEN f.user_id IS NOT NULL THEN COALESCE(u.name,'Пользователь') ELSE 'Гость · '||left(f.visitor_id,10) END AS author
      FROM clickling_feedback f LEFT JOIN "user" u ON u.id=f.user_id ORDER BY f.created_at DESC LIMIT 200`);
  return json({
    daily: daily.rows,
    summary: users.rows[0],
    actions: actions.rows,
    pages: pages.rows,
    recent: recent.rows,
    actors: actors.rows,
    devices: devices.rows,
    locations: locations.rows,
    retention: retention.rows,
    commerce: commerce.rows[0],
    snapshots: snapshots.rows,
    learning: learning.rows,
    dormant: dormant.rows,
    feedback: feedback.rows,
  });
}

export async function PATCH(request: Request) {
  const gate = await userAdminFor(request);
  if ("response" in gate) return gate.response;
  let body: Record<string, any>;
  try {
    body = (await request.json()) as Record<string, any>;
  } catch {
    return json({ error: "Invalid JSON payload." }, 400);
  }
  const action = text(body.action, 40);
  const userId = text(body.userId, 120);
  if (!userId) return json({ error: "Выберите пользователя." }, 400);
  const target = await pool.query(
    `SELECT u.id,r.role FROM "user" u LEFT JOIN linguaplay_user_roles r ON r.user_id=u.id WHERE u.id=$1`,
    [userId],
  );
  if (!target.rowCount) return json({ error: "Пользователь не найден." }, 404);
  if (
    target.rows[0].role === "owner" &&
    !(action === "set-energy" && userId === gate.actor.user.id)
  )
    return json({ error: "Настройки владельца защищены." }, 403);
  const details: Record<string, unknown> = {};

  if (action === "set-pro") {
    const enabled = Boolean(body.enabled);
    const startsAtInput = isoOrNull(body.startsAt);
    const endsAt = isoOrNull(body.endsAt);
    const reason = text(body.reason, 300);
    if (
      startsAtInput === undefined ||
      endsAt === undefined ||
      !reason ||
      (enabled && !endsAt) ||
      (startsAtInput && endsAt && new Date(endsAt) <= new Date(startsAtInput))
    ) {
      return json(
        {
          error: enabled
            ? "Для ручного PRO-гранта укажите причину и дату окончания."
            : "Для отзыва PRO укажите причину и проверьте даты.",
        },
        400,
      );
    }
    const startsAt = enabled ? (startsAtInput ?? new Date().toISOString()) : startsAtInput;
    const oldGrant = await pool.query(
      "SELECT status,starts_at,ends_at FROM linguaplay_user_entitlements WHERE user_id=$1",
      [userId],
    );
    await pool.query(
      `INSERT INTO linguaplay_user_entitlements(user_id,status,starts_at,ends_at,updated_by,updated_at) VALUES($1,$2,$3,$4,$5,now())
      ON CONFLICT(user_id) DO UPDATE SET status=EXCLUDED.status,starts_at=EXCLUDED.starts_at,ends_at=EXCLUDED.ends_at,updated_by=EXCLUDED.updated_by,updated_at=now()`,
      [userId, enabled ? "active" : "inactive", startsAt, endsAt, gate.actor.user.id],
    );
    if (enabled && startsAt && endsAt) {
      await pool.query(
        `INSERT INTO linguaplay_entitlements(account_id,source,feature,starts_at,ends_at,status,updated_by,reason)
        VALUES($1,'manual_grant','pro',$2,$3,'active',$4,$5)`,
        [userId, startsAt, endsAt, gate.actor.user.id, reason],
      );
    } else {
      await pool.query(
        "UPDATE linguaplay_entitlements SET status='revoked',updated_by=$2,reason=$3 WHERE account_id=$1 AND feature='pro' AND source='manual_grant' AND status='active'",
        [userId, gate.actor.user.id, reason],
      );
    }
    await pool.query(
      `INSERT INTO linguaplay_billing_audit(actor_id,target_id,action,old_value,new_value,reason)
      VALUES($1,$2,$3,$4::jsonb,$5::jsonb,$6)`,
      [
        gate.actor.user.id,
        userId,
        enabled ? "manual-pro-grant" : "manual-pro-revoke",
        JSON.stringify(oldGrant.rows[0] ?? {}),
        JSON.stringify({ status: enabled ? "active" : "inactive", startsAt, endsAt }),
        reason,
      ],
    );
    Object.assign(details, { enabled, startsAt, endsAt, reason });
  } else if (action === "ban" || action === "unban") {
    const authApi = auth.api as any;
    if (action === "ban") {
      const reason = text(body.reason, 300) || "Нарушение правил";
      await authApi.banUser({ body: { userId, banReason: reason }, headers: request.headers });
      details.reason = reason;
    } else await authApi.unbanUser({ body: { userId }, headers: request.headers });
  } else if (action === "update-account") {
    const name = text(body.name, 80);
    let email = text(body.email, 254).toLowerCase();
    const isOwner = gate.actor.role === "owner";

    if (name.length < 2) return json({ error: "Имя должно содержать не менее 2 символов." }, 400);

    const hasAt = email.includes("@");
    if (!hasAt) {
      if (!isOwner) {
        return json({ error: "Только владелец сайта может задавать логин без @." }, 403);
      }
      if (!/^[a-zA-Z0-9._-]{2,50}$/.test(email)) {
        return json(
          {
            error:
              "Логин без @ должен состоять из латинских букв, цифр, точек или дефисов (от 2 до 50 символов).",
          },
          400,
        );
      }
      email = `${email}@clickling.local`;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: "Укажите корректный адрес почты (логин)." }, 400);
    }
    const emailTaken = await pool.query('SELECT id FROM "user" WHERE lower(email)=$1 AND id<>$2', [
      email,
      userId,
    ]);
    if (emailTaken.rowCount && emailTaken.rowCount > 0)
      return json({ error: "Этот email (логин) уже занят другим аккаунтом." }, 400);
    try {
      const authApi = auth.api as any;
      await authApi.adminUpdateUser({
        body: { userId, data: { name, email } },
        headers: request.headers,
      });
    } catch {}
    await pool.query(
      'UPDATE "user" SET name=$2, email=$3, "emailVerified"=true, "updatedAt"=now() WHERE id=$1',
      [userId, name, email],
    );
    Object.assign(details, { name, email });
  } else if (action === "set-password") {
    const password = typeof body.password === "string" ? body.password : "";
    if (password.length < 8 || password.length > 128)
      return json({ error: "Пароль должен содержать от 8 до 128 символов." }, 400);
    let updated = false;
    try {
      const authApi = auth.api as any;
      await authApi.setUserPassword({
        body: { userId, newPassword: password },
        headers: request.headers,
      });
      updated = true;
    } catch {}
    if (!updated) {
      const hashedPassword = await hashPassword(password);
      await pool.query(
        `UPDATE "account" SET password=$2, "updatedAt"=now() WHERE "userId"=$1 AND "providerId"='credential'`,
        [userId, hashedPassword],
      );
    }
    details.changed = true;
  } else if (action === "set-progress" || action === "set-crystals") {
    const xp = Number(body.xp);
    const crystals = Number(body.crystals);
    if (action === "set-progress" && (!Number.isInteger(xp) || xp < 0 || xp > 10_000_000))
      return json({ error: "XP должны быть целым числом от 0 до 10 000 000." }, 400);
    if (
      action === "set-crystals" &&
      (!Number.isInteger(crystals) || crystals < 0 || crystals > 10_000_000)
    )
      return json({ error: "Кристаллы должны быть целым числом от 0 до 10 000 000." }, 400);
    if (action === "set-crystals") {
      await ensureEngagementSchema();
      await pool.query(
        `INSERT INTO clickling_ai_wallet(user_id,balance) VALUES($1,$2)
        ON CONFLICT(user_id) DO UPDATE SET balance=EXCLUDED.balance,updated_at=now()`,
        [userId, crystals],
      );
      Object.assign(details, { crystals });
    } else {
      const stored = await pool.query("SELECT data FROM linguaplay_user_data WHERE user_id=$1", [
        userId,
      ]);
      const data = parseJson(stored.rows[0]?.data);
      const spaces = parseJson(data["linguaplay-stats-by-space"]);
      const spaceId = text(body.spaceId, 120) || Object.keys(spaces)[0] || "de-a1-a2";
      const stats = parseJson(spaces[spaceId]);
      delete stats.freezeCount;
      spaces[spaceId] = JSON.stringify({ ...stats, xp });
      await pool.query(
        `INSERT INTO linguaplay_user_data(user_id,data,updated_at) VALUES($1,jsonb_build_object('linguaplay-stats-by-space',$2::text),now())
        ON CONFLICT(user_id) DO UPDATE SET data=linguaplay_user_data.data || jsonb_build_object('linguaplay-stats-by-space',$2::text),updated_at=now()`,
        [userId, JSON.stringify(spaces)],
      );
      Object.assign(details, { xp, spaceId });
    }
  } else if (action === "set-energy") {
    await ensureEnergyTables();
    const energy = Number(body.energy);
    if (!Number.isInteger(energy) || energy < 0 || energy > ENERGY_CAP)
      return json({ error: `Энергия должна быть целым числом от 0 до ${ENERGY_CAP}.` }, 400);
    const reason = text(body.reason, 300);
    if (!reason) return json({ error: "Укажите причину ручного изменения энергии." }, 400);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtext('linguaplay-energy-user:' || $1))",
        [userId],
      );
      await client.query(
        `INSERT INTO linguaplay_energy_accounts(user_id,energy,next_at) VALUES($1,$2,NULL) ON CONFLICT(user_id) DO NOTHING`,
        [userId, ENERGY_CAP],
      );
      const current = await client.query(
        "SELECT energy,next_at,now() AS db_now FROM linguaplay_energy_accounts WHERE user_id=$1 FOR UPDATE",
        [userId],
      );
      const previous = Number(current.rows[0].energy);
      const now = new Date(current.rows[0].db_now);
      const nextAt =
        energy >= ENERGY_CAP
          ? null
          : (current.rows[0].next_at ?? new Date(now.getTime() + ENERGY_REFILL_MINUTES * 60_000));
      await client.query(
        "UPDATE linguaplay_energy_accounts SET energy=$2,next_at=$3,updated_at=now() WHERE user_id=$1",
        [userId, energy, nextAt],
      );
      await client.query(
        `
        INSERT INTO linguaplay_energy_ledger(user_id,amount,balance_after,next_at_after,reason,idempotency_key)
        VALUES($1,$2,$3,$4,$5,$6)
      `,
        [
          userId,
          energy - previous,
          energy,
          nextAt,
          `Manual change: ${reason}`,
          `manual:${randomUUID()}`,
        ],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
    Object.assign(details, { energy, reason });
  } else if (action === "reset-progress") {
    const emptyStats = JSON.stringify({
      [text(body.spaceId, 120) || "de-a1-a2"]: JSON.stringify({
        xp: 0,
        dailyXp: 0,
        dailyDate: "",
        streak: 0,
        sessions: 0,
        answers: 0,
        correct: 0,
        studyDays: {},
        lastStudyDay: "",
      }),
    });
    const patch = {
      "linguaplay-stats-by-space": emptyStats,
      "linguaplay-progress-by-space": "{}",
      "linguaplay-confusions-by-space": "{}",
      "linguaplay-path-completions-by-space": "{}",
      "linguaplay-german-course-progress": "{}",
    };
    await pool.query(
      `INSERT INTO linguaplay_user_data(user_id,data,updated_at) VALUES($1,$2::jsonb,now()) ON CONFLICT(user_id) DO UPDATE SET data=linguaplay_user_data.data || EXCLUDED.data,updated_at=now()`,
      [userId, JSON.stringify(patch)],
    );
    details.reset = "learning-progress";
  } else return json({ error: "Неизвестное действие." }, 400);

  await audit(gate.actor.user.id, userId, action, details);
  return json({ saved: true });
}

export async function PUT(request: Request) {
  const gate = await userAdminFor(request);
  if ("response" in gate) return gate.response;
  let body: { userId?: unknown; role?: unknown; permissions?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "Invalid JSON payload." }, 400);
  }
  const userId = text(body.userId, 120);
  const role = text(body.role, 20);
  if (!userId || !["owner", "admin", "student"].includes(role))
    return json({ error: "Выберите роль администратора или ученика." }, 400);
  if (role === "owner" && gate.actor.role !== "owner")
    return json({ error: "Назначить владельца может только действующий владелец." }, 403);
  if (userId === gate.actor.user.id && role !== gate.actor.role)
    return json({ error: "Нельзя изменить собственную роль." }, 403);
  const existing = await pool.query("SELECT role FROM linguaplay_user_roles WHERE user_id=$1", [
    userId,
  ]);
  if (!existing.rowCount) return json({ error: "Пользователь не найден." }, 404);
  if (existing.rows[0].role === "owner" && gate.actor.role !== "owner")
    return json({ error: "Настройки владельца защищены." }, 403);

  const supplied =
    body.permissions && typeof body.permissions === "object"
      ? (body.permissions as Record<string, unknown>)
      : {};
  const permissions: Record<Permission, boolean> = {
    manageContent:
      role === "owner" || (role === "admin" && Boolean(supplied.manageContent ?? true)),
    manageUsers:
      role === "owner" ||
      (role === "admin" && gate.actor.role === "owner"
        ? Boolean(supplied.manageUsers)
        : Boolean(supplied.manageUsers && gate.actor.permissions.manageUsers)),
    viewAnalytics: role === "owner" || (role === "admin" && Boolean(supplied.viewAnalytics)),
    manageSettings: role === "owner",
  };
  const allowedSections = ["today", "library", "catalog", "path", "materials", "games", "stats"];
  const hiddenSections = Array.isArray(supplied.hiddenSections)
    ? supplied.hiddenSections
        .filter((item): item is string => typeof item === "string")
        .filter((item) => allowedSections.includes(item))
    : [];
  Object.assign(permissions, { hiddenSections });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('linguaplay-owner-role'))");
    if (role === "owner" && existing.rows[0].role !== "owner") {
      const owners = await client.query(
        "SELECT COUNT(*)::int AS count FROM linguaplay_user_roles WHERE role='owner'",
      );
      if (owners.rows[0].count > 0) {
        await client.query("ROLLBACK");
        return json({ error: "Главный владелец уже назначен." }, 409);
      }
    }
    await client.query(
      "UPDATE linguaplay_user_roles SET role=$2,permissions=$3::jsonb,updated_at=now() WHERE user_id=$1",
      [userId, role, JSON.stringify(permissions)],
    );
    await client.query(`UPDATE "user" SET role=$2 WHERE id=$1`, [
      userId,
      role === "owner" || role === "admin" ? "admin" : "user",
    ]);
    await client.query(`DELETE FROM "session" WHERE "userId"=$1`, [userId]);
    if (existing.rows[0].role !== role)
      await client.query(
        "INSERT INTO linguaplay_admin_audit(actor_id,target_id,action,details) VALUES($1,$2,'revoke-sessions-role-change',$3::jsonb)",
        [gate.actor.user.id, userId, JSON.stringify({ previousRole: existing.rows[0].role, role })],
      );
    await client.query(
      "INSERT INTO linguaplay_admin_audit(actor_id,target_id,action,details) VALUES($1,$2,'set-role',$3::jsonb)",
      [gate.actor.user.id, userId, JSON.stringify({ role, permissions })],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
  return json({ saved: true });
}

export async function DELETE(request: Request) {
  const gate = await userAdminFor(request);
  if ("response" in gate) return gate.response;
  const userId = new URL(request.url).searchParams.get("userId");
  if (!userId || userId === gate.actor.user.id)
    return json({ error: "Нельзя удалить текущий аккаунт." }, 400);
  const result = await pool.query("SELECT role FROM linguaplay_user_roles WHERE user_id=$1", [
    userId,
  ]);
  if (!result.rowCount) return json({ error: "Пользователь не найден." }, 404);
  if (result.rows[0].role === "owner") return json({ error: "Аккаунт владельца защищён." }, 403);
  await audit(gate.actor.user.id, userId, "delete-user", {});
  await pool.query('DELETE FROM "user" WHERE id=$1', [userId]);
  return json({ deleted: true });
}

async function audit(
  actorId: string,
  targetId: string,
  action: string,
  details: Record<string, unknown>,
) {
  await pool.query(
    "INSERT INTO linguaplay_admin_audit(actor_id,target_id,action,details) VALUES($1,$2,$3,$4::jsonb)",
    [actorId, targetId, action, JSON.stringify(details)],
  );
}
