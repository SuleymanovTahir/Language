import * as guestTrial from "../src/server/api/guest-trial.ts";
import * as profile from "../src/server/api/profile.ts";
import * as sync from "../src/server/api/sync.ts";

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
};

async function dispatch(request: Request) {
  const route = new URL(request.url).pathname.replace(/\/+$/, "") || "/";
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
