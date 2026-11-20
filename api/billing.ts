import { auth, pool } from "../src/lib/auth.ts";
import { readLimitedRequestBody } from "../src/lib/readLimitedRequestBody.ts";

const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
let schemaReady: Promise<void> | null = null;
async function ensureSchema() {
  schemaReady ??= pool
    .query(`CREATE TABLE IF NOT EXISTS linguaplay_plans (
    code text PRIMARY KEY,name text NOT NULL,amount_minor integer NOT NULL CHECK(amount_minor>=0),currency text NOT NULL,
    interval text NOT NULL CHECK(interval IN ('month','year','once')),features jsonb NOT NULL DEFAULT '{}'::jsonb,version integer NOT NULL DEFAULT 1,
    active boolean NOT NULL DEFAULT false,provider text,provider_price_id text,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS linguaplay_payments (id bigserial PRIMARY KEY,provider text NOT NULL,provider_payment_id text NOT NULL,provider_event_id text NOT NULL UNIQUE,account_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,plan_code text REFERENCES linguaplay_plans(code),amount_minor integer NOT NULL,currency text NOT NULL,status text NOT NULL,raw_event jsonb NOT NULL DEFAULT '{}'::jsonb,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(provider,provider_payment_id));
    CREATE TABLE IF NOT EXISTS linguaplay_subscriptions (id bigserial PRIMARY KEY,account_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,provider text NOT NULL,provider_subscription_id text NOT NULL UNIQUE,plan_code text NOT NULL REFERENCES linguaplay_plans(code),status text NOT NULL,period_start timestamptz NOT NULL,period_end timestamptz NOT NULL,cancel_at_period_end boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),CHECK(period_end>period_start));
    CREATE TABLE IF NOT EXISTS linguaplay_entitlements (id bigserial PRIMARY KEY,account_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,source text NOT NULL CHECK(source IN ('subscription','manual_grant','refund')),feature text NOT NULL,starts_at timestamptz NOT NULL,ends_at timestamptz NOT NULL,status text NOT NULL CHECK(status IN ('active','inactive','revoked')),reference_id text,updated_by text REFERENCES "user"(id) ON DELETE SET NULL,reason text,created_at timestamptz NOT NULL DEFAULT now(),CHECK(ends_at>starts_at));
    CREATE TABLE IF NOT EXISTS linguaplay_billing_audit (id bigserial PRIMARY KEY,actor_id text REFERENCES "user"(id) ON DELETE SET NULL,target_id text REFERENCES "user"(id) ON DELETE SET NULL,action text NOT NULL,old_value jsonb NOT NULL DEFAULT '{}'::jsonb,new_value jsonb NOT NULL DEFAULT '{}'::jsonb,reason text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());`)
    .then(() => undefined)
    .catch((error) => {
      schemaReady = null;
      throw error;
    });
  await schemaReady;
}
async function actor(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) return null;
  const result = await pool.query("SELECT role FROM linguaplay_user_roles WHERE user_id=$1", [
    session.user.id,
  ]);
  return { id: session.user.id, role: String(result.rows[0]?.role ?? "student") };
}
function safePlan(row: Record<string, unknown>) {
  return {
    code: row.code,
    name: row.name,
    amountMinor: row.amount_minor,
    currency: row.currency,
    interval: row.interval,
    features: row.features,
    version: row.version,
    active: row.active,
  };
}

