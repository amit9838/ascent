// Notes storage: one IndexedDB record per note plus a light index of
// metadata, so the UI can lazy-load bodies only when the list opens.
//
//   dsa-notes-index-v1  → [{ id, title, createdAt, updatedAt }, ...]
//   dsa-note-v1:{id}    → { id, title, body, createdAt, updatedAt }
//
// Cloud sync and profile backups keep using the legacy aggregate key
// (KEYS.notes) as an opaque JSON string — readNotesBlob/writeNotesBlob
// translate between the two shapes, so sync.js/backup.js/rules need no
// knowledge of the per-note layout.

import {
  KEYS,
  getItem,
  setItem,
  removeItem,
  getJSON,
  setJSON,
  notify,
} from "./db.js";

export const MAX_NOTES = 10;
export const TITLE_LIMIT = 120;
export const BODY_LIMIT = 12000;

const INDEX_KEY = "dsa-notes-index-v1";
const NOTE_PREFIX = "dsa-note-v1:";

const noteKey = (id) => NOTE_PREFIX + id;

function isoNow() {
  return new Date().toISOString();
}

function sanitizeNote(n) {
  const now = isoNow();
  return {
    id: String(n?.id ?? ""),
    title: String(n?.title ?? "").slice(0, TITLE_LIMIT),
    body: String(n?.body ?? "").slice(0, BODY_LIMIT),
    createdAt: typeof n?.createdAt === "string" ? n.createdAt : now,
    updatedAt: typeof n?.updatedAt === "string" ? n.updatedAt : now,
    // Collaboration markers (absent on private notes). `sharedId` is the
    // cloud doc id (owner's note id); ownership stays with `ownerUid`.
    shared: n?.shared === true,
    ownerUid: typeof n?.ownerUid === "string" ? n.ownerUid : "",
    ownerName: typeof n?.ownerName === "string" ? n.ownerName.slice(0, 120) : "",
    sharedId: typeof n?.sharedId === "string" ? n.sharedId : "",
  };
}

function toMeta(n) {
  return {
    id: n.id,
    title: n.title,
    createdAt: n.createdAt,
    updatedAt: n.updatedAt,
    shared: n.shared === true,
    ownerUid: typeof n.ownerUid === "string" ? n.ownerUid : "",
    ownerName: typeof n.ownerName === "string" ? n.ownerName : "",
  };
}

const byNewest = (a, b) =>
  String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? ""));

