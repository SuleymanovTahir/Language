import { auth, ensureInitialAppRole, pool } from "../src/lib/auth.ts";
import { randomUUID } from "node:crypto";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
const flags = ["manageContent", "manageUsers", "viewAnalytics", "manageSettings"] as const;
const configuredEnergyCap = Number(process.env.LINGUAPLAY_ENERGY_CAP ?? 5);
const ENERGY_CAP = Number.isInteger(configuredEnergyCap)
  ? Math.max(1, Math.min(22, configuredEnergyCap))
  : 5;
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
  const permissions = { ...defaults(role), ...(row?.permissions ?? {}) } as Record<
    Permission,
    boolean
  >;
  permissions.manageContent = ["owner", "admin"].includes(role);
  permissions.manageUsers = role === "owner";
  permissions.manageSettings = role === "owner";
  permissions.viewAnalytics = role === "owner";
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
  const gate = await ownerFor(request);
  if ("response" in gate) return gate.response;
  let body: { action?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "Invalid JSON payload." }, 400);
  }
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
  const gate = await ownerFor(request);
  if ("response" in gate) return gate.response;
  if (new URL(request.url).searchParams.get("view") === "analytics") return getAnalytics();

  const [users, events, active] = await Promise.all([
    pool.query(`SELECT u.id,u.name,u.email,u."emailVerified" AS email_verified,u.image,u.role AS auth_role,u."createdAt" AS created_at,
      u.banned,u."banReason" AS ban_reason,u."banExpires" AS ban_expires,r.role,r.permissions,
      COUNT(DISTINCT e.id)::int AS event_count, COUNT(DISTINCT e.id) FILTER (WHERE e.is_correct = false)::int AS errors,
      MAX(e.created_at) AS last_activity, MAX(s."updatedAt") AS last_login, GREATEST(MAX(e.created_at),MAX(s."updatedAt")) AS last_seen,
      ent.status AS pro_status,ent.starts_at AS pro_starts_at,ent.ends_at AS pro_ends_at,d.data AS profile_data,COALESCE(en.energy,22) AS server_energy
      FROM "user" u LEFT JOIN linguaplay_user_roles r ON r.user_id=u.id
      LEFT JOIN linguaplay_events e ON e.user_id=u.id LEFT JOIN "session" s ON s."userId"=u.id
      LEFT JOIN LATERAL (
        SELECT status,starts_at,ends_at FROM (
          SELECT status,starts_at,ends_at FROM linguaplay_user_entitlements WHERE user_id=u.id
          UNION ALL SELECT status,starts_at,ends_at FROM linguaplay_entitlements WHERE account_id=u.id AND feature='pro'
        ) entitlement_rows ORDER BY ends_at DESC NULLS LAST LIMIT 1
      ) ent ON true LEFT JOIN linguaplay_user_data d ON d.user_id=u.id
      LEFT JOIN linguaplay_energy_accounts en ON en.user_id=u.id
      GROUP BY u.id,r.role,r.permissions,ent.status,ent.starts_at,ent.ends_at,d.data,en.energy ORDER BY u."createdAt" DESC`),
    pool.query(`SELECT e.id,e.user_id,u.name,e.event_type,e.module_title,e.activity,e.round_index,e.round_total,e.is_correct,e.payload-'prompt'-'selectedAnswer'-'correctAnswer'-'answer'-'text' AS payload,e.created_at
      FROM linguaplay_events e JOIN "user" u ON u.id=e.user_id ORDER BY e.created_at DESC LIMIT 200`),
    pool.query(
      `SELECT s.user_id,u.name,s.activity_title,s.module_title,s.current_index,s.total,s.updated_at FROM linguaplay_active_sessions s JOIN "user" u ON u.id=s.user_id ORDER BY s.updated_at DESC`,
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
        energy_cap: ENERGY_CAP,
        is_pro:
          row.pro_status === "active" &&
          (!proStartsAt || new Date(proStartsAt).getTime() <= now) &&
          Boolean(proEndsAt) &&
          new Date(proEndsAt).getTime() > now,
        last_seen: lastSeen ? new Date(lastSeen).toISOString() : null,
        dormant_days: lastSeen
          ? Math.floor((now - new Date(lastSeen).getTime()) / 86_400_000)
          : null,
      };
    }),
    events: events.rows,
    active: active.rows,
    actor: { id: gate.actor.user.id, role: gate.actor.role },
  });
}

