import { createHash, randomBytes, randomUUID } from "node:crypto";
import { auth, pool } from "../src/lib/auth.ts";
import { readLimitedRequestBody } from "../src/lib/readLimitedRequestBody.ts";

type ContentKind = "module" | "lesson" | "activity" | "audio_quiz" | "grammar" | "mission";
const kinds = new Set<ContentKind>(["module", "lesson", "activity", "audio_quiz", "grammar", "mission"]);
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
let schemaReady: Promise<void> | null = null;
async function ensureSchema() {
  schemaReady ??= pool.query(`CREATE TABLE IF NOT EXISTS linguaplay_content (
    id text PRIMARY KEY, kind text NOT NULL CHECK (kind IN ('module','lesson','activity','audio_quiz','grammar','mission')),
    language_code text NOT NULL, level text NOT NULL, topic text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
    title text NOT NULL, body jsonb NOT NULL DEFAULT '{}'::jsonb, created_by text NOT NULL REFERENCES "user"(id), updated_by text NOT NULL REFERENCES "user"(id),
    created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), published_at timestamptz, archived_at timestamptz
  ); CREATE INDEX IF NOT EXISTS linguaplay_content_catalog_idx ON linguaplay_content(status,language_code,level,kind,updated_at DESC);`).then(() => undefined).catch((error) => { schemaReady = null; throw error; });
  await schemaReady;
}
async function currentUser(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) return null;
  const result = await pool.query("SELECT role FROM linguaplay_user_roles WHERE user_id=$1", [session.user.id]);
  return { id: session.user.id, role: String(result.rows[0]?.role ?? "student") };
}
const canEdit = (user: { role: string } | null) => Boolean(user && ["owner", "admin"].includes(user.role));
function parseBody(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const item = body as Record<string, unknown>;
  const kind = typeof item.kind === "string" ? item.kind as ContentKind : "";
  const languageCode = typeof item.languageCode === "string" ? item.languageCode.trim().toLowerCase().slice(0, 12) : "";
  const level = typeof item.level === "string" ? item.level.trim().slice(0, 20) : "";
  const topic = typeof item.topic === "string" ? item.topic.trim().slice(0, 100) : "";
  const title = typeof item.title === "string" ? item.title.trim().slice(0, 160) : "";
  const status = item.status === "published" ? "published" : item.status === "archived" ? "archived" : "draft";
  const content = item.body && typeof item.body === "object" && !Array.isArray(item.body) ? item.body : {};
  if (!kinds.has(kind) || !/^[a-z]{2}(?:-[a-z]{2})?$/.test(languageCode) || !level || !title || JSON.stringify(content).length > 180_000) return null;
  return { kind, languageCode, level, topic, title, status, content };
}
function mapRow(row: Record<string, any>) {
  return { id: row.id, kind: row.kind, languageCode: row.language_code, level: row.level, topic: row.topic, title: row.title, body: row.body, status: row.status, updatedAt: row.updated_at, publishedAt: row.published_at };
}

export async function GET(request: Request) {
  await ensureSchema();
  const user = await currentUser(request);
  const url = new URL(request.url);
  const preview = canEdit(user) && url.searchParams.get("preview") === "1";
  const language = (url.searchParams.get("language") ?? "").trim().toLowerCase();
  const level = (url.searchParams.get("level") ?? "").trim().slice(0, 20);
  const values: unknown[] = [];
  const where = [preview ? "status <> 'archived'" : "status='published'"];
  if (language) { values.push(language); where.push(`language_code=$${values.length}`); }
  if (level) { values.push(level); where.push(`level=$${values.length}`); }
  const result = await pool.query(`SELECT id,kind,language_code,level,topic,title,body,status,updated_at,published_at FROM linguaplay_content WHERE ${where.join(" AND ")} ORDER BY updated_at DESC LIMIT 300`, values);
  return json({ items: result.rows.map(mapRow), canEdit: canEdit(user) });
}

