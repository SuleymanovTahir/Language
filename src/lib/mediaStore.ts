import { getActiveProfileId } from "./profileStorage";

const DATABASE = "linguaplay-media-v1";
const STORE = "files";
const MAX_REMOTE_FILE_BYTES = 4 * 1024 * 1024;

function mediaUrl(id: string) { return `/api/media?id=${encodeURIComponent(id)}`; }
function localMediaKey(id: string) { return `${getActiveProfileId() ? `user:${encodeURIComponent(getActiveProfileId()!)}` : "guest"}:${id}`; }

async function saveRemoteMedia(id: string, file: Blob) {
  if (file.size > MAX_REMOTE_FILE_BYTES) throw new Error("Для синхронизации между устройствами размер файла не должен превышать 4 МБ.");
  const name = "name" in file && typeof file.name === "string" ? file.name : "media-file";
  const response = await fetch(mediaUrl(id), {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": file.type || "application/octet-stream", "X-Media-Name": encodeURIComponent(name) },
    body: file,
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(result.error || "Не удалось сохранить файл в личном кабинете.");
  }
}

function openMediaDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("Хранилище файлов недоступно в этом браузере."));
      return;
    }
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Не удалось открыть хранилище файлов."));
  });
}

export async function saveMediaFile(id: string, file: Blob): Promise<void> {
  if (getActiveProfileId()) await saveRemoteMedia(id, file);
  const db = await openMediaDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).put(file, localMediaKey(id));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Не удалось сохранить файл."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Сохранение файла отменено."));
  }).finally(() => db.close());
}

export async function loadMediaFile(id: string): Promise<Blob | null> {
  const db = await openMediaDatabase();
  const local = await new Promise<Blob | null>((resolve, reject) => {
    const transaction = db.transaction(STORE, "readonly");
    const request = transaction.objectStore(STORE).get(localMediaKey(id));
    request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : null);
    request.onerror = () => reject(request.error ?? new Error("Не удалось загрузить файл."));
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => db.close();
  });
  if (local) return local;
  if (!getActiveProfileId()) return null;
  const response = await fetch(mediaUrl(id), { credentials: "include", cache: "no-store" });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Не удалось загрузить файл из личного кабинета.");
  const blob = await response.blob();
  await saveMediaFileLocally(id, blob);
  return blob;
}

async function saveMediaFileLocally(id: string, file: Blob) {
  const db = await openMediaDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).put(file, localMediaKey(id));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Не удалось сохранить файл."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Сохранение файла отменено."));
  }).finally(() => db.close());
}

export async function removeMediaFile(id: string): Promise<void> {
  if (getActiveProfileId()) await fetch(mediaUrl(id), { method: "DELETE", credentials: "include" }).catch(() => undefined);
  const db = await openMediaDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).delete(localMediaKey(id));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Не удалось удалить файл."));
  }).finally(() => db.close());
}

function profileMediaIds(userId: string) {
  const prefix = `linguaplay-user-data:${encodeURIComponent(userId)}:`;
  const mediaIds = new Set<string>();
  const visit = (value: unknown, parentKey = "") => {
    if (Array.isArray(value)) { value.forEach((item) => visit(item, parentKey)); return; }
    if (!value || typeof value !== "object") return;
    const object = value as Record<string, unknown>;
    for (const [key, child] of Object.entries(object)) {
      if ((key === "mediaId" || key === "audioMediaId") && typeof child === "string") mediaIds.add(child);
      if ((key === "image" || key === "media" || key === "practiceMedia") && child && typeof child === "object" && "id" in child && typeof child.id === "string") mediaIds.add(child.id);
      visit(child, key);
    }
  };
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key?.startsWith(prefix)) continue;
    try { visit(JSON.parse(localStorage.getItem(key) ?? "null")); } catch { /* Ignore unrelated text values. */ }
  }
  return mediaIds;
}

export async function migrateLocalMediaToProfile(userId: string): Promise<void> {
  if (getActiveProfileId() !== userId) return;
  const keys = await openMediaDatabase();
  try {
    for (const id of profileMediaIds(userId)) {
      const legacy = await new Promise<Blob | null>((resolve, reject) => {
        const transaction = keys.transaction(STORE, "readonly");
        const request = transaction.objectStore(STORE).get(id);
        request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : null);
        request.onerror = () => reject(request.error ?? new Error("Не удалось прочитать локальный файл."));
      });
      if (!legacy) continue;
      try { if (legacy.size <= MAX_REMOTE_FILE_BYTES) await saveRemoteMedia(id, legacy); } catch { /* Keep a private per-profile local copy when server sync is unavailable. */ }
      await new Promise<void>((resolve, reject) => {
        const transaction = keys.transaction(STORE, "readwrite");
        transaction.objectStore(STORE).put(legacy, localMediaKey(id));
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error ?? new Error("Не удалось перенести локальный файл."));
      });
    }
  } finally { keys.close(); }
}