async function getAnalytics() {
  const [daily, users, actions, pages, recent] = await Promise.all([
    pool.query(`SELECT day::date AS day, SUM(signups)::int AS signups, SUM(active_users)::int AS active_users FROM (
      SELECT date_trunc('day',u."createdAt") AS day,COUNT(*) AS signups,0 AS active_users FROM "user" u WHERE u."createdAt">=now()-interval '30 days' GROUP BY 1
      UNION ALL SELECT date_trunc('day',e.created_at) AS day,0 AS signups,COUNT(DISTINCT e.user_id) AS active_users FROM linguaplay_events e WHERE e.created_at>=now()-interval '30 days' GROUP BY 1
      ) daily GROUP BY day ORDER BY day`),
    pool.query(`WITH seen AS (SELECT u.id,u.name,u.email,u."createdAt" AS created_at,GREATEST(MAX(s."updatedAt"),MAX(e.created_at)) AS last_seen FROM "user" u LEFT JOIN "session" s ON s."userId"=u.id LEFT JOIN linguaplay_events e ON e.user_id=u.id GROUP BY u.id)
      SELECT COUNT(*) FILTER (WHERE created_at>=now()-interval '7 days')::int AS new_users_7d,
      COUNT(*) FILTER (WHERE last_seen<now()-interval '14 days' OR (last_seen IS NULL AND created_at<now()-interval '14 days'))::int AS dormant_users,
      COUNT(*) FILTER (WHERE last_seen>=now()-interval '7 days')::int AS active_users_7d,
      (SELECT COUNT(*)::int FROM "user") AS total_users FROM seen`),
    pool.query(
      `SELECT payload->>'action' AS action,payload->>'route' AS route,COUNT(*)::int AS clicks FROM linguaplay_events WHERE event_type='target-action' AND created_at>=now()-interval '30 days' GROUP BY 1,2 ORDER BY clicks DESC LIMIT 20`,
    ),
    pool.query(
      `SELECT payload->>'route' AS route,COUNT(*)::int AS views,COUNT(DISTINCT user_id)::int AS users FROM linguaplay_events WHERE event_type='page-view' AND created_at>=now()-interval '30 days' GROUP BY 1 ORDER BY views DESC`,
    ),
    pool.query(
      `SELECT e.id,u.name,e.payload->>'route' AS route,e.payload->>'action' AS action,e.created_at FROM linguaplay_events e JOIN "user" u ON u.id=e.user_id WHERE e.event_type='target-action' ORDER BY e.created_at DESC LIMIT 100`,
    ),
  ]);
  const dormant =
    await pool.query(`WITH seen AS (SELECT u.id,u.name,u.email,u."createdAt" AS created_at,GREATEST(MAX(s."updatedAt"),MAX(e.created_at)) AS last_seen FROM "user" u LEFT JOIN "session" s ON s."userId"=u.id LEFT JOIN linguaplay_events e ON e.user_id=u.id GROUP BY u.id)
    SELECT id,name,email,created_at,last_seen FROM seen WHERE last_seen<now()-interval '14 days' OR (last_seen IS NULL AND created_at<now()-interval '14 days') ORDER BY last_seen ASC NULLS FIRST LIMIT 100`);
  return json({
    daily: daily.rows,
    summary: users.rows[0],
    actions: actions.rows,
    pages: pages.rows,
    recent: recent.rows,
    dormant: dormant.rows,
  });
}

