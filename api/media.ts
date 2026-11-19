import { auth, pool } from "../src/lib/auth.ts";

const MAX_FILE_BYTES = 4 * 1024 * 1024;
let mediaTableReady: Promise<void> | null = null;

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

async function userId(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user?.id ?? null;
}

async function ensureMediaTable() {
  mediaTableReady ??= pool.query(`
    CREATE TABLE IF NOT EXISTS linguaplay_media (
      user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      media_id text NOT NULL,
      mime_type text NOT NULL DEFAULT 'application/octet-stream',
      file_name text NOT NULL DEFAULT 'media-file',
      content bytea NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, media_id)
    )
  `).then(() => undefined).catch((error) => { mediaTableReady = null; throw error; });
  await mediaTableReady;
}

export async function GET(request: Request) {
  const ownerId = await userId(request);
  if (!ownerId) return json({ error: "Sign in is required." }, 401);
  const mediaId = new URL(request.url).searchParams.get("id");
  if (!mediaId) return json({ error: "Missing media id." }, 400);
  await ensureMediaTable();
  const result = await pool.query("SELECT mime_type, file_name, content FROM linguaplay_media WHERE user_id = $1 AND media_id = $2", [ownerId, mediaId]);
  const row = result.rows[0] as { mime_type: string; file_name: string; content: Buffer } | undefined;
  if (!row) return json({ error: "File not found." }, 404);
  return new Response(new Uint8Array(row.content), {
    headers: {
      "Content-Type": row.mime_type,
      "Content-Length": String(row.content.length),
      "X-Media-Name": encodeURIComponent(row.file_name),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function PUT(request: Request) {
  const ownerId = await userId(request);
  if (!ownerId) return json({ error: "Sign in is required." }, 401);
  const mediaId = new URL(request.url).searchParams.get("id");
  if (!mediaId) return json({ error: "Missing media id." }, 400);
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_FILE_BYTES) return json({ error: "Файл должен быть меньше 4 МБ." }, 413);
  const mimeType = request.headers.get("content-type")?.split(";")[0] || "application/octet-stream";
  let fileName = "media-file";
  try { fileName = decodeURIComponent(request.headers.get("x-media-name") || fileName).slice(0, 240); }
  catch { return json({ error: "Invalid file name." }, 400); }
  const content = Buffer.from(await request.arrayBuffer());
  if (!content.length || content.length > MAX_FILE_BYTES) return json({ error: "Файл должен быть меньше 4 МБ." }, 413);
  await ensureMediaTable();
  await pool.query(
    `INSERT INTO linguaplay_media (user_id, media_id, mime_type, file_name, content, updated_at)
     VALUES ($1, $2, $3, $4, $5, now())
     ON CONFLICT (user_id, media_id) DO UPDATE SET mime_type = EXCLUDED.mime_type, file_name = EXCLUDED.file_name, content = EXCLUDED.content, updated_at = now()`,
    [ownerId, mediaId, mimeType, fileName, content],
  );
  return json({ saved: true });
}

export async function DELETE(request: Request) {
  const ownerId = await userId(request);
  if (!ownerId) return json({ error: "Sign in is required." }, 401);
  const mediaId = new URL(request.url).searchParams.get("id");
  if (!mediaId) return json({ error: "Missing media id." }, 400);
  await ensureMediaTable();
  await pool.query("DELETE FROM linguaplay_media WHERE user_id = $1 AND media_id = $2", [ownerId, mediaId]);
  return json({ deleted: true });
}
