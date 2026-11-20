import { auth, pool } from "../src/lib/auth.ts";
import { readLimitedRequestBody } from "../src/lib/readLimitedRequestBody.ts";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
const trim = (value: unknown, limit = 300) =>
  typeof value === "string" ? value.slice(0, limit) : null;
const idText = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? String(value) : trim(value, 120);

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) return json({ error: "Sign in is required." }, 401);
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 12_000) return json({ error: "Event payload is too large." }, 413);
  const bytes = await readLimitedRequestBody(request, 12_000);
  if (!bytes) return json({ error: "Event payload is too large." }, 413);
  const raw = new TextDecoder().decode(bytes);
  let event: Record<string, unknown>;
  try {
    event = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return json({ error: "Invalid JSON payload." }, 400);
  }
  const type = trim(event.type, 40);
  if (
    !type ||
    ![
      "game-start",
      "game-answer",
      "game-progress",
      "game-complete",
      "practice-start",
      "practice-answer",
      "practice-progress",
      "practice-complete",
      "study-answer",
      "page-view",
      "target-action",
    ].includes(type)
  )
    return json({ error: "Unsupported event." }, 400);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('linguaplay-events-user:' || $1))", [
      session.user.id,
    ]);
    const daily = await client.query(
      "SELECT COUNT(*)::int AS count FROM linguaplay_events WHERE user_id=$1 AND created_at >= date_trunc('day', now())",
      [session.user.id],
    );
    if (daily.rows[0].count >= 1000) {
      await client.query("ROLLBACK");
      return json({ error: "Daily activity event limit reached." }, 429);
    }

    if (type === "page-view" || type === "target-action") {
      const route = trim(event.route, 40);
      const action = trim(event.action, 80);
      const allowedRoutes = [
        "today",
        "library",
        "path",
        "materials",
        "games",
        "stats",
        "admin",
        "analytics",
      ];
      if (
        !route ||
        !allowedRoutes.includes(route) ||
        (type === "target-action" && (!action || !/^[\p{L}\p{N}_-]+$/u.test(action)))
      ) {
        await client.query("ROLLBACK");
        return json({ error: "Invalid analytics event." }, 400);
      }
      await client.query(
        `
      INSERT INTO linguaplay_events (user_id,event_type,activity,payload)
      VALUES ($1,$2,$3,$4::jsonb)
    `,
        [
          session.user.id,
          type,
          type === "target-action" ? action : route,
          JSON.stringify(type === "target-action" ? { route, action } : { route }),
        ],
      );
      await client.query("COMMIT");
      return json({ saved: true });
    }

    if (
      [
        "game-start",
        "game-progress",
        "game-answer",
        "practice-start",
        "practice-progress",
        "practice-answer",
      ].includes(type)
    ) {
      const activityType = type.startsWith("game-") ? "game" : "practice";
      await client.query(
        `
      INSERT INTO linguaplay_active_sessions (user_id, activity_type, activity_id, activity_title, module_id, module_title, current_index, total, updated_at)
      VALUES ($1, $8, $2, $3, $4, $5, $6, $7, now())
      ON CONFLICT (user_id) DO UPDATE SET activity_type = EXCLUDED.activity_type, activity_id = EXCLUDED.activity_id,
      activity_title = EXCLUDED.activity_title, module_id = EXCLUDED.module_id, module_title = EXCLUDED.module_title,
      current_index = EXCLUDED.current_index, total = EXCLUDED.total, updated_at = now()
    `,
        [
          session.user.id,
          idText(event.activityId),
          trim(event.activity, 180) ?? (activityType === "game" ? "Игра" : "Упражнение"),
          idText(event.moduleId),
          trim(event.moduleTitle, 180),
          Math.max(0, Number(event.roundIndex) || 0),
          Math.max(0, Number(event.roundTotal) || 0),
          activityType,
        ],
      );
    }
    if (type === "game-complete" || type === "practice-complete")
      await client.query("DELETE FROM linguaplay_active_sessions WHERE user_id = $1", [
        session.user.id,
      ]);
    const roundIndex = Number.isInteger(event.roundIndex) ? Number(event.roundIndex) : null;
    const roundTotal = Number.isInteger(event.roundTotal) ? Number(event.roundTotal) : null;
    if (
      (roundIndex !== null && (roundIndex < 0 || roundIndex > 1000)) ||
      (roundTotal !== null && (roundTotal < 0 || roundTotal > 1000))
    ) {
      await client.query("ROLLBACK");
      return json({ error: "Invalid activity progress." }, 400);
    }
    await client.query(
      `
    INSERT INTO linguaplay_events (user_id, event_type, module_id, module_title, activity, round_index, round_total, is_correct, payload)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
  `,
      [
        session.user.id,
        type,
        idText(event.moduleId),
        trim(event.moduleTitle, 180),
        trim(event.activity, 180),
        roundIndex,
        roundTotal,
        typeof event.correct === "boolean" ? event.correct : null,
        JSON.stringify({
          mode: trim(event.mode, 40),
          activityId: idText(event.activityId),
          itemId: idText(event.itemId),
        }),
      ],
    );
    await client.query("COMMIT");
    return json({ saved: true });
  } catch {
    await client.query("ROLLBACK").catch(() => undefined);
    return json({ error: "Unable to save activity event." }, 503);
  } finally {
    client.release();
  }
}
