import { timingSafeEqual } from "node:crypto";
import { pool } from "../src/lib/auth.ts";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization") ?? "";
  const expected = secret ? `Bearer ${secret}` : "";
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(authorization);
  if (
    !secret ||
    expectedBytes.length !== suppliedBytes.length ||
    !timingSafeEqual(expectedBytes, suppliedBytes)
  ) {
    return Response.json(
      { error: "Not found." },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }
  const result = await pool.query(
    "DELETE FROM linguaplay_events WHERE created_at < now() - interval '90 days'",
  );
  await pool.query(
    "DELETE FROM linguaplay_ai_assessments WHERE created_at < now() - interval '13 months'",
  );
  await pool.query(
    "UPDATE linguaplay_ai_assessments SET result=NULL WHERE created_at < now() - interval '24 hours' AND result IS NOT NULL",
  );
  await pool.query(
    "DELETE FROM linguaplay_guest_ip_trials WHERE updated_at < now() - interval '90 days'",
  );
  await pool.query(
    "DELETE FROM linguaplay_guest_trials WHERE blocked_until < now() - interval '90 days'",
  );
  await pool.query(
    "DELETE FROM linguaplay_provider_usage WHERE updated_at < now() - interval '13 months'",
  );
  return Response.json(
    { deleted: result.rowCount ?? 0 },
    { headers: { "Cache-Control": "no-store" } },
  );
}
