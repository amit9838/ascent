// Generic record-level sync engine (docs/schema-v3-plan.md, data-model §4).
//
// One code path for every synced entity (solves, notes, settings,
// rewardEvents). Local IndexedDB records and Firestore docs converge via
// per-record LWW on `updatedAt`; exact ties resolve remote-wins (decided).
// State propagates through DOMAIN FLAGS, not delete-tombstones: solves use
// `isDone` (a live state row, never pruned), notes `isDeleted`, rewards
// `isRevoked` (both pruned locally 30d after every peer has seen them —
// entity configs declare how to spot one via `tombstone`).
//
// Push: records with updatedAt > cursor are setDoc'd (no transactions, no
// read-modify-write), then the cursor advances. Identical echo writes are
// skipped by content comparison.
// Pull: startup getDocs + one onSnapshot per collection (n is tiny — solves
// cap at ~250), each doc merged by the SAME mergeRemote core (single doc
// entities included — no second copy of the LWW logic).
// Bookkeeping: one `syncState` row holds all push cursors + the last-used
// account uid (account-switch detection). Tombstones older than 30d that
// were pushed at least once are pruned.

import {
  deleteRecord,
  getAllRecords,
  getRecord,
  listRecordsUpdatedSince,
  putRecord,
  subscribeRecords,
} from "../../store/records.ts";
import { SYNC_STATE_KEY } from "../../store/schema.ts";
import type { StoreName, SyncStateRow, WriteSource } from "../../store/types.ts";
import type { CollectionEntity, DocEntity, EntityConfig } from "./entities.ts";
import type { DocumentData, Firestore } from "firebase/firestore";

export const PUSH_DEBOUNCE_MS = 1500;
const TYPING_GUARD_MS = 3000;
const TOMBSTONE_PRUNE_MS = 30 * 24 * 3600 * 1000;

function stampMs(iso?: string | null): number {
  const time = Date.parse(iso ?? "");
  return Number.isNaN(time) ? 0 : time;
}

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function isoNow(): string {
  return new Date().toISOString();
}

// LWW winner for one record. Remote wins exact ties (decided §8.5).
export function pickWinner(
  localUpdatedAt?: string | null,
  remoteUpdatedAt?: string | null
): "local" | "remote" {
  return stampMs(remoteUpdatedAt) >= stampMs(localUpdatedAt) ? "remote" : "local";
}

