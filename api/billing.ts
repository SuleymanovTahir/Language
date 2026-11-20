import { auth, pool } from "../src/lib/auth.ts";
import { readLimitedRequestBody } from "../src/lib/readLimitedRequestBody.ts";
import { ensureBillingSchema } from "../src/server/api/billingSchema.ts";

const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
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
  await ensureBillingSchema();
  const [plans, manual, purchased, subscription, payments] = await Promise.all([
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
    pool.query(
      `SELECT s.status,s.period_start,s.period_end,s.cancel_at_period_end,s.provider,p.name AS plan_name,p.amount_minor,p.currency,p.interval
       FROM linguaplay_subscriptions s JOIN linguaplay_plans p ON p.code=s.plan_code
       WHERE s.account_id=$1 ORDER BY s.period_end DESC LIMIT 1`,
      [user.id],
    ),
    pool.query(
      `SELECT p.id::text,p.amount_minor,p.currency,p.status,p.created_at,p.provider,p.plan_code,pl.name AS plan_name
       FROM linguaplay_payments p LEFT JOIN linguaplay_plans pl ON pl.code=p.plan_code
       WHERE p.account_id=$1 ORDER BY p.created_at DESC LIMIT 10`,
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
    currentSubscription: subscription.rows[0]
      ? {
          status: subscription.rows[0].status,
          periodStart: subscription.rows[0].period_start,
          periodEnd: subscription.rows[0].period_end,
          cancelAtPeriodEnd: subscription.rows[0].cancel_at_period_end,
          provider: subscription.rows[0].provider,
          planName: subscription.rows[0].plan_name,
          amountMinor: subscription.rows[0].amount_minor,
          currency: subscription.rows[0].currency,
          interval: subscription.rows[0].interval,
        }
      : null,
    payments: payments.rows.map((row) => ({
      id: row.id,
      amountMinor: row.amount_minor,
      currency: row.currency,
      status: row.status,
      createdAt: row.created_at,
      provider: row.provider,
      planCode: row.plan_code,
      planName: row.plan_name,
    })),
    checkoutEnabled: false,
    message: "Тарифы уже показаны. Покупка откроется после подключения платёжного провайдера.",
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
  try {
    new Intl.NumberFormat("en", { style: "currency", currency }).format(0);
  } catch {
    return json({ error: "Укажите поддерживаемую валюту в формате ISO 4217." }, 400);
  }
  await ensureBillingSchema();
  const features =
    body.features && typeof body.features === "object" && !Array.isArray(body.features)
      ? JSON.stringify(body.features)
      : "{}";
  const provider = process.env.LINGUAPLAY_BILLING_PROVIDER?.trim() || null;
  const providerPriceId =
    typeof body.providerPriceId === "string"
      ? body.providerPriceId.trim().slice(0, 160) || null
      : null;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const old = await client.query(
      "SELECT code,name,amount_minor,currency,interval,active,version FROM linguaplay_plans WHERE code=$1 FOR UPDATE",
      [code],
    );
    const result = await client.query(
      `INSERT INTO linguaplay_plans(code,name,amount_minor,currency,interval,features,active,provider,provider_price_id)
    VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9)
    ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name,amount_minor=EXCLUDED.amount_minor,currency=EXCLUDED.currency,interval=EXCLUDED.interval,features=EXCLUDED.features,active=EXCLUDED.active,provider=EXCLUDED.provider,provider_price_id=EXCLUDED.provider_price_id,version=linguaplay_plans.version+1,updated_at=now()
    RETURNING code,name,amount_minor,currency,interval,features,version,active`,
      [code, name, amountMinor, currency, interval, features, active, provider, providerPriceId],
    );
    await client.query(
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
    await client.query("COMMIT");
    return json({ plan: safePlan(result.rows[0]) });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
