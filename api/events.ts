import { auth, pool } from "../src/lib/auth.ts";
import { readLimitedRequestBody } from "../src/lib/readLimitedRequestBody.ts";
import { ensureLearningEvents } from "../src/server/api/learningEventsSchema.ts";
import {
  ensureAnalyticsSchema,
  getAnalyticsActor,
  saveAnalyticsEvent,
  withVisitorCookie,
} from "../src/server/api/analytics.ts";

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
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return json({ error: "Недопустимый источник." }, 403);
  const session = await auth.api.getSession({ headers: request.headers });
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
      "game-skip",
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

  if (event.analyticsConsent !== true)
    return json({ error: "События аналитики сохраняются только после согласия на аналитику." }, 403);

  const actor = getAnalyticsActor(request);
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
  if (type === "page-view" || type === "target-action") {
    const route = trim(event.route, 40);
    const action = trim(event.action, 80);
    if (
      !route ||
      !allowedRoutes.includes(route) ||
      (type === "target-action" && (!action || !/^[\p{L}\p{N}_-]+$/u.test(action)))
    )
      return json({ error: "Invalid analytics event." }, 400);
  }

  if (!session?.user?.id) {
    await ensureAnalyticsSchema();
    const daily = await pool.query(
      "SELECT COUNT(*)::int AS count FROM linguaplay_analytics_events WHERE visitor_id=$1 AND created_at >= date_trunc('day', now())",
      [actor.visitorId],
    );
    if (daily.rows[0]?.count >= 1000) return json({ error: "Daily activity event limit reached." }, 429);
    const guestAllowedTypes = new Set([
      "page-view",
      "target-action",
      "game-start",
      "game-answer",
      "game-skip",
      "game-progress",
      "game-complete",
      "practice-start",
      "practice-answer",
      "practice-progress",
      "practice-complete",
      "study-answer",
    ]);
    if (!guestAllowedTypes.has(type)) return json({ error: "Unsupported guest event." }, 400);
    try {
      await saveAnalyticsEvent(
        {
          userId: null,
          actor,
          type,
          route: trim(event.route, 40),
          action: trim(event.action, 80),
          activity: trim(event.activity, 180),
          payload: analyticsPayload(event),
        },
      );
      return withVisitorCookie(json({ saved: true }), actor);
    } catch {
      return json({ error: "Unable to save analytics event." }, 503);
    }
  }

  await ensureLearningEvents();
  await ensureAnalyticsSchema();

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('linguaplay-events-user:' || $1))", [
      session.user.id,
    ]);
    const daily = await client.query(
      "SELECT COUNT(*)::int AS count FROM linguaplay_analytics_events WHERE user_id=$1 AND created_at >= date_trunc('day', now())",
      [session.user.id],
    );
    if (daily.rows[0].count >= 1000) {
      await client.query("ROLLBACK");
      return json({ error: "Daily activity event limit reached." }, 429);
    }

    if (type === "page-view" || type === "target-action") {
      const route = trim(event.route, 40);
      const action = trim(event.action, 80);
      await saveAnalyticsEvent(
        {
          userId: session.user.id,
          actor,
          type,
          route,
          action,
          payload: {},
        },
        client,
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
    if (["game-answer", "game-skip", "practice-answer", "study-answer"].includes(type)) {
      const rawSessionId = idText(event.sessionId) ?? idText(event.activityId) ?? "unknown";
      const sessionId = /^[A-Za-z0-9_:\-]{1,120}$/.test(rawSessionId) ? rawSessionId : "unknown";
      const rawItemId =
        idText(event.itemId) ??
        `${idText(event.activityId) ?? "activity"}:${Math.max(0, Number(event.roundIndex) || 0)}`;
      const itemId = /^[A-Za-z0-9_:\-]{1,120}$/.test(rawItemId) ? rawItemId : "unknown";
      const allowedSkills = new Set([
        "vocabulary",
        "grammar",
        "listening",
        "reading",
        "writing",
        "speaking",
      ]);
      const skill =
        typeof event.skill === "string" && allowedSkills.has(event.skill)
          ? event.skill
          : type === "practice-answer" && event.mode === "grammar"
            ? "grammar"
            : "vocabulary";
      const attemptCount =
        event.skipped === true
          ? 0
          : Math.max(
              1,
              Math.min(20, Number.isInteger(event.attemptCount) ? Number(event.attemptCount) : 1),
            );
      const durationMs =
        Number.isInteger(event.durationMs) &&
        Number(event.durationMs) >= 0 &&
        Number(event.durationMs) <= 3_600_000
          ? Number(event.durationMs)
          : null;
      const eventKey =
        typeof event.eventKey === "string" && /^[A-Za-z0-9_:\-]{12,120}$/.test(event.eventKey)
          ? event.eventKey
          : null;
      const languageCode =
        typeof event.languageCode === "string" &&
        /^[a-z]{2}(?:-[a-z]{2})?$/i.test(event.languageCode)
          ? event.languageCode.toLowerCase()
          : "";
      const level =
        typeof event.level === "string" && /^[A-Z0-9–-]{1,20}$/i.test(event.level)
          ? event.level.toUpperCase()
          : "";
      await client.query(
        `INSERT INTO linguaplay_learning_events(event_key,user_id,session_id,item_id,language_code,level,skill,topic,variant_id,first_try_correct,attempt_count,hint_used,skipped,duration_ms)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) ON CONFLICT(event_key) DO NOTHING`,
        [
          eventKey,
          session.user.id,
          sessionId,
          itemId,
          languageCode,
          level,
          skill,
          trim(event.topic, 100) ?? "",
          trim(event.variantId, 80) ?? "",
          event.skipped === true
            ? null
            : typeof event.firstTryCorrect === "boolean"
              ? event.firstTryCorrect
              : typeof event.correct === "boolean"
                ? event.correct
                : null,
          attemptCount,
          event.hintUsed === true,
          event.skipped === true,
          durationMs,
        ],
      );
    }
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
    await saveAnalyticsEvent(
      {
        userId: session.user.id,
        actor,
        type,
        route: trim(event.route, 40),
        action: trim(event.action, 80),
        activity: trim(event.activity, 180),
        payload: analyticsPayload(event),
      },
      client,
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

function analyticsPayload(event: Record<string, unknown>) {
  const allowed = [
    "activityId",
    "itemId",
    "moduleId",
    "moduleTitle",
    "mode",
    "skill",
    "topic",
    "variantId",
    "languageCode",
    "level",
    "roundIndex",
    "roundTotal",
    "durationMs",
    "durationMinutes",
    "correct",
    "firstTryCorrect",
    "attemptCount",
    "hintUsed",
    "skipped",
  ];
  return Object.fromEntries(
    allowed.filter((key) => event[key] !== undefined).map((key) => [key, event[key]]),
  );
}
