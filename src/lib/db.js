// Central storage layer for the app, backed by IndexedDB.
//
// All feature modules (progress, plans, rewards, qotd, notes, theme,
// profile) must go through this file. Keys are stable for backward
// compatibility with exported backup files.
//
// Backend: one database ("ascent-db", v1) with a single object store
// ("kv") holding key -> value pairs (out-of-line keys). Raw-text values
// (notes, theme) are stored as strings; everything else is stored as
// structured-cloneable JSON values.
//
// NOTE: every function here is async — callers must `await` reads/writes.

export const KEYS = {
  progress: "dsa-progress-v1",
  notes: "dsa-notes-v1",
  plans: "dsa-plans-v1",
  rewards: "dsa-rewards-v1",
  theme: "dsa-theme-v1",
  qotd: "dsa-qotd-v1",
  qotdIgnored: "dsa-qotd-ignored-v1",
};

const DB_NAME = "ascent-db";
const STORE_NAME = "kv";
const DB_VERSION = 1;

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    let req;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
  return dbPromise;
}

async function idbGet(key) {
  const db = await openDb();
  if (!db) return undefined;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
}

async function idbSet(key, value) {
  const db = await openDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const req = tx.objectStore(STORE_NAME).put(value, key);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function idbDel(key) {
  const db = await openDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const req = tx.objectStore(STORE_NAME).delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

// --- public API ---

// Raw string access (notes, theme).
export async function getItem(key) {
  const v = await idbGet(key);
  if (typeof v === "string") return v;
  if (v == null) return null;
  return String(v);
}

export async function setItem(key, value) {
  await idbSet(key, String(value));
}

export async function removeItem(key) {
  await idbDel(key);
}

// JSON object access (progress, plans, rewards, qotd).
export async function getJSON(key, fallback = null) {
  const v = await idbGet(key);
  if (v === undefined || v === null) return fallback;
  if (typeof v === "string") {
    try {
      return JSON.parse(v) ?? fallback;
    } catch {
      return fallback;
    }
  }
  return v;
}

export async function setJSON(key, value) {
  await idbSet(key, value);
}
