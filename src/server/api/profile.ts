import { auth, ensureInitialAppRole, pool } from "../../lib/auth.ts";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
const defaultPermissions = (role: string) => ({
  manageContent: role === "owner" || role === "admin",
  manageUsers: role === "owner",
  viewAnalytics: role === "owner",
  manageSettings: role === "owner",
});

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) return json({ error: "Sign in is required." }, 401);
  await ensureInitialAppRole(session.user.id);
  const result = await pool.query(
    `
    INSERT INTO linguaplay_user_roles (user_id, role)
    VALUES ($1, $2)
    ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
    RETURNING role, permissions
    `,
    [session.user.id, "student"],
  );
  const role = result.rows[0]?.role ?? "student";
  const rawPerms =
    result.rows[0]?.permissions && typeof result.rows[0]?.permissions === "object"
      ? (result.rows[0].permissions as Record<string, unknown>)
      : {};
  const permissions = { ...defaultPermissions(role), ...rawPerms };
  permissions.manageContent = role === "owner" || role === "admin";
  permissions.manageUsers = role === "owner" || (role === "admin" && Boolean(rawPerms.manageUsers));
  permissions.manageSettings = role === "owner";
  permissions.viewAnalytics = role === "owner" || (role === "admin" && Boolean(rawPerms.viewAnalytics));
  const entitlement = await pool.query(
    `SELECT status,starts_at,ends_at,source FROM (
    SELECT status,starts_at,ends_at,'manual_grant'::text AS source FROM linguaplay_user_entitlements WHERE user_id=$1
    UNION ALL
    SELECT status,starts_at,ends_at,source FROM linguaplay_entitlements WHERE account_id=$1 AND feature='pro'
  ) current_entitlement
  ORDER BY CASE WHEN status='active' AND (starts_at IS NULL OR starts_at<=now()) AND ends_at>now() THEN 0 ELSE 1 END,
    ends_at DESC NULLS LAST LIMIT 1`,
    [session.user.id],
  );
  const pro = entitlement.rows[0];
  const now = Date.now();
  const startsAt = pro?.starts_at ? new Date(pro.starts_at).toISOString() : null;
  const endsAt = pro?.ends_at ? new Date(pro.ends_at).toISOString() : null;
  const isPro =
    pro?.status === "active" &&
    Boolean(endsAt) &&
    (!startsAt || new Date(startsAt).getTime() <= now) &&
    new Date(endsAt!).getTime() > now;
  return json({ role, permissions, isPro, proStartsAt: startsAt, proEndsAt: endsAt });
}
