import { auth, ensureInitialAppRole, pool } from "../src/lib/auth.ts";

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
const defaultPermissions = (role: string) => ({
  manageContent: role === "owner" || role === "admin" || role === "editor",
  manageUsers: role === "owner" || role === "admin",
  viewAnalytics: role === "owner" || role === "admin",
  manageSettings: role === "owner",
});

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) return json({ error: "Sign in is required." }, 401);
  await ensureInitialAppRole(session.user.id);
  const result = await pool.query(`
    INSERT INTO linguaplay_user_roles (user_id, role)
    VALUES ($1, $2)
    ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
    RETURNING role, permissions
  `, [session.user.id, session.user.role === "admin" ? "admin" : "student"]);
  const role = result.rows[0]?.role ?? "student";
  const permissions = { ...defaultPermissions(role), ...(result.rows[0]?.permissions ?? {}) };
  if (role === "owner") { permissions.manageUsers = true; permissions.manageSettings = true; }
  return json({ role, permissions });
}
