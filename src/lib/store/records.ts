// Generic record access over the v3 entity stores (schema.ts).
//
// Conventions:
//   - Records are plain structured-cloneable objects typed by StoreMap
//     (types.ts) — the store's keyPath field is the primary key.
//   - Domain flags live on the record itself (solves.isDone,
//     notes.isDeleted, rewards.isRevoked) — no generic `deleted` field.
//   - Every write notifies subscribers with (storeName, source):
//       "local"  — feature module wrote → sync should push it
//       "remote" — sync engine wrote → UI refreshes, sync must NOT push back

import {
  DB_NAME,
  DB_VERSION,
  STORES,
  createStores,
} from "./schema.ts";
import type { StoreMap, StoreName, WriteSource } from "./types.ts";

const UPDATED_INDEX = "by-updated";

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDatabase(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }
    request.onupgradeneeded = () => createStores(request.result);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
  return dbPromise;
}

// --- record change notification (pub/sub) ---

type Listener = (storeName: StoreName, source: WriteSource) => void;
const listeners = new Set<Listener>();

export function subscribeRecords(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyRecord(storeName: StoreName, source: WriteSource) {
  for (const listener of [...listeners]) {
    try {
      listener(storeName, source);
    } catch {
      // one bad listener must never break a write
    }
  }
}

// --- generic CRUD ---

function runRequest<T>(
  storeName: StoreName,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T | undefined> {
  return openDatabase().then((db) => {
    if (!db) return undefined;
    return new Promise<T | undefined>((resolve) => {
      try {
        const store = db.transaction(storeName, mode).objectStore(storeName);
        const request = operation(store);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(undefined);
      } catch {
        resolve(undefined);
      }
    });
  });
}

function requireStore(storeName: string): asserts storeName is StoreName {
  if (!Object.prototype.hasOwnProperty.call(STORES, storeName)) {
    throw new Error(`unknown entity store: ${storeName}`);
  }
}

// Read one record by primary key. Returns undefined when missing.
export async function getRecord<K extends StoreName>(
  storeName: K,
  key: string
): Promise<StoreMap[K] | undefined> {
  requireStore(storeName);
  return runRequest<StoreMap[K]>(storeName, "readonly", (store) =>
    store.get(key)
  );
}

// Insert or replace one record. Tombstones are written with this too.
export async function putRecord<K extends StoreName>(
  storeName: K,
  record: StoreMap[K],
  source: WriteSource = "local"
): Promise<void> {
  requireStore(storeName);
  await runRequest(storeName, "readwrite", (store) => store.put(record));
  notifyRecord(storeName, source);
}

// Hard-delete one record. Prefer flags for synced entities (solve with
// `isDone: false`, soft-delete with `isDeleted: true`); this is for
// local-only cleanup (e.g. pruning synced soft-deletes after 30 days).
export async function deleteRecord(
  storeName: StoreName,
  key: string,
  source: WriteSource = "local"
): Promise<void> {
  requireStore(storeName);
  await runRequest(storeName, "readwrite", (store) => store.delete(key));
  notifyRecord(storeName, source);
}

// Every record in the store (key order). Fine for tiny stores (settings,
// prefs, syncState) — use the cursor query for large ones.
export async function getAllRecords<K extends StoreName>(
  storeName: K
): Promise<StoreMap[K][]> {
  requireStore(storeName);
  const rows = await runRequest<StoreMap[K][]>(storeName, "readonly", (store) =>
    store.getAll()
  );
  return rows ?? [];
}

// Sync change cursor: records with updatedAt strictly after `cursorIso`,
// oldest first. Empty cursor returns everything. Requires the store's
// `by-updated` index (all synced entity stores declare it).
export async function listRecordsUpdatedSince<K extends StoreName>(
  storeName: K,
  cursorIso: string | null
): Promise<StoreMap[K][]> {
  requireStore(storeName);
  const db = await openDatabase();
  if (!db) return [];
  return new Promise((resolve) => {
    try {
      const store = db.transaction(storeName, "readonly").objectStore(storeName);
      const index = store.index(UPDATED_INDEX);
      const range = cursorIso
        ? IDBKeyRange.lowerBound(cursorIso, true) // exclusive: synced edge stays put
        : null;
      const request = index.getAll(range);
      request.onsuccess = () => resolve((request.result as StoreMap[K][]) ?? []);
      request.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}
