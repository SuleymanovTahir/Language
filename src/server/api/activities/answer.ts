import { auth, ensureInitialAppRole } from "../../../lib/auth.ts";
import { readLimitedRequestBody } from "../../../lib/readLimitedRequestBody.ts";
import {
  ENERGY_CAP,
  ensureEnergyTables,
  hasPro,
  hasUnlimitedEnergy,
  loadEnergy,
  runWithAccount,
} from "./start.ts";

const REFILL_MS = Math.max(
  1,
  Math.min(1440, Number(process.env.LINGUAPLAY_ENERGY_REFILL_MINUTES ?? 30) || 30),
) * 60_000;
const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  const userId = session?.user?.id;
  if (!userId) return json({ error: "Sign in is required." }, 401);
  await ensureInitialAppRole(userId);

  const bytes = await readLimitedRequestBody(request, 2_000);
  if (!bytes) return json({ error: "Invalid answer request." }, 413);
  let body: Record<string, unknown>;
  try {
    const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!value || typeof value !== "object" || Array.isArray(value))
      return json({ error: "Invalid answer request." }, 400);
    body = value as Record<string, unknown>;
  } catch {
    return json({ error: "Invalid JSON." }, 400);
  }

  const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
  const activityId = typeof body.activityId === "string" ? body.activityId.trim() : "";
  const eventId = typeof body.eventId === "string" ? body.eventId.trim() : "";
  if (
    !/^\d{1,20}$/.test(sessionId) ||
    !/^[\w-]{1,120}$/.test(activityId) ||
    !/^[A-Za-z0-9:_-]{8,100}$/.test(eventId) ||
    typeof body.correct !== "boolean"
  )
    return json({ error: "Invalid answer request." }, 400);

  try {
    await ensureEnergyTables();
    const result = await runWithAccount(userId, async (client) => {
      const previous = await client.query(
        `SELECT correct,bonus,balance_after AS energy,streak FROM linguaplay_energy_answer_events WHERE user_id=$1 AND event_id=$2`,
        [userId, eventId],
      );
      if (previous.rowCount) {
        return {
          energy: Number(previous.rows[0].energy),
          streak: Number(previous.rows[0].streak),
          bonus: Number(previous.rows[0].bonus),
          correct: Boolean(previous.rows[0].correct),
          cap: ENERGY_CAP,
          idempotent: true,
          isPro: await hasPro(client, userId),
          unlimitedEnergy: await hasUnlimitedEnergy(client, userId),
        };
      }

      const started = await client.query(
        `SELECT activity_id FROM linguaplay_energy_ledger WHERE id=$1 AND user_id=$2 AND reason IN ('Activity start','PRO activity','Admin activity')`,
        [sessionId, userId],
      );
      if (!started.rowCount || started.rows[0].activity_id !== activityId)
        return null;

      const snapshot = await loadEnergy(client, userId);
      const run = await client.query(
        `INSERT INTO linguaplay_energy_game_streaks(user_id,session_id,activity_id,streak,awarded)
         VALUES($1,$2,$3,0,'[]'::jsonb) ON CONFLICT(user_id,session_id) DO UPDATE SET updated_at=now()
         RETURNING streak,awarded`,
        [userId, sessionId, activityId],
      );
      const oldStreak = Number(run.rows[0].streak);
      const awarded = Array.isArray(run.rows[0].awarded)
        ? (run.rows[0].awarded as number[]).map(Number)
        : [];
      const streak = body.correct ? oldStreak + 1 : 0;
      let bonus = 0;
      for (const [milestone, amount] of [[3, 1], [5, 1], [10, 1]] as const) {
        if (streak >= milestone && !awarded.includes(milestone)) {
          awarded.push(milestone);
          bonus += amount;
        }
      }
      const isPro = await hasPro(client, userId);
      const unlimitedEnergy = await hasUnlimitedEnergy(client, userId);
      if (isPro || unlimitedEnergy) bonus = 0;
      const energy = Math.min(ENERGY_CAP, snapshot.energy + bonus);
      const nextAt = energy >= ENERGY_CAP ? null : snapshot.nextAt;

      await client.query(
        `UPDATE linguaplay_energy_game_streaks SET streak=$3,awarded=$4::jsonb,updated_at=now() WHERE user_id=$1 AND session_id=$2`,
        [userId, sessionId, streak, JSON.stringify(awarded)],
      );
      if (bonus > 0) {
        await client.query(
          `UPDATE linguaplay_energy_accounts SET energy=$2,next_at=$3,updated_at=now() WHERE user_id=$1`,
          [userId, energy, nextAt],
        );
        await client.query(
          `INSERT INTO linguaplay_energy_ledger(user_id,amount,balance_after,next_at_after,reason,activity_id,idempotency_key,is_pro)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(user_id,idempotency_key) DO NOTHING`,
          [
            userId,
            energy - snapshot.energy,
            energy,
            nextAt,
            `Correct answer streak bonus · ${streak}`,
            activityId,
            `answer-streak:${sessionId}:${eventId}`,
            isPro,
          ],
        );
      }
      await client.query(
        `INSERT INTO linguaplay_energy_answer_events(user_id,event_id,session_id,correct,bonus,balance_after,streak)
         VALUES($1,$2,$3,$4,$5,$6,$7)`,
        [userId, eventId, sessionId, body.correct, Math.max(0, energy - snapshot.energy), energy, streak],
      );
      return {
        energy,
        nextAt,
        now: snapshot.now,
        streak,
        bonus: Math.max(0, energy - snapshot.energy),
        cap: ENERGY_CAP,
        isPro,
        unlimitedEnergy,
        idempotent: false,
      };
    });
    if (!result) return json({ error: "Game session was not found." }, 404);
    return json(result);
  } catch {
    return json({ error: "Unable to record answer." }, 503);
  }
}
