import { auth } from "../src/lib/auth.ts";
import * as activities from "../src/server/api/activities/start.ts";
import * as activityAnswers from "../src/server/api/activities/answer.ts";
import * as engagement from "../src/server/api/engagement.ts";
import * as guestTrial from "../src/server/api/guest-trial.ts";
import * as profile from "../src/server/api/profile.ts";
import * as sync from "../src/server/api/sync.ts";
import * as gameRatings from "../src/server/api/game-ratings.ts";
import * as leaderboard from "../src/server/api/leaderboard.ts";

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
type RouteHandler = (request: Request) => Promise<Response>;
type RouteTable = Record<string, Partial<Record<Method, RouteHandler>>>;

const routes: RouteTable = {
  "/api/guest-trial": {
    GET: guestTrial.GET,
    POST: guestTrial.POST,
  },
  "/api/profile": { GET: profile.GET },
  "/api/sync": { GET: sync.GET, PUT: sync.PUT },
  "/api/engagement": { GET: engagement.GET, POST: engagement.POST },
  "/api/game-ratings": {
    GET: gameRatings.GET,
    POST: gameRatings.POST,
  },
  "/api/leaderboard": {
    GET: leaderboard.GET,
    POST: leaderboard.POST,
  },
};

async function dispatch(request: Request) {
  const route = new URL(request.url).pathname.replace(/\/+$/, "") || "/";

  if (route === "/api/auth" || route.startsWith("/api/auth/")) return auth.handler(request);

  if (route === "/api/activities/start") {
    if (request.method === "GET") return activities.GET(request);
    if (request.method === "POST") return activities.POST(request);
    return Response.json(
      { error: "Method not allowed." },
      { status: 405, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (route === "/api/activities/answer") {
    if (request.method === "POST") return activityAnswers.POST(request);
    return Response.json(
      { error: "Method not allowed." },
      { status: 405, headers: { "Cache-Control": "no-store" } },
    );
  }

  const endpoint = routes[route];
  if (!endpoint)
    return Response.json(
      { error: "Not found." },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  const handler = endpoint[request.method as Method];
  if (!handler)
    return Response.json(
      { error: "Method not allowed." },
      { status: 405, headers: { "Cache-Control": "no-store" } },
    );
  return handler(request);
}

export const GET = dispatch;
export const POST = dispatch;
export const PUT = dispatch;
export const PATCH = dispatch;
export const DELETE = dispatch;
