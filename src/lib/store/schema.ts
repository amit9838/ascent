// IDB v3 schema: one object store per entity (docs/schema-v3-plan.md §2).
// Every store = one entity = one keyPath. Sync-relevant fields live only
// in synced stores (solves, notes, settings, rewardEvents); device-local
// data only in local stores (prefs, syncState).
//
// Version history:
//   v1 — `kv` only (legacy blobs, deleted in v3)
//   v2 — adds solves, notes, settings, rewardEvents, sync
//   v3 — adds prefs + syncState; deletes kv (no migration — data was wiped)

export const DB_NAME = "ascent-db";
export const DB_VERSION = 3;

// Every synced entity store carries `updatedAt` on each record and exposes
// it through the `by-updated` index — that index is the sync change cursor
// (push: updatedAt > cursor; pull: listRecordsUpdatedSince).
interface StoreDef {
  keyPath: string;
  indexes: { name: string; keyPath: string }[];
}

const UPDATED_INDEX = { name: "by-updated", keyPath: "updatedAt" };

export const STORES: Record<string, StoreDef> = {
  solves: {
    keyPath: "problemId",
    indexes: [UPDATED_INDEX],
  },
  notes: {
    keyPath: "id",
    indexes: [UPDATED_INDEX],
  },
  settings: {
    // Single-row store: exactly one record with key "settings".
    keyPath: "key",
    indexes: [],
  },
  rewardEvents: {
    keyPath: "id",
    indexes: [UPDATED_INDEX],
  },
  prefs: {
    // Device-local preferences (theme, qotd, …): { name, value, updatedAt }.
    keyPath: "name",
    indexes: [],
  },
  syncState: {
    // Sync bookkeeping (E12): single row key "state" holding
    // { uid, cursors: { [entityName]: ISO | null } }.
    keyPath: "key",
    indexes: [],
  },
};

export const SETTINGS_KEY = "settings";
export const SYNC_STATE_KEY = "state";

// Single-row stores: their one and only key, for typed get/put.
export const STORE_KEYS = {
  settings: SETTINGS_KEY,
  syncState: SYNC_STATE_KEY,
} as const;

interface UpgradeDB {
  objectStoreNames: { contains(name: string): boolean };
  deleteObjectStore(name: string): void;
  createObjectStore(
    name: string,
    options: { keyPath: string }
  ): { createIndex(name: string, keyPath: string, options?: unknown): unknown };
}

// idempotent: creates missing stores, upgrades v1/v2 by dropping `kv`.
export function createStores(db: UpgradeDB) {
  if (db.objectStoreNames.contains("kv")) db.deleteObjectStore("kv");
  for (const [name, def] of Object.entries(STORES)) {
    if (db.objectStoreNames.contains(name)) continue;
    const store = db.createObjectStore(name, { keyPath: def.keyPath });
    for (const index of def.indexes) {
      store.createIndex(index.name, index.keyPath, { unique: false });
    }
  }
}
