import pg from "pg";

const { Pool } = pg;
if (!process.env.DATABASE_URL)
  throw new Error("DATABASE_URL is required to prepare the application schema.");
const energyCap = 22;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  allowExitOnIdle: true,
});
try {
  // Remove the non-routable account used only by the earlier deployment smoke test.
  await pool.query(`DELETE FROM "user" WHERE email LIKE 'lp-codex-check-%@example.invalid'`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS linguaplay_user_data (
      user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
      data jsonb NOT NULL DEFAULT '{}'::jsonb,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS linguaplay_user_roles (
      user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
      role text NOT NULL DEFAULT 'student' CHECK (role IN ('owner','admin','editor','student')),
      permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS linguaplay_events (
      id bigserial PRIMARY KEY,
      user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      event_type text NOT NULL,
      module_id text,
      module_title text,
      activity text,
      round_index integer,
      round_total integer,
      prompt text,
      selected_answer text,
      correct_answer text,
      is_correct boolean,
      payload jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS linguaplay_events_user_time_idx ON linguaplay_events(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS linguaplay_events_time_idx ON linguaplay_events(created_at);
    CREATE TABLE IF NOT EXISTS linguaplay_active_sessions (
      user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
      activity_type text NOT NULL,
      activity_id text,
      activity_title text NOT NULL,
      module_id text,
      module_title text,
      current_index integer NOT NULL DEFAULT 0,
      total integer NOT NULL DEFAULT 0,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    ALTER TABLE "user" ADD COLUMN IF NOT EXISTS banned boolean NOT NULL DEFAULT false;
    ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "banReason" text;
    ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "banExpires" timestamptz;
    CREATE TABLE IF NOT EXISTS linguaplay_user_entitlements (
      user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
      status text NOT NULL DEFAULT 'inactive' CHECK (status IN ('active','inactive')),
      starts_at timestamptz,
      ends_at timestamptz,
      updated_by text REFERENCES "user"(id) ON DELETE SET NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS linguaplay_admin_audit (
      id bigserial PRIMARY KEY,
      actor_id text REFERENCES "user"(id) ON DELETE SET NULL,
      target_id text REFERENCES "user"(id) ON DELETE SET NULL,
      action text NOT NULL,
      details jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS linguaplay_admin_audit_time_idx ON linguaplay_admin_audit(created_at DESC);
    CREATE TABLE IF NOT EXISTS linguaplay_ai_assessments (
      id bigserial PRIMARY KEY,
      user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      operation text NOT NULL,
      idempotency_key text NOT NULL,
      request_hash text NOT NULL,
      status text NOT NULL CHECK (status IN ('pending','succeeded','failed')),
      result jsonb,
      input_tokens integer NOT NULL DEFAULT 0,
      output_tokens integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (user_id, operation, idempotency_key)
    );
    ALTER TABLE linguaplay_ai_assessments ADD COLUMN IF NOT EXISTS input_tokens integer NOT NULL DEFAULT 0;
    ALTER TABLE linguaplay_ai_assessments ADD COLUMN IF NOT EXISTS output_tokens integer NOT NULL DEFAULT 0;
    CREATE INDEX IF NOT EXISTS linguaplay_ai_assessments_time_idx ON linguaplay_ai_assessments(created_at DESC);
    CREATE TABLE IF NOT EXISTS linguaplay_guest_trials (
      token_hash text PRIMARY KEY,
      first_game_at timestamptz NOT NULL,
      blocked_until timestamptz NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS linguaplay_guest_ip_trials (
      ip_hash text PRIMARY KEY,
      blocked_until timestamptz NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
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
    CREATE TABLE IF NOT EXISTS linguaplay_provider_usage (
      provider text NOT NULL,
      period_kind text NOT NULL CHECK (period_kind IN ('day','month')),
      period_key text NOT NULL,
      user_id text NOT NULL,
      characters integer NOT NULL DEFAULT 0,
      requests integer NOT NULL DEFAULT 0,
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY(provider,period_kind,period_key,user_id)
    );
    CREATE TABLE IF NOT EXISTS linguaplay_user_data_keys (
      user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      key text NOT NULL,
      value text NOT NULL,
      version bigint NOT NULL DEFAULT 1,
      deleted boolean NOT NULL DEFAULT false,
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY(user_id,key)
    );
    ALTER TABLE linguaplay_user_data_keys ADD COLUMN IF NOT EXISTS deleted boolean NOT NULL DEFAULT false;
    CREATE TABLE IF NOT EXISTS linguaplay_content (
      id text PRIMARY KEY,
      kind text NOT NULL CHECK (kind IN ('module','lesson','activity','audio_quiz','grammar','mission')),
      language_code text NOT NULL,
      level text NOT NULL,
      topic text NOT NULL DEFAULT '',
      status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
      title text NOT NULL,
      body jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_by text NOT NULL REFERENCES "user"(id),
      updated_by text NOT NULL REFERENCES "user"(id),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      published_at timestamptz,
      archived_at timestamptz
    );
    CREATE INDEX IF NOT EXISTS linguaplay_content_catalog_idx ON linguaplay_content(status,language_code,level,kind,updated_at DESC);
    CREATE TABLE IF NOT EXISTS linguaplay_content_shares (
      id bigserial PRIMARY KEY,
      token_hash text NOT NULL UNIQUE,
      content_id text NOT NULL REFERENCES linguaplay_content(id) ON DELETE CASCADE,
      created_by text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      expires_at timestamptz NOT NULL,
      max_views integer NOT NULL CHECK (max_views BETWEEN 1 AND 100),
      view_count integer NOT NULL DEFAULT 0,
      revoked_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS linguaplay_learning_preferences (
      user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
      preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS linguaplay_learning_events (
      id bigserial PRIMARY KEY,
      event_key text UNIQUE,
      user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      session_id text NOT NULL,
      item_id text NOT NULL,
      language_code text NOT NULL DEFAULT '',
      level text NOT NULL DEFAULT '',
      skill text NOT NULL,
      topic text NOT NULL DEFAULT '',
      variant_id text NOT NULL DEFAULT '',
      first_try_correct boolean,
      attempt_count integer NOT NULL DEFAULT 1,
      hint_used boolean NOT NULL DEFAULT false,
      skipped boolean NOT NULL DEFAULT false,
      duration_ms integer,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    ALTER TABLE linguaplay_learning_events ADD COLUMN IF NOT EXISTS event_key text;
    ALTER TABLE linguaplay_learning_events ADD COLUMN IF NOT EXISTS language_code text NOT NULL DEFAULT '';
    ALTER TABLE linguaplay_learning_events ADD COLUMN IF NOT EXISTS level text NOT NULL DEFAULT '';
    CREATE UNIQUE INDEX IF NOT EXISTS linguaplay_learning_events_event_key_idx ON linguaplay_learning_events(event_key) WHERE event_key IS NOT NULL;
    CREATE INDEX IF NOT EXISTS linguaplay_learning_events_user_time_idx ON linguaplay_learning_events(user_id,created_at DESC);
    CREATE TABLE IF NOT EXISTS linguaplay_plans (
      code text PRIMARY KEY,
      name text NOT NULL,
      amount_minor integer NOT NULL CHECK (amount_minor >= 0),
      currency text NOT NULL,
      interval text NOT NULL CHECK (interval IN ('month','year','once')),
      features jsonb NOT NULL DEFAULT '{}'::jsonb,
      version integer NOT NULL DEFAULT 1,
      active boolean NOT NULL DEFAULT false,
      provider text,
      provider_price_id text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS linguaplay_payments (
      id bigserial PRIMARY KEY,
      provider text NOT NULL,
      provider_payment_id text NOT NULL,
      provider_event_id text NOT NULL UNIQUE,
      account_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      plan_code text REFERENCES linguaplay_plans(code),
      amount_minor integer NOT NULL,
      currency text NOT NULL,
      status text NOT NULL,
      raw_event jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE(provider,provider_payment_id)
    );
    CREATE TABLE IF NOT EXISTS linguaplay_subscriptions (
      id bigserial PRIMARY KEY,
      account_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      provider text NOT NULL,
      provider_subscription_id text NOT NULL UNIQUE,
      plan_code text NOT NULL REFERENCES linguaplay_plans(code),
      status text NOT NULL,
      period_start timestamptz NOT NULL,
      period_end timestamptz NOT NULL,
      cancel_at_period_end boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CHECK(period_end > period_start)
    );
    CREATE TABLE IF NOT EXISTS linguaplay_entitlements (
      id bigserial PRIMARY KEY,
      account_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      source text NOT NULL CHECK (source IN ('subscription','manual_grant','refund')),
      feature text NOT NULL,
      starts_at timestamptz NOT NULL,
      ends_at timestamptz NOT NULL,
      status text NOT NULL CHECK (status IN ('active','inactive','revoked')),
      reference_id text,
      updated_by text REFERENCES "user"(id) ON DELETE SET NULL,
      reason text,
      created_at timestamptz NOT NULL DEFAULT now(),
      CHECK(ends_at > starts_at)
    );
    CREATE INDEX IF NOT EXISTS linguaplay_entitlements_account_idx ON linguaplay_entitlements(account_id,feature,starts_at,ends_at);
    CREATE TABLE IF NOT EXISTS linguaplay_billing_audit (
      id bigserial PRIMARY KEY,
      actor_id text REFERENCES "user"(id) ON DELETE SET NULL,
      target_id text REFERENCES "user"(id) ON DELETE SET NULL,
      action text NOT NULL,
      old_value jsonb NOT NULL DEFAULT '{}'::jsonb,
      new_value jsonb NOT NULL DEFAULT '{}'::jsonb,
      reason text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    ALTER TABLE linguaplay_energy_ledger ADD COLUMN IF NOT EXISTS next_at_after timestamptz;
    ALTER TABLE linguaplay_energy_ledger ADD COLUMN IF NOT EXISTS is_pro boolean NOT NULL DEFAULT false;
    ALTER TABLE linguaplay_energy_accounts ADD COLUMN IF NOT EXISTS energy_cap_version integer NOT NULL DEFAULT 1;
    UPDATE linguaplay_energy_accounts
      SET energy=LEAST(22,GREATEST(0,round(energy::numeric * 22 / 5)::integer)),
          next_at=CASE WHEN energy >= 5 THEN NULL ELSE next_at END,
          energy_cap_version=2,updated_at=now()
      WHERE energy_cap_version < 2;
    ALTER TABLE linguaplay_energy_accounts ALTER COLUMN energy SET DEFAULT 22;
    CREATE INDEX IF NOT EXISTS linguaplay_energy_ledger_user_time_idx ON linguaplay_energy_ledger(user_id,created_at DESC);
  `);

  await pool.query(
    `INSERT INTO linguaplay_energy_accounts(user_id,energy,next_at)
      SELECT id,$1,NULL FROM "user" ON CONFLICT(user_id) DO NOTHING`,
    [energyCap],
  );
  await pool.query(
    `INSERT INTO linguaplay_energy_ledger(user_id,amount,balance_after,next_at_after,reason,idempotency_key)
      SELECT user_id,energy,energy,next_at,'Initial account energy','initial-account-v1' FROM linguaplay_energy_accounts
      ON CONFLICT(user_id,idempotency_key) DO NOTHING`,
  );
  await pool.query(
    `UPDATE linguaplay_user_data
      SET data=data-'linguaplay-energy'-'linguaplay-energy-reward-progress',updated_at=now()
      WHERE data ? 'linguaplay-energy' OR data ? 'linguaplay-energy-reward-progress'`,
  );

  const profiles = await pool.query("SELECT user_id,data FROM linguaplay_user_data");
  for (const row of profiles.rows) {
    const data =
      row.data && typeof row.data === "object" && !Array.isArray(row.data) ? { ...row.data } : {};
    let changed = false;
    for (const key of ["linguaplay-stats-by-space", "linguaplay-user-stats"]) {
      if (typeof data[key] !== "string") continue;
      try {
        const strip = (value) => {
          if (Array.isArray(value)) return value.map(strip);
          if (typeof value === "string") {
            try {
              const parsed = JSON.parse(value);
              if (parsed && typeof parsed === "object") return JSON.stringify(strip(parsed));
            } catch {
              /* Keep plain text values unchanged. */
            }
            return value;
          }
          if (!value || typeof value !== "object") return value;
          return Object.fromEntries(
            Object.entries(value)
              .filter(
                ([field]) =>
                  ![
                    "crystals",
                    "freezeCount",
                    "energy",
                    "entitlement",
                    "isPro",
                    "is_pro",
                    "role",
                  ].includes(field),
              )
              .map(([field, item]) => [field, strip(item)]),
          );
        };
        const sanitized = JSON.stringify(strip(JSON.parse(data[key])));
        if (sanitized !== data[key]) {
          data[key] = sanitized;
          changed = true;
        }
      } catch {
        /* Preserve malformed legacy profiles for manual recovery. */
      }
    }
    if (changed)
      await pool.query(
        "UPDATE linguaplay_user_data SET data=$2::jsonb,updated_at=now() WHERE user_id=$1",
        [row.user_id, JSON.stringify(data)],
      );
  }

  const primaryOwnerEmail =
    process.env.LINGUAPLAY_OWNER_EMAIL?.trim() || "suleymanov.takhir@gmail.com";
  await pool.query(
    `
    INSERT INTO linguaplay_user_roles (user_id, role)
      SELECT id, CASE WHEN role = 'admin' AND $1::boolean = false THEN 'admin' ELSE 'student' END FROM "user"
      ON CONFLICT (user_id) DO NOTHING;
  `,
    [Boolean(primaryOwnerEmail || process.env.VERCEL)],
  );

  if (!process.env.VERCEL && !primaryOwnerEmail) {
    await pool.query(`UPDATE linguaplay_user_roles SET role='owner',updated_at=now() WHERE user_id=(
      SELECT r.user_id FROM linguaplay_user_roles r JOIN "user" u ON u.id=r.user_id
      WHERE r.role IN ('admin','owner') ORDER BY CASE WHEN r.role='owner' THEN 0 ELSE 1 END,u."createdAt" ASC LIMIT 1
    ) AND NOT EXISTS(SELECT 1 FROM linguaplay_user_roles WHERE role='owner')`);
    await pool.query(
      `DELETE FROM "session" WHERE "userId" IN (SELECT id FROM "user" WHERE role='admin' AND id NOT IN (SELECT user_id FROM linguaplay_user_roles WHERE role='owner'))`,
    );
    await pool.query(
      `UPDATE "user" u SET role=CASE WHEN r.role='owner' THEN 'admin' ELSE 'user' END FROM linguaplay_user_roles r WHERE r.user_id=u.id`,
    );
  }
  if (primaryOwnerEmail) {
    const owner = await pool.query(`SELECT id FROM "user" WHERE lower(email)=lower($1) LIMIT 1`, [
      primaryOwnerEmail,
    ]);
    if (owner.rows[0]) {
      const ownerId = owner.rows[0].id;
      await pool.query(
        `
        UPDATE linguaplay_user_roles
        SET role = CASE WHEN user_id=$1 THEN 'owner' WHEN role='owner' THEN 'admin' ELSE role END,
            updated_at=now()
        WHERE user_id=$1 OR role='owner'
      `,
        [ownerId],
      );
      await pool.query(
        `DELETE FROM "session" WHERE "userId"=$1 AND EXISTS(SELECT 1 FROM "user" WHERE id=$1 AND role<>'admin')`,
        [ownerId],
      );
      await pool.query(
        `DELETE FROM "session" WHERE "userId" IN (SELECT id FROM "user" WHERE id<>$1 AND role<>'user')`,
        [ownerId],
      );
      await pool.query(`UPDATE "user" SET role='user' WHERE id<>$1 AND role<>'user'`, [ownerId]);
      await pool.query(`UPDATE "user" SET role='admin' WHERE id=$1`, [ownerId]);
    } else {
      await pool.query(
        `UPDATE linguaplay_user_roles SET role='admin',updated_at=now() WHERE role='owner'`,
      );
      await pool.query(
        `DELETE FROM "session" WHERE "userId" IN (SELECT id FROM "user" WHERE role<>'user')`,
      );
      await pool.query(`UPDATE "user" SET role='user' WHERE role<>'user'`);
      console.warn(
        "Configured owner account is not present in this database branch; other accounts cannot receive owner access and the configured account will be promoted after sign-in.",
      );
    }
  } else if (process.env.VERCEL) {
    await pool.query(
      `UPDATE linguaplay_user_roles SET role='admin',updated_at=now() WHERE role='owner'`,
    );
    await pool.query(
      `DELETE FROM "session" WHERE "userId" IN (SELECT id FROM "user" WHERE role<>'user')`,
    );
    await pool.query(`UPDATE "user" SET role='user' WHERE role<>'user'`);
    console.warn(
      "LINGUAPLAY_OWNER_EMAIL is not configured; owner access remains disabled on Vercel.",
    );
  }
} finally {
  await pool.end();
}