function isOnline(): boolean {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

// Engine-boundary view of an entity row: only the sync fields matter here.
// entity.store is StoreName (a heterogeneous union), so query results are
// cast through this shape once at the read site instead of per-store.
interface PushRow {
  updatedAt: string;
}

export type SyncPhase = "idle" | "syncing" | "synced" | "error" | "offline";

export interface SyncStatus {
  state: SyncPhase;
  at: number | null;
  message?: string;
  code?: string;
}

// Structural shape of the Firebase kit returned by loadFirestore — the
// engine only needs these six operations (the real module satisfies it).
export interface FirestoreKit {
  db: Firestore;
  m: {
    collection: typeof import("firebase/firestore").collection;
    doc: typeof import("firebase/firestore").doc;
    setDoc: typeof import("firebase/firestore").setDoc;
    getDoc: typeof import("firebase/firestore").getDoc;
    getDocs: typeof import("firebase/firestore").getDocs;
    onSnapshot: typeof import("firebase/firestore").onSnapshot;
  };
}

export interface EngineOptions {
  uid: string;
  firestore: FirestoreKit;
  setStatus: (status: SyncStatus) => void;
  entities: EntityConfig[];
  onSummaryDirty: (uid: string) => Promise<void>;
  // A different account's syncState was found on this browser; return
  // false to replace local data with the cloud copy (default: merge).
  onAccountSwitch?: (prevUid: string) => Promise<boolean> | boolean;
}

export function createEngine(options: EngineOptions) {
  const { uid, firestore, setStatus, entities, onSummaryDirty } = options;
  const { db, m } = firestore;
  const byName = new Map<string, EntityConfig>(entities.map((e) => [e.name, e]));
  const state = {
    dirty: new Set<string>(),
    pushTimer: null as number | null,
    retryTimers: new Map<string, number>(),
    pushing: false,
    unsubs: [] as (() => void)[],
    onOnline: null as (() => void) | null,
    stopped: false,
  };

  // --- syncState bookkeeping (one row: cursors + account uid) ---

  let syncState: SyncStateRow = { key: SYNC_STATE_KEY };

  const cursorOf = (entityName: string): string | null =>
    syncState.cursors?.[entityName] ?? null;

  async function loadSyncState(): Promise<void> {
    const stored = await getRecord("syncState", SYNC_STATE_KEY);
    if (stored) syncState = stored;
  }

  async function persistSyncState(): Promise<void> {
    syncState = { ...syncState, key: SYNC_STATE_KEY, updatedAt: isoNow() };
    // source "remote": bookkeeping must never mark an entity dirty
    await putRecord("syncState", syncState, "remote");
  }

  async function saveCursor(entityName: string, cursor: string | null): Promise<void> {
    syncState = {
      ...syncState,
      cursors: { ...(syncState.cursors ?? {}), [entityName]: cursor },
    };
    await persistSyncState();
  }

  // --- cloud refs ---

  const collectionRef = (entity: EntityConfig) =>
    m.collection(db, "users", uid, entity.collection);

  const docRef = (entity: EntityConfig, docId?: string) =>
    entity.kind === "doc"
      ? m.doc(db, "users", uid, entity.collection, entity.doc)
      : m.doc(db, "users", uid, entity.collection, docId ?? "");

  // --- push ---

  function schedulePush(ms = PUSH_DEBOUNCE_MS): void {
    clearTimeout(state.pushTimer ?? undefined);
    state.pushTimer = setTimeout(() => {
      pushDirty().catch(() => {});
    }, ms);
  }

  async function pushCollection(entity: CollectionEntity): Promise<boolean> {
    const changes = (
      (await listRecordsUpdatedSince(entity.store, cursorOf(entity.name))) as unknown as PushRow[]
    ).filter((record) => (entity.shouldPush ? entity.shouldPush(record) : true));
    if (!changes.length) return false;
    let highWater = cursorOf(entity.name);
    for (const record of changes) {
      await m.setDoc(docRef(entity, entity.docId(record)), entity.toCloud(record));
      if (stampMs(record.updatedAt) > stampMs(highWater)) {
        highWater = record.updatedAt;
      }
    }
    await saveCursor(entity.name, highWater);
    await pruneTombstones(entity, highWater);
    return true;
  }

  async function pushDoc(entity: DocEntity): Promise<boolean> {
    const local = await entity.readRecord();
    if (!local) return false;
    if (stampMs(local.updatedAt) <= stampMs(cursorOf(entity.name))) return false;
    await m.setDoc(docRef(entity), entity.toCloud(local));
    await saveCursor(entity.name, local.updatedAt);
    return true;
  }

  // Tombstone-shaped rows (notes.isDeleted, rewards.isRevoked — NOT solves'
  // isDone state) that went up at least once (updatedAt <= pushed highWater)
  // and are older than 30d are hard-deleted locally. Peers had a month to
  // pull them; keeping them forever would leak storage. Entities without a
  // `tombstone` predicate (state rows) are never pruned.
  async function pruneTombstones(
    entity: CollectionEntity,
    highWater: string | null
  ): Promise<void> {
    const tombstone = entity.tombstone;
    if (!tombstone) return;
    const cutoff = Date.now() - TOMBSTONE_PRUNE_MS;
    const rows = (await getAllRecords(entity.store)) as unknown as PushRow[];
    await Promise.all(
      rows
        .filter(
          (record) =>
            tombstone(record) &&
            stampMs(record.updatedAt) <= stampMs(highWater) &&
            stampMs(record.updatedAt) < cutoff
        )
        .map((record) => deleteRecord(entity.store, entity.docId(record), "remote"))
    );
  }

  async function pushDirty(): Promise<void> {
    if (state.pushing || state.stopped || !state.dirty.size) return;
    state.pushing = true;
    setStatus({ state: "syncing", at: Date.now() });
    try {
      let summaryDirty = false;
      for (const name of [...state.dirty]) {
        const entity = byName.get(name);
        if (!entity) {
          state.dirty.delete(name);
          continue;
        }
        const changed =
          entity.kind === "doc" ? await pushDoc(entity) : await pushCollection(entity);
        state.dirty.delete(name);
        if (changed && entity.refreshSummary) summaryDirty = true;
      }
      if (summaryDirty) await onSummaryDirty(uid);
      setStatus({ state: "synced", at: Date.now() });
      if (state.dirty.size) schedulePush();
    } catch (err) {
      console.warn("[sync] push failed", err);
      const error = err as { message?: string; code?: string };
      setStatus({
        state: isOnline() ? "error" : "offline",
        at: Date.now(),
        message: error?.message,
        code: error?.code,
      });
      // Failed entities stay dirty; retried on next write or connectivity
    } finally {
      state.pushing = false;
    }
  }

  // --- pull (one merge core for every entity, collection or doc) ---

  // Merge one remote doc into the local store. Returns true when the
  // local store changed (caller refreshes derived data like the summary).
  async function mergeRemote(
    entity: EntityConfig,
    docId: string | null,
    data: DocumentData
  ): Promise<boolean> {
    const local = await entity.readRecord(docId ?? undefined);
    const remote = entity.fromCloud(docId, data ?? {});
    if (!remote) return false;
    if (local && sameJson(entity.toCloud(local), entity.toCloud(remote))) {
      return false; // echo of our own push — skip the write entirely
    }
    if (local && pickWinner(local.updatedAt, remote.updatedAt) === "local") {
      state.dirty.add(entity.name); // we are newer — cloud is stale, push back
      schedulePush();
      return false;
    }
    if (
      entity.guardLocalWrites &&
      local &&
      Date.now() - stampMs(local.updatedAt) < TYPING_GUARD_MS
    ) {
      deferRemote(entity, docId, data); // user is typing — retry shortly
      return false;
    }
    await entity.writeRecord(remote);
    // The applied record is newer than our push cursor by construction —
    // advance the cursor so we don't immediately re-upload the echo.
    if (stampMs(remote.updatedAt) > stampMs(cursorOf(entity.name))) {
      await saveCursor(entity.name, remote.updatedAt);
    }
    return true;
  }

  function deferRemote(
    entity: EntityConfig,
    docId: string | null,
    data: DocumentData
  ): void {
    const key = `${entity.name}:${docId ?? ""}`;
    clearTimeout(state.retryTimers.get(key) ?? undefined);
    state.retryTimers.set(
      key,
      setTimeout(() => {
        state.retryTimers.delete(key);
        if (!state.stopped) mergeRemote(entity, docId, data).catch(() => {});
      }, TYPING_GUARD_MS)
    );
  }

  async function pullCollection(entity: CollectionEntity): Promise<boolean> {
    const snap = await m.getDocs(collectionRef(entity));
    let changed = false;
    for (const doc of snap.docs) {
      if (await mergeRemote(entity, doc.id, doc.data())) changed = true;
    }
    return changed;
  }

  async function pullDoc(entity: DocEntity): Promise<boolean> {
    const snap = await m.getDoc(docRef(entity)).catch(() => null);
    if (!snap || !snap.exists()) {
      state.dirty.add(entity.name); // nothing in the cloud yet — push local
      return false;
    }
    return mergeRemote(entity, null, snap.data() ?? {});
  }

  function reportListenerError(err: unknown): void {
    console.warn("[sync] listener failed", err);
    const error = err as { message?: string; code?: string };
    setStatus({
      state: "error",
      at: Date.now(),
      message: error?.message,
      code: error?.code,
    });
  }

  function watchCollection(
    entity: CollectionEntity,
    onPulled: (entity: EntityConfig) => void
  ): void {
    const unsub = m.onSnapshot(
      collectionRef(entity),
      (snap) => {
        (async () => {
          let changed = false;
          for (const doc of snap.docs) {
            if (await mergeRemote(entity, doc.id, doc.data())) changed = true;
          }
          if (changed) onPulled(entity);
        })().catch((err) => console.warn("[sync] pull failed", err));
      },
      reportListenerError
    );
    state.unsubs.push(unsub);
  }

  function watchDoc(
    entity: DocEntity,
    onPulled: (entity: EntityConfig) => void
  ): void {
    const unsub = m.onSnapshot(
      docRef(entity),
      (snap) => {
        (async () => {
          if (!snap.exists()) return;
          if (await mergeRemote(entity, null, snap.data() ?? {})) onPulled(entity);
        })().catch((err) => console.warn("[sync] pull failed", err));
      },
      reportListenerError
    );
    state.unsubs.push(unsub);
  }

  // --- lifecycle ---

  async function start(): Promise<void> {
    await loadSyncState();

    // Account switch on this browser: merge (default) or replace local.
    const lastUid = syncState.uid ?? null;
    if (lastUid && lastUid !== uid) {
      const merge = (await options.onAccountSwitch?.(lastUid)) ?? true;
      if (!merge) await clearLocal();
    }
    syncState = { ...syncState, uid };
    await persistSyncState();

    // Pull first so remote records land before local changes push up —
    // with LWW both directions converge, but this order avoids a wasted
    // push-then-overwrite round trip on fresh devices.
    let summaryDirty = false;
    await Promise.all(
      entities.map(async (entity) => {
        const changed =
          entity.kind === "doc" ? await pullDoc(entity) : await pullCollection(entity);
        if (changed && entity.refreshSummary) summaryDirty = true;
      })
    );
    if (summaryDirty) await onSummaryDirty(uid).catch(() => {});

    for (const entity of entities) {
      const onPulled = (pulled: EntityConfig) => {
        if (pulled.refreshSummary) onSummaryDirty(uid).catch(() => {});
      };
      if (entity.kind === "doc") watchDoc(entity, onPulled);
      else watchCollection(entity, onPulled);
    }

    // Local writes → debounced push.
    state.unsubs.push(
      subscribeRecords((storeName: StoreName, source: WriteSource) => {
        if (source !== "local") return;
        const entity = entities.find((e) => e.store === storeName);
        if (!entity) return;
        state.dirty.add(entity.name);
        schedulePush();
      })
    );

    state.onOnline = () => {
      if (state.dirty.size) pushDirty().catch(() => {});
    };
    window.addEventListener("online", state.onOnline);

    if (state.dirty.size) schedulePush();
  }

  function stop(): void {
    state.stopped = true;
    clearTimeout(state.pushTimer ?? undefined);
    for (const timer of state.retryTimers.values()) clearTimeout(timer);
    state.retryTimers.clear();
    for (const unsub of state.unsubs) {
      try {
        unsub();
      } catch {
        // listener already gone
      }
    }
    state.unsubs.length = 0;
    if (state.onOnline) window.removeEventListener("online", state.onOnline);
  }

  // Hard-wipe local entity stores (account-switch "replace this browser's
  // data with the cloud copy"). Cursors reset so the next pull fills all.
  async function clearLocal(): Promise<void> {
    for (const entity of entities) {
      if (entity.kind === "doc") {
        await entity.clearLocal();
      } else {
        const rows = (await getAllRecords(entity.store)) as unknown as PushRow[];
        await Promise.all(
          rows.map(
            (row) => row && deleteRecord(entity.store, entity.docId(row), "remote")
          )
        );
      }
      await saveCursor(entity.name, null);
    }
  }

  return { start, stop, pushDirty, clearLocal };
}
