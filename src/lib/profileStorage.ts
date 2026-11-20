const legacyClaimKey = "linguaplay-legacy-owner";
let activeUserId: string | null = null;
let syncTimer: number | undefined;
let syncing = false;
let syncAgain = false;
let profileVersions: Record<string, number> = {};
let pendingProfileKeys = new Set<string>();

const profilePrefix = (userId: string) => `linguaplay-user-data:${encodeURIComponent(userId)}:`;
const storageKey = (key: string) => (activeUserId ? `${profilePrefix(activeUserId)}${key}` : key);
const serverManagedKeys = new Set(["linguaplay-energy", "linguaplay-energy-reward-progress"]);
const displayOnlyStatsKeys = new Set(["linguaplay-stats-by-space", "linguaplay-user-stats"]);

function withoutDisplayOnlyStats(raw: string) {
  try {
    const strip = (value: unknown): unknown => {
      if (Array.isArray(value)) return value.map(strip);
      if (typeof value === "string") {
        try {
          const parsed: unknown = JSON.parse(value);
          if (parsed && typeof parsed === "object") return JSON.stringify(strip(parsed));
        } catch {
          /* Keep plain text values unchanged. */
        }
        return value;
      }
      if (!value || typeof value !== "object") return value;
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .filter(
            ([key]) =>
              ![
                "crystals",
                "freezeCount",
                "energy",
                "entitlement",
                "isPro",
                "is_pro",
                "role",
              ].includes(key),
          )
          .map(([key, item]) => [key, strip(item)]),
      );
    };
    return JSON.stringify(strip(JSON.parse(raw)));
  } catch {
    return raw;
  }
}

function reportSync(state: "saved" | "error", message = "") {
  window.dispatchEvent(new CustomEvent("linguaplay-sync-status", { detail: { state, message } }));
}

function collectProfileData(userId: string) {
  const prefix = profilePrefix(userId);
  const data: Record<string, string> = {};
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key?.startsWith(prefix)) {
      const profileKey = key.slice(prefix.length);
      if (!serverManagedKeys.has(profileKey)) {
        const value = localStorage.getItem(key) ?? "";
        data[profileKey] = displayOnlyStatsKeys.has(profileKey)
          ? withoutDisplayOnlyStats(value)
          : value;
      }
    }
  }
  return data;
}

async function sendProfileData(userId: string) {
  if (activeUserId !== userId) return;
  if (syncing) {
    syncAgain = true;
    return;
  }
  if (!pendingProfileKeys.size) return;
  syncing = true;
  try {
    if (activeUserId !== userId) return;
    const keys = [...pendingProfileKeys];
    const patch: Record<string, string | null> = {};
    const sentValues: Record<string, string | null> = {};
    for (const key of keys) {
      const value = localStorage.getItem(`${profilePrefix(userId)}${key}`);
      const safeValue =
        value === null
          ? null
          : displayOnlyStatsKeys.has(key)
            ? withoutDisplayOnlyStats(value)
            : value;
      patch[key] = safeValue;
      sentValues[key] = safeValue;
    }
    const response = await fetch("/api/sync", {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patch,
        versions: Object.fromEntries(keys.map((key) => [key, profileVersions[key] ?? 0])),
      }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error || "Не удалось сохранить прогресс на сервере.");
    }
    const result = (await response.json()) as {
      data?: Record<string, string>;
      versions?: Record<string, number>;
      conflicts?: string[];
    };
    if (result.versions) profileVersions = { ...profileVersions, ...result.versions };
    const conflicts = new Set(result.conflicts ?? []);
    for (const key of keys) {
      const current = localStorage.getItem(`${profilePrefix(userId)}${key}`);
      const safeCurrent =
        current === null
          ? null
          : displayOnlyStatsKeys.has(key)
            ? withoutDisplayOnlyStats(current)
            : current;
      if (safeCurrent === sentValues[key]) pendingProfileKeys.delete(key);
      if (conflicts.has(key)) {
        const merged = result.data?.[key];
        if (typeof merged === "string")
          localStorage.setItem(`${profilePrefix(userId)}${key}`, merged);
        else localStorage.removeItem(`${profilePrefix(userId)}${key}`);
        pendingProfileKeys.delete(key);
        window.dispatchEvent(
          new CustomEvent("linguaplay-profile-reconciled", {
            detail: { key, value: merged ?? null },
          }),
        );
      }
    }
    reportSync(
      conflicts.size ? "error" : "saved",
      conflicts.size
        ? "Изменения на разных устройствах объединены. Проверьте актуальные данные в приложении."
        : "",
    );
  } catch (error) {
    reportSync("error", error instanceof Error ? error.message : "Синхронизация не удалась.");
  } finally {
    syncing = false;
    if (syncAgain) {
      syncAgain = false;
      if (activeUserId) void sendProfileData(activeUserId);
    }
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
    quizzes = parsed.filter((quiz): quiz is Record<string, unknown> =>
      Boolean(quiz && typeof quiz === "object" && !Array.isArray(quiz)),
    );
  } catch {
    return;
  }
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
        headers: {
          "Content-Type": blob.type || "application/octet-stream",
          "X-Media-Name": encodeURIComponent(name),
        },
        body: blob,
      });
      if (!response.ok) continue;
      quiz.audioMediaId = mediaId;
      delete quiz.audioDataUrl;
      changed = true;
    } catch {
      /* Keep the existing in-browser recording if migration cannot reach the server. */
    }
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
  if (activeUserId && !serverManagedKeys.has(key)) pendingProfileKeys.add(key);
  scheduleProfileSync();
}

