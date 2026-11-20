import { timingSafeEqual } from "node:crypto";
import { ensureBillingSchema } from "../src/server/api/billingSchema.ts";
import { captureDailyAnalyticsSnapshot } from "../src/server/api/analytics.ts";

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
  await ensureBillingSchema();
  await captureDailyAnalyticsSnapshot();
  return Response.json(
    { snapshot: "saved", retention: "unlimited", deleted: 0 },
    { headers: { "Cache-Control": "no-store" } },
  );
}
