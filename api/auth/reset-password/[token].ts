import { auth } from "../../../src/lib/auth.ts";

// Vercel needs an explicit nested route for Better Auth's reset link callback.
export default { fetch: auth.handler };