export async function GET(request: Request) {
  const user = await actor(request);
  if (!user) return json({ error: "Войдите, чтобы посмотреть тариф." }, 401);
  await ensureSchema();
  const [plans, manual, purchased] = await Promise.all([
    pool.query(
      `SELECT code,name,amount_minor,currency,interval,features,version,active FROM linguaplay_plans WHERE active=true OR $1::boolean ORDER BY amount_minor ASC`,
      [user.role === "owner"],
    ),
    pool.query(
      "SELECT status,starts_at,ends_at FROM linguaplay_user_entitlements WHERE user_id=$1",
      [user.id],
    ),
    pool.query(
      `SELECT feature,source,starts_at,ends_at,status FROM linguaplay_entitlements WHERE account_id=$1 AND feature='pro' AND status='active' AND starts_at<=now() AND ends_at>now() ORDER BY ends_at DESC LIMIT 1`,
      [user.id],
    ),
  ]);
  const legacy = manual.rows[0];
  const newGrant = purchased.rows[0];
  const startsAt = newGrant?.starts_at ?? legacy?.starts_at ?? null;
  const endsAt = newGrant?.ends_at ?? legacy?.ends_at ?? null;
  const active = Boolean(
    (newGrant || legacy?.status === "active") &&
    endsAt &&
    new Date(endsAt as string).getTime() > Date.now() &&
    (!startsAt || new Date(startsAt as string).getTime() <= Date.now()),
  );
  return json({
    plans: plans.rows.map(safePlan),
    entitlement: {
      active,
      startsAt,
      endsAt,
      source: newGrant?.source ?? (active ? "manual_grant" : null),
    },
    checkoutEnabled: false,
    message: "Оплата появится после выбора и подключения платёжного провайдера.",
  });
}

export async function POST(request: Request) {
  const user = await actor(request);
  if (!user) return json({ error: "Войдите в аккаунт." }, 401);
  const raw = await readLimitedRequestBody(request, 8_000);
  if (!raw) return json({ error: "Запрос слишком большой." }, 413);
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(new TextDecoder().decode(raw)) as Record<string, unknown>;
  } catch {
    return json({ error: "Некорректный JSON." }, 400);
  }
  if (body.action === "checkout")
    return json({ error: "Оплата ещё не подключена. Доступ PRO не менялся." }, 503);
  if (body.action !== "save-plan") return json({ error: "Неизвестное действие." }, 400);
  if (user.role !== "owner") return json({ error: "Тарифами управляет только владелец." }, 403);
  const code = typeof body.code === "string" ? body.code.toLowerCase().trim().slice(0, 40) : "";
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 100) : "";
  const amountMinor = Number(body.amountMinor);
  const currency = typeof body.currency === "string" ? body.currency.toUpperCase().slice(0, 3) : "";
  const interval = body.interval;
  const active = body.active === true;
  if (
    !/^[a-z0-9][a-z0-9_-]{1,39}$/.test(code) ||
    !name ||
    !Number.isInteger(amountMinor) ||
    amountMinor < 0 ||
    !/^[A-Z]{3}$/.test(currency) ||
    !["month", "year", "once"].includes(String(interval))
  )
    return json({ error: "Проверьте код, название, цену, валюту и период тарифа." }, 400);
  await ensureSchema();
  const features =
    body.features && typeof body.features === "object" && !Array.isArray(body.features)
      ? JSON.stringify(body.features)
      : "{}";
  const provider = process.env.LINGUAPLAY_BILLING_PROVIDER?.trim() || null;
  const providerPriceId =
    typeof body.providerPriceId === "string"
      ? body.providerPriceId.trim().slice(0, 160) || null
      : null;
  const old = await pool.query(
    "SELECT code,name,amount_minor,currency,interval,active,version FROM linguaplay_plans WHERE code=$1",
    [code],
  );
  const result = await pool.query(
    `INSERT INTO linguaplay_plans(code,name,amount_minor,currency,interval,features,active,provider,provider_price_id)
    VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9)
    ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name,amount_minor=EXCLUDED.amount_minor,currency=EXCLUDED.currency,interval=EXCLUDED.interval,features=EXCLUDED.features,active=EXCLUDED.active,provider=EXCLUDED.provider,provider_price_id=EXCLUDED.provider_price_id,version=linguaplay_plans.version+1,updated_at=now()
    RETURNING code,name,amount_minor,currency,interval,features,version,active`,
    [code, name, amountMinor, currency, interval, features, active, provider, providerPriceId],
  );
  await pool.query(
    "INSERT INTO linguaplay_billing_audit(actor_id,action,old_value,new_value,reason) VALUES($1,'plan-update',$2::jsonb,$3::jsonb,$4)",
    [
      user.id,
      JSON.stringify(old.rows[0] ?? {}),
      JSON.stringify(result.rows[0]),
      typeof body.reason === "string"
        ? body.reason.slice(0, 300) || "План создан или обновлён владельцем"
        : "План создан или обновлён владельцем",
    ],
  );
  return json({ plan: safePlan(result.rows[0]) });
}
