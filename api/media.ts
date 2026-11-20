import { auth, pool } from "../src/lib/auth.ts";

const MAX_FILE_BYTES = 4 * 1024 * 1024;
const MAX_USER_MEDIA_BYTES = Number(process.env.LINGUAPLAY_MEDIA_USER_QUOTA_BYTES) || 50 * 1024 * 1024;
const MAX_PROJECT_MEDIA_BYTES = Number(process.env.LINGUAPLAY_MEDIA_PROJECT_QUOTA_BYTES) || 500 * 1024 * 1024;
const MAX_USER_MEDIA_FILES = 100;
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

function detectedMime(content: Buffer, declaredMime: string): string | null {
  if (content.length >= 3 && content[0] === 0xff && content[1] === 0xd8 && content[2] === 0xff) return "image/jpeg";
  if (content.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (content.length >= 12 && content.toString("ascii", 0, 4) === "RIFF" && content.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (["GIF87a", "GIF89a"].includes(content.toString("ascii", 0, 6))) return "image/gif";
  if (content.toString("ascii", 0, 3) === "ID3" || (content.length >= 2 && content[0] === 0xff && (content[1] & 0xe0) === 0xe0)) return "audio/mpeg";
  if (content.length >= 12 && content.toString("ascii", 0, 4) === "RIFF" && content.toString("ascii", 8, 12) === "WAVE") return "audio/wav";
  if (content.toString("ascii", 0, 4) === "fLaC") return "audio/flac";
  if (content.toString("ascii", 0, 4) === "OggS") return "audio/ogg";
  if (content.length >= 4 && content.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])) && ["audio/webm", "video/webm"].includes(declaredMime)) return declaredMime;
  if (content.length >= 12 && content.toString("ascii", 4, 8) === "ftyp" && ["audio/mp4", "video/mp4"].includes(declaredMime)) return declaredMime;
  return null;
}

async function readLimitedBody(request: Request): Promise<Buffer | null> {
  if (!request.body) return Buffer.alloc(0);
  const reader = request.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    total += part.value.byteLength;
    if (total > MAX_FILE_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(Buffer.from(part.value));
  }
  return Buffer.concat(chunks, total);
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
  if (detectedMime(row.content, row.mime_type) !== row.mime_type) return json({ error: "This file type is no longer supported." }, 415);
  return new Response(new Uint8Array(row.content), {
    headers: {
      "Content-Type": row.mime_type,
      "Content-Length": String(row.content.length),
      "X-Media-Name": encodeURIComponent(row.file_name),
      "Content-Disposition": "inline",
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
  const rawMime = request.headers.get("content-type")?.split(";")[0]?.toLowerCase() || "application/octet-stream";
  const declaredMime = ({ "image/jpg": "image/jpeg", "audio/x-wav": "audio/wav", "audio/wave": "audio/wav", "audio/x-flac": "audio/flac", "application/ogg": "audio/ogg", "application/x-ogg": "audio/ogg" } as Record<string, string>)[rawMime] ?? rawMime;
  let fileName = "media-file";
  try { fileName = decodeURIComponent(request.headers.get("x-media-name") || fileName).replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 240); }
  catch { return json({ error: "Invalid file name." }, 400); }
  const content = await readLimitedBody(request);
  if (!content || !content.length) return json({ error: "Файл должен быть меньше 4 МБ." }, 413);
  const mimeType = detectedMime(content, declaredMime);
  if (!mimeType || mimeType !== declaredMime) return json({ error: "Поддерживаются JPEG, PNG, WebP, GIF, MP3, WAV, FLAC, OGG, WebM и MP4." }, 415);
  await ensureMediaTable();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(471104, 2)");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('linguaplay-media-user:' || $1))", [ownerId]);
    const existing = await client.query("SELECT octet_length(content)::int AS bytes FROM linguaplay_media WHERE user_id=$1 AND media_id=$2", [ownerId, mediaId]);
    const userTotal = await client.query("SELECT COALESCE(SUM(octet_length(content)),0)::bigint AS bytes,COUNT(*)::int AS files FROM linguaplay_media WHERE user_id=$1", [ownerId]);
    const projectTotal = await client.query("SELECT COALESCE(SUM(octet_length(content)),0)::bigint AS bytes FROM linguaplay_media");
    const oldBytes = Number(existing.rows[0]?.bytes ?? 0);
    const newUserTotal = Number(userTotal.rows[0].bytes) - oldBytes + content.length;
    const newProjectTotal = Number(projectTotal.rows[0].bytes) - oldBytes + content.length;
    if (!existing.rowCount && Number(userTotal.rows[0].files) >= MAX_USER_MEDIA_FILES) {
      await client.query("ROLLBACK");
      return json({ error: "Достигнут лимит количества файлов в аккаунте." }, 429);
    }
    if (newUserTotal > MAX_USER_MEDIA_BYTES || newProjectTotal > MAX_PROJECT_MEDIA_BYTES) {
      await client.query("ROLLBACK");
      return json({ error: "Хранилище медиа заполнено. Удалите ненужные файлы или попробуйте позже." }, 413);
    }
    await client.query(
      `INSERT INTO linguaplay_media (user_id, media_id, mime_type, file_name, content, updated_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (user_id, media_id) DO UPDATE SET mime_type = EXCLUDED.mime_type, file_name = EXCLUDED.file_name, content = EXCLUDED.content, updated_at = now()`,
      [ownerId, mediaId, mimeType, fileName, content],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally { client.release(); }
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
