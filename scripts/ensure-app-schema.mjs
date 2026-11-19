import pg from "pg";

const { Pool } = pg;
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required to prepare the application schema.");

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, allowExitOnIdle: true });
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
  `);

  await pool.query(`
    INSERT INTO linguaplay_user_roles (user_id, role)
      SELECT id, CASE WHEN role = 'admin' THEN 'admin' ELSE 'student' END FROM "user"
      ON CONFLICT (user_id) DO NOTHING;
    UPDATE linguaplay_user_roles
      SET role = 'owner', updated_at = now()
      WHERE user_id = (
        SELECT r.user_id FROM linguaplay_user_roles r
        JOIN "user" u ON u.id = r.user_id
        WHERE r.role IN ('admin','owner')
        ORDER BY CASE WHEN r.role = 'owner' THEN 0 ELSE 1 END, u."createdAt" ASC
        LIMIT 1
      )
      AND NOT EXISTS (SELECT 1 FROM linguaplay_user_roles WHERE role = 'owner');
    UPDATE "user" SET role = 'admin'
      WHERE id IN (SELECT user_id FROM linguaplay_user_roles WHERE role IN ('owner','admin'));
  `);

  const primaryOwnerEmail = process.env.LINGUAPLAY_OWNER_EMAIL?.trim();
  if (primaryOwnerEmail) {
    const owner = await pool.query(`SELECT id FROM "user" WHERE lower(email)=lower($1) LIMIT 1`, [primaryOwnerEmail]);
    if (owner.rows[0]) {
      const ownerId = owner.rows[0].id;
      await pool.query(`
        UPDATE linguaplay_user_roles
        SET role = CASE WHEN user_id=$1 THEN 'owner' WHEN role='owner' THEN 'admin' ELSE role END,
            updated_at=now()
        WHERE user_id=$1 OR role='owner'
      `, [ownerId]);
      await pool.query(`UPDATE "user" SET role='admin' WHERE id=$1`, [ownerId]);
    } else {
      console.warn("Configured owner account is not present in this database branch; role will be assigned after sign-in.");
    }
  }
} finally {
  await pool.end();
}
