import { createHash, randomBytes } from "node:crypto";
import { auth, pool } from "../src/lib/auth.ts";
import { readLimitedRequestBody } from "../src/lib/readLimitedRequestBody.ts";

const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
let schemaReady: Promise<void> | null = null;
async function ensureSchema() {
  schemaReady ??= pool
    .query(`CREATE TABLE IF NOT EXISTS linguaplay_content_shares (
    id bigserial PRIMARY KEY, token_hash text NOT NULL UNIQUE, content_id text NOT NULL REFERENCES linguaplay_content(id) ON DELETE CASCADE,
    created_by text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, expires_at timestamptz NOT NULL,
    max_views integer NOT NULL CHECK (max_views BETWEEN 1 AND 100), view_count integer NOT NULL DEFAULT 0,
    revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
  )`)
    .then(() => undefined)
    .catch((error) => {
      schemaReady = null;
      throw error;
    });
  await schemaReady;
}
async function userFor(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) return null;
  const result = await pool.query("SELECT role FROM linguaplay_user_roles WHERE user_id=$1", [
    session.user.id,
  ]);
  const role = String(result.rows[0]?.role ?? "student");
  return { id: session.user.id, role, canEdit: ["owner", "admin"].includes(role) };
}
const tokenDigest = (token: string) => createHash("sha256").update(token).digest("hex");

export async function GET(request: Request) {
  const token = request.headers.get("x-content-share-token") ?? "";
  if (!token && new URL(request.url).searchParams.get("manage") === "1") {
    const user = await userFor(request);
    if (!user) return json({ error: "Войдите, чтобы просмотреть ссылки." }, 401);
    if (!user.canEdit)
      return json({ error: "Эта операция доступна только редактору контента." }, 403);
    await ensureSchema();
    const shares = await pool.query(
      `SELECT s.id,s.content_id,c.title,s.expires_at,s.max_views,s.view_count,s.revoked_at,s.created_at
      FROM linguaplay_content_shares s JOIN linguaplay_content c ON c.id=s.content_id
      WHERE ($1::boolean OR s.created_by=$2) ORDER BY s.created_at DESC LIMIT 100`,
      [user.role === "owner", user.id],
    );
    return json({ shares: shares.rows });
  }
  if (!/^[A-Za-z0-9_-]{40,80}$/.test(token))
    return json({ error: "Ссылка недействительна или срок её действия закончился." }, 410);
  await ensureSchema();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `SELECT s.id,s.max_views,s.view_count,s.expires_at,s.revoked_at,c.id AS content_id,c.kind,c.language_code,c.level,c.topic,c.title,c.body,c.status
      FROM linguaplay_content_shares s JOIN linguaplay_content c ON c.id=s.content_id WHERE s.token_hash=$1 FOR UPDATE OF s`,
      [tokenDigest(token)],
    );
    const share = result.rows[0];
    if (
      !share ||
      share.revoked_at ||
      new Date(share.expires_at).getTime() <= Date.now() ||
      Number(share.view_count) >= Number(share.max_views) ||
      share.status !== "published"
    ) {
      await client.query("ROLLBACK");
      return json(
        { error: "Ссылка недействительна, отозвана или исчерпала лимит просмотров." },
        410,
      );
    }
    await client.query("UPDATE linguaplay_content_shares SET view_count=view_count+1 WHERE id=$1", [
      share.id,
    ]);
    await client.query("COMMIT");
    return json({
      item: {
        id: share.content_id,
        kind: share.kind,
        languageCode: share.language_code,
        level: share.level,
        topic: share.topic,
        title: share.title,
        body: share.body,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function POST(request: Request) {
  const user = await userFor(request);
  if (!user) return json({ error: "Войдите, чтобы создать ссылку." }, 401);
  if (!user.canEdit)
    return json(
      { error: "Ссылки на материалы может создавать только владелец или администратор." },
      403,
    );
  const raw = await readLimitedRequestBody(request, 4_000);
  if (!raw) return json({ error: "Некорректный запрос." }, 413);
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(new TextDecoder().decode(raw)) as Record<string, unknown>;
  } catch {
    return json({ error: "Некорректный JSON." }, 400);
  }
  const contentId = typeof payload.contentId === "string" ? payload.contentId.slice(0, 80) : "";
  const days = Number.isInteger(payload.days) ? Math.max(1, Math.min(30, Number(payload.days))) : 7;
  const maxViews = Number.isInteger(payload.maxViews)
    ? Math.max(1, Math.min(3, Number(payload.maxViews)))
    : 3;
  if (!contentId) return json({ error: "Не указан материал." }, 400);
  await ensureSchema();
  const exists = await pool.query(
    "SELECT id FROM linguaplay_content WHERE id=$1 AND status='published'",
    [contentId],
  );
  if (!exists.rowCount)
    return json({ error: "Можно делиться только опубликованным материалом." }, 404);
  const token = randomBytes(32).toString("base64url");
  const expiry = new Date(Date.now() + days * 86_400_000).toISOString();
  await pool.query(
    "INSERT INTO linguaplay_content_shares(token_hash,content_id,created_by,expires_at,max_views) VALUES($1,$2,$3,$4,$5)",
    [tokenDigest(token), contentId, user.id, expiry, maxViews],
  );
  await pool
    .query(
      "INSERT INTO linguaplay_admin_audit(actor_id,action,details) VALUES($1,'content-share-create',$2::jsonb)",
      [user.id, JSON.stringify({ contentId, days, maxViews })],
    )
    .catch(() => undefined);
  return json({ token, expiresAt: expiry, maxViews }, 201);
}

export async function DELETE(request: Request) {
  const user = await userFor(request);
  if (!user) return json({ error: "Войдите, чтобы отозвать ссылку." }, 401);
  if (!user.canEdit)
    return json({ error: "Эта операция доступна только редактору контента." }, 403);
  const id = new URL(request.url).searchParams.get("id");
  if (!id || !/^\d+$/.test(id)) return json({ error: "Не указан id ссылки." }, 400);
  await ensureSchema();
  const result = await pool.query(
    `UPDATE linguaplay_content_shares SET revoked_at=now()
     WHERE id=$1 AND revoked_at IS NULL AND ($2::boolean OR created_by=$3)
     RETURNING content_id`,
    [id, user.role === "owner", user.id],
  );
  if (result.rowCount)
    await pool
      .query(
        "INSERT INTO linguaplay_admin_audit(actor_id,action,details) VALUES($1,'content-share-revoke',$2::jsonb)",
        [user.id, JSON.stringify({ shareId: id, contentId: result.rows[0].content_id })],
      )
      .catch(() => undefined);
  return json({ revoked: Boolean(result.rowCount) });
}