export async function PATCH(request: Request) {
  const gate = await ownerFor(request);
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
        "UPDATE linguaplay_entitlements SET status='revoked',updated_by=$2,reason=$3 WHERE account_id=$1 AND feature='pro' AND status='active'",
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
    const email = text(body.email, 254).toLowerCase();
    if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return json({ error: "Укажите корректное имя и адрес почты." }, 400);
    const authApi = auth.api as any;
    await authApi.adminUpdateUser({
      body: { userId, data: { name, email } },
      headers: request.headers,
    });
    Object.assign(details, { name, email });
  } else if (action === "set-password") {
    const password = typeof body.password === "string" ? body.password : "";
    if (password.length < 8 || password.length > 128)
      return json({ error: "Пароль должен содержать от 8 до 128 символов." }, 400);
    const authApi = auth.api as any;
    await authApi.setUserPassword({
      body: { userId, newPassword: password },
      headers: request.headers,
    });
    details.changed = true;
  } else if (action === "set-progress") {
    const xp = Number(body.xp);
    if (!Number.isInteger(xp) || xp < 0 || xp > 10_000_000)
      return json({ error: "XP должны быть целым числом от 0 до 10 000 000." }, 400);
    const stored = await pool.query("SELECT data FROM linguaplay_user_data WHERE user_id=$1", [
      userId,
    ]);
    const data = parseJson(stored.rows[0]?.data);
    const spaces = parseJson(data["linguaplay-stats-by-space"]);
    const spaceId = text(body.spaceId, 120) || Object.keys(spaces)[0] || "de-a1-a2";
    const stats = parseJson(spaces[spaceId]);
    delete stats.crystals;
    delete stats.freezeCount;
    spaces[spaceId] = JSON.stringify({ ...stats, xp });
    await pool.query(
      `INSERT INTO linguaplay_user_data(user_id,data,updated_at) VALUES($1,jsonb_build_object('linguaplay-stats-by-space',$2::text),now())
      ON CONFLICT(user_id) DO UPDATE SET data=linguaplay_user_data.data || jsonb_build_object('linguaplay-stats-by-space',$2::text),updated_at=now()`,
      [userId, JSON.stringify(spaces)],
    );
    Object.assign(details, { xp, spaceId });
  } else if (action === "set-energy") {
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
  const gate = await ownerFor(request);
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
    return json({ error: "Выберите роль владельца, администратора контента или ученика." }, 400);
  if (userId === gate.actor.user.id && role !== "owner")
    return json({ error: "Нельзя снять собственные права владельца." }, 403);
  const existing = await pool.query("SELECT role FROM linguaplay_user_roles WHERE user_id=$1", [
    userId,
  ]);
  if (!existing.rowCount) return json({ error: "Пользователь не найден." }, 404);
  if (role === "owner" && existing.rows[0].role !== "owner") {
    const owners = await pool.query(
      "SELECT COUNT(*)::int AS count FROM linguaplay_user_roles WHERE role='owner'",
    );
    if (owners.rows[0].count > 0) return json({ error: "Главный владелец уже назначен." }, 409);
  }
  const supplied =
    body.permissions && typeof body.permissions === "object"
      ? (body.permissions as Record<string, unknown>)
      : {};
  const permissions = Object.fromEntries(
    flags.map((key) => [
      key,
      typeof supplied[key] === "boolean" ? supplied[key] : defaults(role)[key],
    ]),
  ) as Record<Permission, boolean>;
  if (role === "owner") {
    permissions.manageUsers = true;
    permissions.manageSettings = true;
    permissions.viewAnalytics = true;
  } else {
    permissions.manageUsers = false;
    permissions.manageSettings = false;
    permissions.viewAnalytics = false;
  }
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
      role === "owner" ? "admin" : "user",
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
  const gate = await ownerFor(request);
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
