import { auth, pool } from "../src/lib/auth.ts";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

let schemaEnsured = false;
async function ensureRatingsSchema() {
  if (schemaEnsured) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS linguaplay_game_ratings (
      id bigserial PRIMARY KEY,
      user_id text,
      user_name text NOT NULL,
      user_email text NOT NULL,
      game_id text NOT NULL,
      module_id integer NOT NULL DEFAULT 1,
      rating integer NOT NULL CHECK(rating BETWEEN 1 AND 5),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE(user_email, game_id, module_id)
    );
    CREATE INDEX IF NOT EXISTS idx_game_ratings_game ON linguaplay_game_ratings (game_id, module_id);
  `);
  schemaEnsured = true;
}

export async function GET(request: Request) {
  try {
    await ensureRatingsSchema();
    const url = new URL(request.url);
    const gameId = url.searchParams.get("gameId");
    const moduleId = Number(url.searchParams.get("moduleId") || "1");
    const admin = url.searchParams.get("admin") === "true";

    const session = await auth.api.getSession({ headers: request.headers });
    const userEmail = session?.user?.email?.toLowerCase();

    if (admin) {
      // Admin request to see all ratings and averages
      const listRes = await pool.query(`
        SELECT id, user_id, user_name, user_email, game_id, module_id, rating, updated_at
        FROM linguaplay_game_ratings
        ORDER BY updated_at DESC
        LIMIT 100
      `);

      const summaryRes = await pool.query(`
        SELECT game_id, round(avg(rating)::numeric, 1) as avg_rating, count(*) as count
        FROM linguaplay_game_ratings
        GROUP BY game_id
        ORDER BY count DESC
      `);

      return json({
        ratings: listRes.rows,
        summary: summaryRes.rows,
      });
    }

    if (!gameId) {
      return json({ error: "Missing gameId" }, 400);
    }

    // Get stats for this game
    const statsRes = await pool.query(
      `SELECT round(avg(rating)::numeric, 1) as avg_rating, count(*) as total
       FROM linguaplay_game_ratings
       WHERE game_id = $1 AND module_id = $2`,
      [gameId, moduleId],
    );

    let userRating = 0;
    if (userEmail) {
      const userRes = await pool.query(
        `SELECT rating FROM linguaplay_game_ratings
         WHERE user_email = $1 AND game_id = $2 AND module_id = $3`,
        [userEmail, gameId, moduleId],
      );
      if (userRes.rows[0]) {
        userRating = userRes.rows[0].rating;
      }
    }

    const row = statsRes.rows[0];
    return json({
      averageRating: row?.avg_rating ? Number(row.avg_rating) : 0,
      totalRatings: row?.total ? Number(row.total) : 0,
      userRating,
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Error fetching ratings" }, 500);
  }
}

export async function POST(request: Request) {
  try {
    await ensureRatingsSchema();
    const body = (await request.json().catch(() => ({}))) as {
      gameId?: string;
      moduleId?: number;
      rating?: number;
    };

    const gameId = typeof body.gameId === "string" ? body.gameId.trim() : "";
    const moduleId = Number.isInteger(body.moduleId) ? Number(body.moduleId) : 1;
    const rating = Number.isInteger(body.rating) ? Number(body.rating) : 0;

    if (!gameId || rating < 1 || rating > 5) {
      return json({ error: "Некорректная оценка (1-5) или идентификатор игры." }, 400);
    }

    const session = await auth.api.getSession({ headers: request.headers });
    let userId: string | null = null;
    let userName = "Гость";
    let userEmail = "guest@clickling.local";

    if (session?.user) {
      userId = session.user.id;
      userName = session.user.name || "Пользователь";
      userEmail = session.user.email.toLowerCase();
    } else {
      // Use client IP or guest header for pseudo-identity
      const clientIp =
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
      userEmail = `guest_${clientIp.replace(/[^a-zA-Z0-9]/g, "_")}@clickling.local`;
    }

    const query = `
      INSERT INTO linguaplay_game_ratings (user_id, user_name, user_email, game_id, module_id, rating, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, now())
      ON CONFLICT (user_email, game_id, module_id)
      DO UPDATE SET rating = EXCLUDED.rating, updated_at = now()
      RETURNING *;
    `;

    const result = await pool.query(query, [
      userId,
      userName,
      userEmail,
      gameId,
      moduleId,
      rating,
    ]);

    return json({
      success: true,
      rating: result.rows[0].rating,
      message: "Спасибо за оценку игры!",
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Error saving rating" }, 500);
  }
}
