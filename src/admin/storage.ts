export interface Draft {
  path: string;
  raw: string;
  baseRaw: string;
  baseSha: string;
  images: { name: string; file: Blob }[];
  updatedAt: number;
  lastCommit?: string;
  pendingRaw?: string;
  publishedImages?: string[];
}
let database: Promise<IDBDatabase> | undefined;
function db() {
  return (database ??= new Promise((resolve, reject) => {
    const request = indexedDB.open("blog-admin-v1", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("drafts", { keyPath: "path" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      database = undefined;
      reject(request.error);
    };
    request.onblocked = () => reject(new Error("请关闭其他后台标签页后重试"));
  }));
}
async function transact<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const tx = database.transaction("drafts", mode);
    const request = action(tx.objectStore("drafts"));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("草稿保存已中断"));
  });
}
export const readDrafts = () =>
  transact<Draft[]>("readonly", store => store.getAll());
export const writeDraft = (draft: Draft) =>
  transact("readwrite", store => store.put(draft));
