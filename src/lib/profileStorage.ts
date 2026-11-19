const legacyClaimKey = "linguaplay-legacy-owner";
let activeUserId: string | null = null;
let syncTimer: number | undefined;
let syncing = false;
let syncAgain = false;

const profilePrefix = (userId: string) => `linguaplay-user-data:${encodeURIComponent(userId)}:`;
const storageKey = (key: string) => activeUserId ? `${profilePrefix(activeUserId)}${key}` : key;

function reportSync(state: "saved" | "error", message = "") {
  window.dispatchEvent(new CustomEvent("linguaplay-sync-status", { detail: { state, message } }));
}

function collectProfileData(userId: string) {
  const prefix = profilePrefix(userId);
  const data: Record<string, string> = {};
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key?.startsWith(prefix)) data[key.slice(prefix.length)] = localStorage.getItem(key) ?? "";
  }
  return data;
}

async function sendProfileData(userId: string) {
  if (activeUserId !== userId) return;
  if (syncing) { syncAgain = true; return; }
  syncing = true;
  try {
    if (activeUserId !== userId) return;
    const response = await fetch("/api/sync", {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: collectProfileData(userId) }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { error?: string };
      throw new Error(body.error || "Не удалось сохранить прогресс на сервере.");
    }
    reportSync("saved");
  } catch (error) {
    reportSync("error", error instanceof Error ? error.message : "Синхронизация не удалась.");
  } finally {
    syncing = false;
    if (syncAgain) { syncAgain = false; if (activeUserId) void sendProfileData(activeUserId); }
  }
}

async function migrateEmbeddedAudio(userId: string) {
  const key = `${profilePrefix(userId)}linguaplay-audio-quizzes`;
  const raw = localStorage.getItem(key);
  if (!raw) return;
  let quizzes: Array<Record<string, unknown>>;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    quizzes = parsed.filter((quiz): quiz is Record<string, unknown> => Boolean(quiz && typeof quiz === "object" && !Array.isArray(quiz)));
  } catch { return; }
  let changed = false;
  for (const quiz of quizzes) {
    if (typeof quiz.audioDataUrl !== "string" || quiz.audioMediaId) continue;
    try {
      const blob = await (await fetch(quiz.audioDataUrl)).blob();
      if (!blob.size || blob.size > 4 * 1024 * 1024) continue;
      const mediaId = `audio-quiz-${crypto.randomUUID?.() ?? Date.now()}`;
      const name = typeof quiz.audioName === "string" ? quiz.audioName : "audio-file";
      const response = await fetch(`/api/media?id=${encodeURIComponent(mediaId)}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": blob.type || "application/octet-stream", "X-Media-Name": encodeURIComponent(name) },
        body: blob,
      });
      if (!response.ok) continue;
      quiz.audioMediaId = mediaId;
      delete quiz.audioDataUrl;
      changed = true;
    } catch { /* Keep the existing in-browser recording if migration cannot reach the server. */ }
  }
  if (changed) localStorage.setItem(key, JSON.stringify(quizzes));
}

function scheduleProfileSync() {
  if (!activeUserId) return;
  window.clearTimeout(syncTimer);
  const userId = activeUserId;
  syncTimer = window.setTimeout(() => void sendProfileData(userId), 850);
}

export function readProfileItem(key: string) {
  return localStorage.getItem(storageKey(key));
}

export function writeProfileItem(key: string, value: string) {
  localStorage.setItem(storageKey(key), value);
  scheduleProfileSync();
}

export function removeProfileItem(key: string) {
  localStorage.removeItem(storageKey(key));
  scheduleProfileSync();
}

export function getActiveProfileId() { return activeUserId; }

export async function activateProfileStorage(userId: string) {
  const response = await fetch("/api/sync", { credentials: "include", cache: "no-store" });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error || "Не удалось загрузить данные личного кабинета.");
  }
  const remote = await response.json() as { data?: Record<string, unknown> };
  const prefix = profilePrefix(userId);
  let hasLocalProfile = false;
  for (let index = 0; index < localStorage.length; index += 1) {
    if (localStorage.key(index)?.startsWith(prefix)) { hasLocalProfile = true; break; }
  }

  if (!hasLocalProfile && !localStorage.getItem(legacyClaimKey)) {
    const legacyItems: Array<[string, string]> = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key?.startsWith("linguaplay-") && key !== legacyClaimKey && !key.startsWith("linguaplay-user-data:")) {
        legacyItems.push([key, localStorage.getItem(key) ?? ""]);
      }
    }
    legacyItems.forEach(([key, value]) => localStorage.setItem(`${prefix}${key}`, value));
    localStorage.setItem(legacyClaimKey, userId);
  }

  const remoteData = remote.data && typeof remote.data === "object" ? remote.data : {};
  const remoteEntries = Object.entries(remoteData).filter((entry): entry is [string, string] => typeof entry[1] === "string");
  remoteEntries.forEach(([key, value]) => {
    if (key.startsWith("linguaplay-")) localStorage.setItem(`${prefix}${key}`, value);
  });
  activeUserId = userId;
  await migrateEmbeddedAudio(userId);
  await sendProfileData(userId);
}

export function deactivateProfileStorage() {
  window.clearTimeout(syncTimer);
  activeUserId = null;
}
