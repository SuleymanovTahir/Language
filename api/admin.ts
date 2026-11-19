import { auth, pool } from "../src/lib/auth.ts";

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
const flags = ["manageContent", "manageUsers", "viewAnalytics", "manageSettings"] as const;
type Permission = typeof flags[number];
const defaults = (role: string): Record<Permission, boolean> => ({
  manageContent: ["owner", "admin", "editor"].includes(role),
  manageUsers: ["owner", "admin"].includes(role),
  viewAnalytics: ["owner", "admin"].includes(role),
  manageSettings: role === "owner",
});
const text = (value: unknown, max = 300) => typeof value === "string" ? value.slice(0, max) : null;

async function actorFor(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) return null;
  const result = await pool.query("SELECT role, permissions FROM linguaplay_user_roles WHERE user_id=$1", [session.user.id]);
  const row = result.rows[0];
  const role = row?.role ?? (session.user.role === "admin" ? "owner" : "student");
  const permissions = { ...defaults(role), ...(row?.permissions ?? {}) } as Record<Permission, boolean>;
  if (role === "owner") { permissions.manageUsers = true; permissions.manageSettings = true; }
  return { user: session.user, role, permissions };
}

export async function GET(request: Request) {
  const actor = await actorFor(request);
  if (!actor) return json({ error: "Sign in is required." }, 401);
  if (!actor.permissions.manageUsers && !actor.permissions.viewAnalytics) return json({ error: "У вас нет права просматривать пользователей и их прогресс." }, 403);
  const [users, events, active] = await Promise.all([
    pool.query(`SELECT u.id,u.name,u.email,u.image,u.role AS auth_role,u."createdAt" AS created_at,r.role,r.permissions,
      COUNT(e.id)::int AS event_count, COUNT(e.id) FILTER (WHERE e.is_correct = false)::int AS errors,
      MAX(e.created_at) AS last_activity
      FROM "user" u LEFT JOIN linguaplay_user_roles r ON r.user_id=u.id
      LEFT JOIN linguaplay_events e ON e.user_id=u.id GROUP BY u.id,r.role,r.permissions ORDER BY u."createdAt" DESC`),
    pool.query(`SELECT e.id,e.user_id,u.name,e.event_type,e.module_title,e.activity,e.round_index,e.round_total,e.prompt,e.selected_answer,e.correct_answer,e.is_correct,e.created_at
      FROM linguaplay_events e JOIN "user" u ON u.id=e.user_id ORDER BY e.created_at DESC LIMIT 200`),
    pool.query(`SELECT s.user_id,u.name,s.activity_title,s.module_title,s.current_index,s.total,s.updated_at FROM linguaplay_active_sessions s JOIN "user" u ON u.id=s.user_id ORDER BY s.updated_at DESC`),
  ]);
  return json({ users: users.rows.map((row) => ({ ...row, role: row.role ?? (row.auth_role === "admin" ? "admin" : "student"), permissions: row.permissions ?? {} })), events: events.rows, active: active.rows, actor: { id: actor.user.id, role: actor.role, permissions: actor.permissions } });
}

export async function PUT(request: Request) {
  const actor = await actorFor(request);
  if (!actor) return json({ error: "Sign in is required." }, 401);
  if (!actor.permissions.manageUsers) return json({ error: "У вас нет права изменять аккаунты." }, 403);
  let body: { userId?: unknown; role?: unknown; permissions?: unknown };
  try { body = await request.json() as typeof body; } catch { return json({ error: "Invalid JSON payload." }, 400); }
  const userId = text(body.userId, 100);
  const role = text(body.role, 20);
  if (!userId || !["owner", "admin", "editor", "student"].includes(role ?? "")) return json({ error: "Проверьте роль и аккаунт." }, 400);
  if (actor.role !== "owner" && ["owner", "admin"].includes(role!)) return json({ error: "Только владелец может назначать владельцев и администраторов." }, 403);
  const existing = await pool.query("SELECT role FROM linguaplay_user_roles WHERE user_id=$1", [userId]);
  if (!existing.rowCount) return json({ error: "Пользователь не найден." }, 404);
  if (existing.rows[0].role === "owner" && actor.role !== "owner") return json({ error: "Изменять владельца может только владелец." }, 403);
  if (role === "owner" && existing.rows[0].role !== "owner") {
    const owners = await pool.query("SELECT COUNT(*)::int AS count FROM linguaplay_user_roles WHERE role='owner'");
    if (owners.rows[0].count > 0) return json({ error: "Главный владелец уже назначен. Сначала передайте его роль другому аккаунту." }, 409);
  }
  const supplied = body.permissions && typeof body.permissions === "object" ? body.permissions as Record<string, unknown> : {};
  const permissions = Object.fromEntries(flags.map((key) => [key, actor.role === "owner" && typeof supplied[key] === "boolean" ? supplied[key] : defaults(role!)[key]])) as Record<Permission, boolean>;
  if (role === "owner") { permissions.manageUsers = true; permissions.manageSettings = true; }
  await pool.query("BEGIN");
  try {
    if (existing.rows[0].role === "owner" && role !== "owner") {
      const owners = await pool.query("SELECT COUNT(*)::int AS count FROM linguaplay_user_roles WHERE role='owner'");
      if (owners.rows[0].count <= 1) { await pool.query("ROLLBACK"); return json({ error: "Нельзя снять роль у последнего владельца." }, 409); }
    }
    await pool.query("UPDATE linguaplay_user_roles SET role=$2,permissions=$3::jsonb,updated_at=now() WHERE user_id=$1", [userId, role, JSON.stringify(permissions)]);
    await pool.query(`UPDATE "user" SET role=$2 WHERE id=$1`, [userId, ["owner", "admin"].includes(role!) ? "admin" : "user"]);
    await pool.query("COMMIT");
  } catch (error) { await pool.query("ROLLBACK"); throw error; }
  return json({ saved: true });
}

export async function DELETE(request: Request) {
  const actor = await actorFor(request);
  if (!actor) return json({ error: "Sign in is required." }, 401);
  if (!actor.permissions.manageUsers) return json({ error: "У вас нет права удалять аккаунты." }, 403);
  const userId = new URL(request.url).searchParams.get("userId");
  if (!userId || userId === actor.user.id) return json({ error: "Нельзя удалить текущий аккаунт." }, 400);
  const result = await pool.query("SELECT role FROM linguaplay_user_roles WHERE user_id=$1", [userId]);
  if (!result.rowCount) return json({ error: "Пользователь не найден." }, 404);
  if (["owner", "admin"].includes(result.rows[0].role) && actor.role !== "owner") return json({ error: "Администратор может удалять только аккаунты учеников и редакторов." }, 403);
  if (result.rows[0].role === "owner") return json({ error: "Сначала передайте роль владельца другому аккаунту." }, 403);
  await pool.query('DELETE FROM "user" WHERE id=$1', [userId]);
  return json({ deleted: true });
}