export function removeProfileItem(key: string) {
  localStorage.removeItem(storageKey(key));
  if (activeUserId && !serverManagedKeys.has(key)) pendingProfileKeys.add(key);
  scheduleProfileSync();
}

export function getActiveProfileId() {
  return activeUserId;
}

export async function activateProfileStorage(userId: string) {
  const response = await fetch("/api/sync", { credentials: "include", cache: "no-store" });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || "Не удалось загрузить данные личного кабинета.");
  }
  const remote = (await response.json()) as {
    data?: Record<string, unknown>;
    versions?: Record<string, number>;
  };
  const prefix = profilePrefix(userId);
  let hasLocalProfile = false;
  for (let index = 0; index < localStorage.length; index += 1) {
    if (localStorage.key(index)?.startsWith(prefix)) {
      hasLocalProfile = true;
      break;
    }
  }

  if (!hasLocalProfile && !localStorage.getItem(legacyClaimKey)) {
    const legacyItems: Array<[string, string]> = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (
        key?.startsWith("linguaplay-") &&
        key !== legacyClaimKey &&
        !key.startsWith("linguaplay-user-data:")
      ) {
        legacyItems.push([key, localStorage.getItem(key) ?? ""]);
      }
    }
    legacyItems.forEach(([key, value]) => localStorage.setItem(`${prefix}${key}`, value));
    localStorage.setItem(legacyClaimKey, userId);
  }

  const remoteData = remote.data && typeof remote.data === "object" ? remote.data : {};
  profileVersions = remote.versions ?? {};
  pendingProfileKeys = new Set();
  const remoteEntries = Object.entries(remoteData).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string",
  );
  const remoteKeys = new Set(remoteEntries.map(([key]) => key));
  remoteEntries.forEach(([key, value]) => {
    if (key.startsWith("linguaplay-") && !serverManagedKeys.has(key))
      localStorage.setItem(
        `${prefix}${key}`,
        displayOnlyStatsKeys.has(key) ? withoutDisplayOnlyStats(value) : value,
      );
  });
  activeUserId = userId;
  for (let index = 0; index < localStorage.length; index += 1) {
    const localKey = localStorage.key(index);
    if (localKey?.startsWith(prefix)) {
      const profileKey = localKey.slice(prefix.length);
      if (!serverManagedKeys.has(profileKey) && !remoteKeys.has(profileKey))
        pendingProfileKeys.add(profileKey);
    }
  }
  // The remote profile is now readable by the app. Media migration and the
  // initial write-back can continue in the background so they do not hold the
  // cabinet behind extra requests or large audio uploads.
  void migrateEmbeddedAudio(userId).finally(() => sendProfileData(userId));
}

export function deactivateProfileStorage() {
  window.clearTimeout(syncTimer);
  activeUserId = null;
  profileVersions = {};
  pendingProfileKeys = new Set();
}
