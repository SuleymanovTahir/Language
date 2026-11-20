import { auth, pool } from "../src/lib/auth.ts";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

let schemaEnsured = false;
async function ensureLeaderboardSchema() {
  if (schemaEnsured) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS linguaplay_game_leaderboard (
      id bigserial PRIMARY KEY,
      user_id text,
      user_name text NOT NULL,
      user_email text NOT NULL,
      game_id text NOT NULL,
      module_id integer NOT NULL DEFAULT 1,
      score integer NOT NULL,
      total integer NOT NULL,
      time_seconds integer NOT NULL,
      time_label text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_game_leaderboard_rank ON linguaplay_game_leaderboard (game_id, module_id, score DESC, time_seconds ASC);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_game_leaderboard_user ON linguaplay_game_leaderboard (game_id, module_id, user_email);
  `);
  schemaEnsured = true;
}

export async function GET(request: Request) {
  try {
    await ensureLeaderboardSchema();
    const url = new URL(request.url);
    const gameId = url.searchParams.get("gameId");
    const moduleId = Number(url.searchParams.get("moduleId") || "1");

    if (!gameId) {
      return json({ error: "Missing gameId" }, 400);
    }

    const session = await auth.api.getSession({ headers: request.headers });
    const userEmail = session?.user?.email?.toLowerCase();

    // Query Top 10 entries for this game and module
    // Ranked primarily by score DESC, and secondarily by time_seconds ASC
    const topRes = await pool.query(
      `SELECT id, user_name, user_email, score, total, time_seconds, time_label, created_at
       FROM linguaplay_game_leaderboard
       WHERE game_id = $1 AND module_id = $2
       ORDER BY score DESC, time_seconds ASC, created_at ASC
       LIMIT 10`,
      [gameId, moduleId],
    );

    let userBestRank: number | null = null;
    let userBestEntry: unknown = null;
    if (userEmail) {
      const bestRes = await pool.query(
        `SELECT id, score, time_seconds, time_label, created_at
         FROM linguaplay_game_leaderboard
         WHERE game_id = $1 AND module_id = $2 AND user_email = $3
         ORDER BY score DESC, time_seconds ASC
         LIMIT 1`,
        [gameId, moduleId, userEmail],
      );
      if (bestRes.rows[0]) {
        userBestEntry = bestRes.rows[0];
        const best = bestRes.rows[0];
        const rankRes = await pool.query(
          `SELECT count(*) + 1 as rank
           FROM linguaplay_game_leaderboard
           WHERE game_id = $1 AND module_id = $2
             AND (score > $3 OR (score = $3 AND time_seconds < $4))`,
          [gameId, moduleId, best.score, best.time_seconds],
        );
        userBestRank = Number(rankRes.rows[0]?.rank || 1);
      }
    }

    return json({
      top: topRes.rows,
      userBestRank,
      userBestEntry,
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Error fetching leaderboard" }, 500);
  }
}

export async function POST(request: Request) {
  try {
    await ensureLeaderboardSchema();
    const body = (await request.json().catch(() => ({}))) as {
      gameId?: string;
      moduleId?: number;
      score?: number;
      total?: number;
      timeSeconds?: number;
      timeLabel?: string;
    };

    const gameId = typeof body.gameId === "string" ? body.gameId.trim() : "";
    const moduleId = Number.isInteger(body.moduleId) ? Number(body.moduleId) : 1;
    const score = Number.isInteger(body.score) ? Number(body.score) : 0;
    const total = Number.isInteger(body.total) ? Number(body.total) : 10;
    const timeSeconds = Number.isInteger(body.timeSeconds) ? Math.max(1, Number(body.timeSeconds)) : 10;
    const timeLabel = typeof body.timeLabel === "string" && body.timeLabel.trim()
      ? body.timeLabel.trim()
      : `${Math.floor(timeSeconds / 60)}:${String(timeSeconds % 60).padStart(2, "0")}`;

    if (!gameId) {
      return json({ error: "Missing gameId" }, 400);
    }

    const session = await auth.api.getSession({ headers: request.headers });
    let userId: string | null = null;
    let userName = "Игрок";
    let userEmail = "guest@clickling.local";

    if (session?.user) {
      userId = session.user.id;
      userName = session.user.name || "Пользователь";
      userEmail = session.user.email.toLowerCase();
    } else {
      const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
      userEmail = `guest_${clientIp.replace(/[^a-zA-Z0-9]/g, "_")}@clickling.local`;
      userName = "Гость";
    }

    // Check if user already has an existing score for this game + module
    const existingRes = await pool.query(
      `SELECT id, score, time_seconds FROM linguaplay_game_leaderboard
       WHERE game_id = $1 AND module_id = $2 AND user_email = $3`,
      [gameId, moduleId, userEmail],
    );

    let activeEntryId: number | string | null = null;

    if (existingRes.rows.length > 0) {
      const prev = existingRes.rows[0];
      // Compare if new run is better: more score, or equal score in less time
      const isBetter =
        score > prev.score ||
        (score === prev.score && timeSeconds < prev.time_seconds);

      if (isBetter) {
        // Update user's personal best
        const updateRes = await pool.query(
          `UPDATE linguaplay_game_leaderboard
           SET score = $1, total = $2, time_seconds = $3, time_label = $4, user_name = $5, user_id = $6, created_at = now()
           WHERE id = $7
           RETURNING *`,
          [score, total, timeSeconds, timeLabel, userName, userId, prev.id],
        );
        activeEntryId = updateRes.rows[0]?.id;
      } else {
        activeEntryId = prev.id;
      }
    } else {
      // Insert new entry for user
      const insertRes = await pool.query(
        `INSERT INTO linguaplay_game_leaderboard
           (user_id, user_name, user_email, game_id, module_id, score, total, time_seconds, time_label)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (game_id, module_id, user_email)
         DO UPDATE SET
           score = CASE
             WHEN EXCLUDED.score > linguaplay_game_leaderboard.score
                  OR (EXCLUDED.score = linguaplay_game_leaderboard.score AND EXCLUDED.time_seconds < linguaplay_game_leaderboard.time_seconds)
             THEN EXCLUDED.score ELSE linguaplay_game_leaderboard.score END,
           time_seconds = CASE
             WHEN EXCLUDED.score > linguaplay_game_leaderboard.score
                  OR (EXCLUDED.score = linguaplay_game_leaderboard.score AND EXCLUDED.time_seconds < linguaplay_game_leaderboard.time_seconds)
             THEN EXCLUDED.time_seconds ELSE linguaplay_game_leaderboard.time_seconds END,
           time_label = CASE
             WHEN EXCLUDED.score > linguaplay_game_leaderboard.score
                  OR (EXCLUDED.score = linguaplay_game_leaderboard.score AND EXCLUDED.time_seconds < linguaplay_game_leaderboard.time_seconds)
             THEN EXCLUDED.time_label ELSE linguaplay_game_leaderboard.time_label END,
           user_name = EXCLUDED.user_name,
           created_at = CASE
             WHEN EXCLUDED.score > linguaplay_game_leaderboard.score
                  OR (EXCLUDED.score = linguaplay_game_leaderboard.score AND EXCLUDED.time_seconds < linguaplay_game_leaderboard.time_seconds)
             THEN now() ELSE linguaplay_game_leaderboard.created_at END
         RETURNING *`,
        [userId, userName, userEmail, gameId, moduleId, score, total, timeSeconds, timeLabel],
      );
      activeEntryId = insertRes.rows[0]?.id;
    }

    // STRICT PRUNING: Only keep Top 10 for this game and module, delete the rest!
    await pool.query(
      `DELETE FROM linguaplay_game_leaderboard
       WHERE game_id = $1 AND module_id = $2
         AND id NOT IN (
           SELECT id FROM linguaplay_game_leaderboard
           WHERE game_id = $1 AND module_id = $2
           ORDER BY score DESC, time_seconds ASC, created_at ASC
           LIMIT 10
         )`,
      [gameId, moduleId],
    );

    // Get Top 10 entries after pruning
    const topRes = await pool.query(
      `SELECT id, user_name, user_email, score, total, time_seconds, time_label, created_at
       FROM linguaplay_game_leaderboard
       WHERE game_id = $1 AND module_id = $2
       ORDER BY score DESC, time_seconds ASC, created_at ASC
       LIMIT 10`,
      [gameId, moduleId],
    );

    // Calculate user's current rank
    let userRank: number | null = null;
    const rankIndex = topRes.rows.findIndex((r) => r.user_email === userEmail);
    if (rankIndex >= 0) {
      userRank = rankIndex + 1;
    }

    return json({
      success: true,
      userRank,
      top: topRes.rows,
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Error saving leaderboard entry" }, 500);
  }
}
