import { auth, pool } from "../src/lib/auth.ts";

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
const trim = (value: unknown, limit = 300) => typeof value === "string" ? value.slice(0, limit) : null;
const idText = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? String(value) : trim(value, 120);

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) return json({ error: "Sign in is required." }, 401);
  let event: Record<string, unknown>;
  try { event = await request.json() as Record<string, unknown>; } catch { return json({ error: "Invalid JSON payload." }, 400); }
  const type = trim(event.type, 40);
  if (!type || !["game-start", "game-answer", "game-progress", "game-complete", "practice-start", "practice-answer", "practice-progress", "practice-complete", "study-answer"].includes(type)) return json({ error: "Unsupported event." }, 400);

  if (["game-start", "game-progress", "game-answer", "practice-start", "practice-progress", "practice-answer"].includes(type)) {
    const activityType = type.startsWith("game-") ? "game" : "practice";
    await pool.query(`
      INSERT INTO linguaplay_active_sessions (user_id, activity_type, activity_id, activity_title, module_id, module_title, current_index, total, updated_at)
      VALUES ($1, $8, $2, $3, $4, $5, $6, $7, now())
      ON CONFLICT (user_id) DO UPDATE SET activity_type = EXCLUDED.activity_type, activity_id = EXCLUDED.activity_id,
      activity_title = EXCLUDED.activity_title, module_id = EXCLUDED.module_id, module_title = EXCLUDED.module_title,
      current_index = EXCLUDED.current_index, total = EXCLUDED.total, updated_at = now()
    `, [session.user.id, idText(event.activityId), trim(event.activity, 180) ?? (activityType === "game" ? "Игра" : "Упражнение"), idText(event.moduleId), trim(event.moduleTitle, 180), Math.max(0, Number(event.roundIndex) || 0), Math.max(0, Number(event.roundTotal) || 0), activityType]);
  }
  if (type === "game-complete" || type === "practice-complete") await pool.query("DELETE FROM linguaplay_active_sessions WHERE user_id = $1", [session.user.id]);
  await pool.query(`
    INSERT INTO linguaplay_events (user_id, event_type, module_id, module_title, activity, round_index, round_total, prompt, selected_answer, correct_answer, is_correct, payload)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)
  `, [session.user.id, type, idText(event.moduleId), trim(event.moduleTitle, 180), trim(event.activity, 180), Number.isInteger(event.roundIndex) ? event.roundIndex : null, Number.isInteger(event.roundTotal) ? event.roundTotal : null, trim(event.prompt), trim(event.selectedAnswer), trim(event.correctAnswer), typeof event.correct === "boolean" ? event.correct : null, JSON.stringify({ mode: trim(event.mode, 40), activityId: idText(event.activityId), itemId: idText(event.itemId) })]);
  return json({ saved: true });
}
