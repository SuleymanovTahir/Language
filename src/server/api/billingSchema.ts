import { pool } from "../../lib/auth.ts";

let schemaReady: Promise<void> | null = null;

export async function ensureBillingSchema() {
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
  await pool.query(`
    INSERT INTO linguaplay_plans(code,name,amount_minor,currency,interval,features,active)
    VALUES
      ('pro_monthly','ClickLing PRO · месяц',499,'EUR','month',
       '{"benefits":["Безлимитная энергия","Игры и карточки без ограничений","Сохранение прогресса и повторение слов"]}'::jsonb,true),
      ('pro_yearly','ClickLing PRO · год',3999,'EUR','year',
       '{"benefits":["Безлимитная энергия","Игры и карточки без ограничений","Сохранение прогресса и повторение слов","Выгоднее помесячной оплаты"]}'::jsonb,true)
    ON CONFLICT(code) DO NOTHING
  `);
}