export function makeNote(overrides = {}) {
  const now = isoNow();
  return sanitizeNote({
    id:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
    title: "",
    body: "",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
}

// First free title: base, base_1, base_2, …
export function uniqueTitle(base, taken) {
  const has = (t) => taken.has(t);
  if (!has(base)) return base;
  for (let i = 1; i < 10000; i++) {
    const t = `${base}_${i}`;
    if (!has(t)) return t;
  }
  return `${base}_${Date.now()}`;
}

// Aggregate (cloud/backup shape): JSON string of the full note array.
// Accepts a legacy plain-text blob (wrapped as one note) or an array.
function parseBlob(raw) {
  if (raw == null || raw === "") return [];
  if (Array.isArray(raw)) return raw.filter((n) => n && typeof n === "object");
  try {
    const v = JSON.parse(raw);
    if (Array.isArray(v)) return v.filter((n) => n && typeof n === "object");
  } catch {
    // legacy plain-text blob
  }
  return [makeNote({ title: "Notes", body: String(raw) })];
}

// Replace every OWNED record + the index from a full array, then drop the
// legacy aggregate key. Caps owned notes at MAX_NOTES (newest kept).
// Shared notes (collaborations owned by someone else) are preserved as-is
// and never count toward the cap — they live in the cloud shared doc.
async function writeAll(notes, source) {
  const capped = notes
    .map(sanitizeNote)
    .filter((n) => n.id && !n.shared)
    .sort(byNewest)
    .slice(0, MAX_NOTES);
  const oldIndex = (await getJSON(INDEX_KEY, [])) ?? [];
  const keep = new Set(capped.map((n) => n.id));
  for (const e of oldIndex) {
    if (e && typeof e.id === "string" && !keep.has(e.id) && !e.shared) {
      await removeItem(noteKey(e.id), source);
    }
  }
  const keptShared = [];
  for (const e of oldIndex) {
    if (e?.shared && typeof e.id === "string" && e.id) {
      const rec = await getJSON(noteKey(e.id), null);
      if (rec && typeof rec === "object" && rec.id) keptShared.push(sanitizeNote(rec));
    }
  }
  for (const n of capped) await setJSON(noteKey(n.id), n, source);
  await setJSON(
    INDEX_KEY,
    [...capped, ...keptShared].map(toMeta),
    source
  );
  const legacy = await getItem(KEYS.notes);
  if (legacy != null) await removeItem(KEYS.notes, source);
  notify(KEYS.notes, source);
}

// One-time migration of pre-split installs (single blob at KEYS.notes).
let migratePromise = null;
function ensureMigrated() {
  if (!migratePromise) {
    migratePromise = (async () => {
      const raw = await getItem(KEYS.notes);
      if (raw == null) return;
      await writeAll(parseBlob(raw), "local");
    })().catch((err) => {
      migratePromise = null;
      throw err;
    });
  }
  return migratePromise;
}

// --- page API ---

export async function listNoteMeta() {
  await ensureMigrated();
  const index = (await getJSON(INDEX_KEY, [])) ?? [];
  return index
    .filter((e) => e && typeof e.id === "string")
    .map((e) => ({
      id: e.id,
      title: typeof e.title === "string" ? e.title.slice(0, TITLE_LIMIT) : "",
      createdAt: typeof e.createdAt === "string" ? e.createdAt : isoNow(),
      updatedAt: typeof e.updatedAt === "string" ? e.updatedAt : isoNow(),
      shared: e.shared === true,
      ownerUid: typeof e.ownerUid === "string" ? e.ownerUid : "",
      ownerName: typeof e.ownerName === "string" ? e.ownerName : "",
    }))
    .sort(byNewest);
}

export async function readNote(id) {
  await ensureMigrated();
  const n = await getJSON(noteKey(id), null);
  return n && typeof n === "object" && n.id ? sanitizeNote(n) : null;
}

// Upsert one record + its index entry.
export async function writeNote(note, source = "local") {
  await ensureMigrated();
  const clean = sanitizeNote(note);
  if (!clean.id) return;
  await setJSON(noteKey(clean.id), clean, source);
  const index = (await getJSON(INDEX_KEY, [])) ?? [];
  const i = index.findIndex((e) => e?.id === clean.id);
  const meta = toMeta(clean);
  if (i >= 0) index[i] = meta;
  else index.push(meta);
  await setJSON(INDEX_KEY, index, source);
  notify(KEYS.notes, source);
}

export async function deleteNote(id, source = "local") {
  await ensureMigrated();
  await removeItem(noteKey(id), source);
  const index = (await getJSON(INDEX_KEY, [])) ?? [];
  await setJSON(
    INDEX_KEY,
    index.filter((e) => e?.id !== id),
    source
  );
  notify(KEYS.notes, source);
}

export async function clearAllNotes(source = "local") {
  const index = (await getJSON(INDEX_KEY, [])) ?? [];
  const keptShared = [];
  for (const e of index) {
    if (e && typeof e.id === "string") {
      if (e.shared) {
        const rec = await getJSON(noteKey(e.id), null);
        if (rec && typeof rec === "object" && rec.id) keptShared.push(sanitizeNote(rec));
      } else {
        await removeItem(noteKey(e.id), source);
      }
    }
  }
  await setJSON(
    INDEX_KEY,
    keptShared.map(toMeta),
    source
  );
  const legacy = await getItem(KEYS.notes);
  if (legacy != null) await removeItem(KEYS.notes, source);
  notify(KEYS.notes, source);
}

// --- sync/backup API (aggregate JSON string at KEYS.notes) ---

export async function readNotesBlob() {
  await ensureMigrated();
  const index = (await getJSON(INDEX_KEY, [])) ?? [];
  if (!index.length) return null;
  const notes = await Promise.all(
    index.map((e) => (e?.id && !e.shared ? readNote(e.id) : null))
  );
  // Shared notes are excluded: they sync through their shared cloud doc,
  // never through the owner's personal aggregate.
  const list = notes.filter(Boolean);
  return list.length ? JSON.stringify(list) : null;
}

export async function writeNotesBlob(value, source = "remote") {
  if (value == null) return clearAllNotes(source);
  await writeAll(parseBlob(value), source);
}