export async function POST(request: Request) {
  const user = await currentUser(request);
  if (!user) return json({ error: "Войдите, чтобы сохранить материал." }, 401);
  if (!canEdit(user)) return json({ error: "Создавать общий контент могут только владелец и администратор." }, 403);
  const raw = await readLimitedRequestBody(request, 200_000);
  if (!raw) return json({ error: "Материал слишком большой (лимит 200 КБ)." }, 413);
  let payload: unknown; try { payload = JSON.parse(new TextDecoder().decode(raw)); } catch { return json({ error: "Некорректный JSON." }, 400); }
  const item = parseBody(payload);
  if (!item) return json({ error: "Проверьте вид, язык, уровень, название и содержимое материала." }, 400);
  await ensureSchema();
  const id = randomUUID();
  const result = await pool.query(`INSERT INTO linguaplay_content(id,kind,language_code,level,topic,status,title,body,created_by,updated_by,published_at,archived_at)
    VALUES($1,$2,$3,$4,$5,'draft',$6,$7::jsonb,$8,$8,NULL,NULL) RETURNING id,kind,language_code,level,topic,title,body,status,updated_at,published_at`,
  [id,item.kind,item.languageCode,item.level,item.topic,item.title,JSON.stringify(item.content),user.id]);
  return json({ item: mapRow(result.rows[0]) }, 201);
}

export async function PATCH(request: Request) {
  const user = await currentUser(request);
  if (!user) return json({ error: "Войдите, чтобы изменить материал." }, 401);
  if (!canEdit(user)) return json({ error: "Эта операция доступна только редактору контента." }, 403);
  const id = new URL(request.url).searchParams.get("id")?.slice(0, 80);
  if (!id) return json({ error: "Не указан id материала." }, 400);
  const raw = await readLimitedRequestBody(request, 200_000);
  if (!raw) return json({ error: "Материал слишком большой." }, 413);
  let payload: unknown; try { payload = JSON.parse(new TextDecoder().decode(raw)); } catch { return json({ error: "Некорректный JSON." }, 400); }
  const item = parseBody(payload);
  if (!item) return json({ error: "Проверьте поля материала." }, 400);
  await ensureSchema();
  const publishedAt = item.status === "published" ? "COALESCE(published_at,now())" : "published_at";
  const archivedAt = item.status === "archived" ? "now()" : "NULL";
  const result = await pool.query(`UPDATE linguaplay_content SET kind=$2,language_code=$3,level=$4,topic=$5,status=$6,title=$7,body=$8::jsonb,updated_by=$9,updated_at=now(),published_at=${publishedAt},archived_at=${archivedAt}
    WHERE id=$1 RETURNING id,kind,language_code,level,topic,title,body,status,updated_at,published_at`,
  [id,item.kind,item.languageCode,item.level,item.topic,item.status,item.title,JSON.stringify(item.content),user.id]);
  if (!result.rowCount) return json({ error: "Материал не найден." }, 404);
  await pool.query("INSERT INTO linguaplay_admin_audit(actor_id,action,details) VALUES($1,'content-update',$2::jsonb)", [user.id,JSON.stringify({ contentId: id, status: item.status })]).catch(() => undefined);
  return json({ item: mapRow(result.rows[0]) });
}

export async function DELETE(request: Request) {
  const user = await currentUser(request);
  if (!user) return json({ error: "Войдите, чтобы архивировать материал." }, 401);
  if (!canEdit(user)) return json({ error: "Эта операция доступна только редактору контента." }, 403);
  const id = new URL(request.url).searchParams.get("id")?.slice(0, 80);
  if (!id) return json({ error: "Не указан id материала." }, 400);
  await ensureSchema();
  const result = await pool.query("UPDATE linguaplay_content SET status='archived',archived_at=now(),updated_at=now(),updated_by=$2 WHERE id=$1 AND status<>'archived' RETURNING id", [id,user.id]);
  return result.rowCount ? json({ archived: true }) : json({ error: "Материал не найден." }, 404);
}
