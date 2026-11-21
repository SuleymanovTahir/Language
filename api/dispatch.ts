import { auth } from "../src/lib/auth.ts";
import * as activities from "../src/server/api/activities/start.ts";
import * as activityAnswers from "../src/server/api/activities/answer.ts";

async function requestAtPath(request: Request, path: string) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const protocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
  const fallback = host ? `${protocol}://${host}` : process.env.BETTER_AUTH_URL;
  const url = new URL(request.url, fallback);
  url.pathname = `/api/${path}`;
  url.searchParams.delete("__route");
  url.searchParams.delete("tail");
  const init: RequestInit = {
    method: request.method,
    headers: request.headers,
    redirect: request.redirect,
    signal: request.signal,
  };
  if (request.method !== "GET" && request.method !== "HEAD")
    init.body = await request.arrayBuffer();
  return new Request(url, init);
}

async function dispatch(request: Request) {
  const currentUrl = new URL(request.url, process.env.BETTER_AUTH_URL || "https://localhost");
  const path = currentUrl.searchParams.get("__route")?.replace(/^\/+|\/+$/g, "");
  if (!path)
    return Response.json(
      { error: "Not found." },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );

  const forwarded = await requestAtPath(request, path);
  if (path.startsWith("auth/")) return auth.handler(forwarded);
  if (path === "activities/start") {
    if (request.method === "GET") return activities.GET(forwarded);
    if (request.method === "POST") return activities.POST(forwarded);
    return Response.json(
      { error: "Method not allowed." },
      { status: 405, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (path === "activities/answer") {
    if (request.method === "POST") return activityAnswers.POST(forwarded);
    return Response.json(
      { error: "Method not allowed." },
      { status: 405, headers: { "Cache-Control": "no-store" } },
    );
  }

  return Response.json(
    { error: "Not found." },
    { status: 404, headers: { "Cache-Control": "no-store" } },
  );
}

export default { fetch: dispatch };
