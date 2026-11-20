import { pool } from "../../lib/auth.ts";

let learningEventsReady: Promise<void> | null = null;

export async function ensureLearningEvents() {
  learningEventsReady ??= pool
    .query(`CREATE TABLE IF NOT EXISTS linguaplay_learning_events (
    id bigserial PRIMARY KEY,event_key text UNIQUE,user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    session_id text NOT NULL,item_id text NOT NULL,language_code text NOT NULL DEFAULT '',level text NOT NULL DEFAULT '',skill text NOT NULL,topic text NOT NULL DEFAULT '',variant_id text NOT NULL DEFAULT '',
    first_try_correct boolean,attempt_count integer NOT NULL DEFAULT 1,hint_used boolean NOT NULL DEFAULT false,skipped boolean NOT NULL DEFAULT false,
    duration_ms integer,created_at timestamptz NOT NULL DEFAULT now());
    ALTER TABLE linguaplay_learning_events ADD COLUMN IF NOT EXISTS language_code text NOT NULL DEFAULT '';
    ALTER TABLE linguaplay_learning_events ADD COLUMN IF NOT EXISTS level text NOT NULL DEFAULT '';
    CREATE UNIQUE INDEX IF NOT EXISTS linguaplay_learning_events_event_key_idx ON linguaplay_learning_events(event_key) WHERE event_key IS NOT NULL;
    CREATE INDEX IF NOT EXISTS linguaplay_learning_events_user_time_idx ON linguaplay_learning_events(user_id,created_at DESC);`)
    .then(() => undefined)
    .catch((error) => {
      learningEventsReady = null;
      throw error;
    });
  await learningEventsReady;
}
