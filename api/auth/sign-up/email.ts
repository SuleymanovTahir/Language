import { auth } from "../../../src/lib/auth.ts";

// Vercel's file-system API routing needs an explicit route for this nested Better Auth endpoint.
export default { fetch: auth.handler };
