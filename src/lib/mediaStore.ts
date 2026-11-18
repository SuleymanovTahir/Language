const DATABASE = "linguaplay-media-v1";
const STORE = "files";

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
  const db = await openMediaDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).put(file, id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Не удалось сохранить файл."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Сохранение файла отменено."));
  }).finally(() => db.close());
}

export async function loadMediaFile(id: string): Promise<Blob | null> {
  const db = await openMediaDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, "readonly");
    const request = transaction.objectStore(STORE).get(id);
    request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : null);
    request.onerror = () => reject(request.error ?? new Error("Не удалось загрузить файл."));
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => db.close();
  });
}

export async function removeMediaFile(id: string): Promise<void> {
  const db = await openMediaDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Не удалось удалить файл."));
  }).finally(() => db.close());
}
