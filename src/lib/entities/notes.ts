// E3 Note entity (docs/schema-v3-plan.md §2).
//
// One record per note in the `notes` store:
//   { id, title, body, createdAt, updatedAt, isDeleted, shared?,
//     ownerUid?, ownerName?, sharedId? }
// (minimal delete rows carry only { id, updatedAt, isDeleted: true }).
//
// isDeleted is a soft-delete flag, never a hard delete, so a note
// deleted on device A stays deleted on device B. Deleted rows are pruned
// by the sync engine 30d after every peer has seen them. (Pre-flag rows
// may still carry the old `deleted` field — read sites check both.)
//
// Shared notes (collaborations owned by someone else) are cached here with
// `shared: true` so the list renders offline; they sync through their
// shared cloud doc, never through the personal notes collection.

import { getAllRecords, getRecord, putRecord } from "../store/records.ts";
import type { NoteRecord, WriteSource } from "../store/types.ts";

const STORE = "notes";

export const MAX_NOTES = 10;
export const TITLE_LIMIT = 120;
export const BODY_LIMIT = 12000;

// Anything remotely note-like (UI objects, cloud docs, backup rows).
export type NoteLike = Partial<NoteRecord> & Record<string, any>;

// Soft-deleted? Checks the current flag and the pre-flag legacy field.
export function isNoteDeleted(note: { isDeleted?: boolean; deleted?: boolean }): boolean {
  return note.isDeleted === true || note.deleted === true;
}

// List row: bodies are loaded lazily via readNote so the list stays cheap.
export interface NoteMeta {
  id: string;
  title?: string;
  createdAt?: string;
  updatedAt: string;
  shared: boolean;
  ownerUid: string;
  ownerName: string;
}

function isoNow(): string {
  return new Date().toISOString();
}

function sanitizeNote(note: NoteLike): NoteRecord {
  const now = isoNow();
  return {
    id: String(note?.id ?? ""),
    title: String(note?.title ?? "").slice(0, TITLE_LIMIT),
    body: String(note?.body ?? "").slice(0, BODY_LIMIT),
    createdAt: typeof note?.createdAt === "string" ? note.createdAt : now,
    updatedAt: typeof note?.updatedAt === "string" ? note.updatedAt : now,
    // Collaboration markers (absent on private notes). `sharedId` is the
    // cloud doc id (owner's note id); ownership stays with `ownerUid`.
    shared: note?.shared === true,
    ownerUid: typeof note?.ownerUid === "string" ? note.ownerUid : "",
    ownerName:
      typeof note?.ownerName === "string" ? note.ownerName.slice(0, 120) : "",
    sharedId: typeof note?.sharedId === "string" ? note.sharedId : "",
    isDeleted: isNoteDeleted(note),
  };
}

function toMeta(note: NoteRecord): NoteMeta {
  return {
    id: note.id,
    title: note.title,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    shared: note.shared === true,
    ownerUid: typeof note.ownerUid === "string" ? note.ownerUid : "",
    ownerName: typeof note.ownerName === "string" ? note.ownerName : "",
  };
}

const byNewest = (a: { updatedAt?: string }, b: { updatedAt?: string }) =>
  String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? ""));

function isLive(note: NoteRecord | undefined): note is NoteRecord {
  return Boolean(note && typeof note === "object" && note.id && !isNoteDeleted(note));
}

export function makeNote(overrides: NoteLike = {}): NoteRecord {
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
export function uniqueTitle(base: string, taken: Set<string>): string {
  const has = (title: string) => taken.has(title);
  if (!has(base)) return base;
  for (let i = 1; i < 10000; i++) {
    const title = `${base}_${i}`;
    if (!has(title)) return title;
  }
  return `${base}_${Date.now()}`;
}

// Index of live notes (owned + shared), newest first.
export async function listNoteMeta(): Promise<NoteMeta[]> {
  const rows = await getAllRecords(STORE);
  return rows.filter(isLive).map(toMeta).sort(byNewest);
}

export async function readNote(id: string): Promise<NoteRecord | null> {
  const note = await getRecord(STORE, id);
  return isLive(note) ? sanitizeNote(note) : null;
}

// Upsert one record. `source` tags the write origin ("local" default,
// "remote" for cloud-applied changes the sync engine must not push back).
export async function writeNote(note: NoteLike, source: WriteSource = "local"): Promise<void> {
  const clean = sanitizeNote(note);
  if (!clean.id) return;
  await putRecord(STORE, clean, source);
}

// Soft-delete one note (stays deleted on every device).
export async function deleteNote(id: string, source: WriteSource = "local"): Promise<void> {
  await putRecord(
    STORE,
    { id: String(id), updatedAt: isoNow(), isDeleted: true },
    source
  );
}

// Soft-delete every OWNED note. Shared collaborations are preserved as-is
// and never count toward the cap — they live in the cloud shared doc.
// Used by the account-switch "replace" flow.
export async function clearAllNotes(source: WriteSource = "local"): Promise<void> {
  const rows = await getAllRecords(STORE);
  const now = isoNow();
  await Promise.all(
    rows
      .filter((note) => note && note.id && !note.shared && !isNoteDeleted(note))
      .map((note) =>
        putRecord(STORE, { ...note, isDeleted: true, updatedAt: now }, source)
      )
  );
}

// Replace every OWNED record from a full array (backup import). Caps owned
// notes at MAX_NOTES (newest kept); notes missing from the array become
// soft-deletes; `isDeleted` ({ id: ISO }) stamps them with their times.
export async function replaceNotes(
  notes: NoteLike[] | undefined,
  isDeleted: Record<string, unknown> = {},
  source: WriteSource = "local"
): Promise<void> {
  const capped: NoteRecord[] = (notes ?? [])
    .map(sanitizeNote)
    .filter((note) => note.id && !note.shared && !isNoteDeleted(note))
    .sort(byNewest)
    .slice(0, MAX_NOTES);
  const now = isoNow();

  const rows = await getAllRecords(STORE);
  const keep = new Set(capped.map((note) => note.id));
  const removed: NoteRecord[] = [];
  for (const row of rows) {
    if (!row || !row.id || row.shared || isNoteDeleted(row)) continue;
    if (!keep.has(row.id)) {
      removed.push({ ...row, isDeleted: true, updatedAt: now });
    }
  }
  for (const [id, at] of Object.entries(isDeleted ?? {})) {
    if (typeof at !== "string") continue;
    removed.push({ id, updatedAt: at, isDeleted: true });
  }
  await Promise.all([
    ...capped.map((note) => putRecord(STORE, note, source)),
    ...removed.map((note) => putRecord(STORE, note, source)),
  ]);
}

// Backup export shape: owned notes (full bodies) + soft-delete stamps.
// Shared notes are excluded: they sync through their shared cloud doc,
// never through the owner's personal collection.
export async function exportNotes(): Promise<{
  notes: NoteRecord[];
  isDeleted: Record<string, string>;
}> {
  const rows = await getAllRecords(STORE);
  const notes: NoteRecord[] = [];
  const isDeleted: Record<string, string> = {};
  for (const row of rows) {
    if (!row || !row.id || row.shared) continue;
    if (isNoteDeleted(row)) {
      if (typeof row.updatedAt === "string") isDeleted[row.id] = row.updatedAt;
    } else {
      notes.push(sanitizeNote(row));
    }
  }
  return { notes, isDeleted };
}
