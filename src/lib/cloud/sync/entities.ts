// Sync entity configs: how each local store maps to its Firestore home.
// Consumed by the generic engine (engine.ts). One entry per synced entity:
//
//   name            dirty-set tag + syncState cursor key
//   store           local IDB store
//   kind            "collection" (one doc per record) or "doc" (single doc)
//   collection      cloud subcollection under users/{uid} (both kinds);
//                   doc kind additionally names its single doc via `doc`
//   docId(record)   record -> cloud doc id (collections only)
//   toCloud(record) record -> plain cloud fields (also used for echo checks)
//   fromCloud(id, data) -> local record (null = ignore the doc)
//   readRecord(id?) local read for LWW comparison (tombstones included!)
//   writeRecord(record) local write for pulled changes (source "remote")
//   shouldPush(record) false skips upload (default: everything pushes)
//   guardLocalWrites  defer pulled docs while the user is actively editing
//   refreshSummary  recompute the public profile summary after changes
//   clearLocal()    hard-wipe for the account-switch "replace" flow (docs)
//
// Boundary typing: the interface fields take `any` on purpose — the engine
// iterates a heterogeneous list opaquely, while each config's closures stay
// precisely typed on their concrete record types (SolveRecord, …).

import { deleteRecord, getRecord, putRecord } from "../../store/records.ts";
import {
  readSettingsRow,
  writeSettingsRow,
  SETTINGS_DOC_ID,
} from "../../entities/settings.ts";
import { writeNote } from "../../entities/notes.ts";
import type { StoreName } from "../../store/types.ts";
import type { DocumentData } from "firebase/firestore";

interface EntityBase {
  name: string;
  store: StoreName;
  collection: string;
  toCloud: (record: any) => DocumentData;
  fromCloud: (id: string | null, data: DocumentData) => any;
  readRecord: (id?: string) => Promise<any>;
  writeRecord: (record: any) => Promise<void>;
  shouldPush?: (record: any) => boolean;
  guardLocalWrites?: boolean;
  refreshSummary?: boolean;
}

export interface CollectionEntity extends EntityBase {
  kind: "collection";
  docId: (record: any) => string;
  // Rows matching this predicate are tombstones: pruned locally 30d after
  // the push cursor proves every peer has seen them. State rows (solves —
  // `isDone` is NOT a delete) declare nothing and are never pruned.
  tombstone?: (record: any) => boolean;
}

export interface DocEntity extends EntityBase {
  kind: "doc";
  /** id of the single doc: users/{uid}/{collection}/{doc} */
  doc: string;
  clearLocal: () => Promise<void>;
}

export type EntityConfig = CollectionEntity | DocEntity;

const isoRecord = (value: unknown): DocumentData | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as DocumentData)
    : null;

// The settings row's `key` field is an IDB keyPath, not cloud data.
function stripKey(record: any) {
  const { key, ...fields } = record ?? {};
  return fields;
}

export const SYNC_ENTITIES: EntityConfig[] = [
  {
    name: "solves",
    store: "solves",
    kind: "collection",
    collection: "solves",
    docId: (record) => record.problemId,
    // isDone is the state flag (true = solved). Legacy pre-flag rows may
    // carry `deleted: true` (= unsolved) — map both into isDone.
    toCloud: (record) => ({
      solvedAt: record.solvedAt,
      updatedAt: record.updatedAt,
      isDone: record.isDone !== false && record.deleted !== true,
    }),
    fromCloud: (problemId, data) => {
      const fields = isoRecord(data);
      if (!problemId || typeof fields?.solvedAt !== "string") return null;
      return {
        problemId,
        solvedAt: fields.solvedAt,
        updatedAt:
          typeof fields.updatedAt === "string" ? fields.updatedAt : fields.solvedAt,
        isDone: fields.isDone !== false && fields.deleted !== true,
      };
    },
    readRecord: (problemId) => getRecord("solves", problemId!),
    writeRecord: (record) => putRecord("solves", record, "remote"),
    refreshSummary: true,
  },
  {
    name: "notes",
    store: "notes",
    kind: "collection",
    collection: "notes",
    docId: (record) => record.id,
    // Shared-marker copies live here for offline rendering but sync
    // through their shared cloud doc — never upload them. Owned
    // soft-deletes DO upload (that's delete propagation).
    shouldPush: (record) => !record.shared,
    tombstone: (record) => record.isDeleted === true || record.deleted === true,
    toCloud: (record) => stripKey(record),
    fromCloud: (noteId, data) => {
      const fields = isoRecord(data);
      if (!noteId || !fields) return null;
      return {
        ...fields,
        id: noteId,
        isDeleted: fields.isDeleted === true || fields.deleted === true,
      };
    },
    readRecord: (noteId) => getRecord("notes", noteId!),
    writeRecord: (record) =>
      record.isDeleted === true || record.deleted === true
        ? putRecord("notes", record, "remote")
        : writeNote(record, "remote"), // sanitizes + stamps through one path
    guardLocalWrites: true,
    refreshSummary: false,
  },
  {
    name: "settings",
    store: "settings",
    kind: "doc",
    collection: "settings",
    doc: SETTINGS_DOC_ID,
    toCloud: (row) => ({
      weeklyTarget: row.weeklyTarget,
      weeklyTargetAt: row.weeklyTargetAt,
      months: row.months ?? {},
      monthAt: row.monthAt ?? {},
      updatedAt: row.updatedAt,
    }),
    fromCloud: (_id, data) => {
      const fields = isoRecord(data);
      if (!fields) return null;
      return { key: "settings", ...fields };
    },
    readRecord: () => readSettingsRow(),
    writeRecord: (row) => writeSettingsRow(row),
    clearLocal: () => deleteRecord("settings", "settings", "remote"),
    refreshSummary: false,
  },
  {
    name: "rewardEvents",
    store: "rewardEvents",
    kind: "collection",
    collection: "rewardEvents",
    docId: (record) => record.id,
    tombstone: (record) => record.isRevoked === true || record.deleted === true,
    toCloud: (record) => ({
      kind: record.kind,
      periodStart: record.periodStart,
      target: record.target,
      status: record.status,
      earnedAt: record.earnedAt,
      updatedAt: record.updatedAt,
      isRevoked: record.isRevoked === true || record.deleted === true,
    }),
    fromCloud: (eventId, data) => {
      const fields = isoRecord(data);
      if (!eventId || !fields) return null;
      return {
        id: eventId,
        ...fields,
        isRevoked: fields.isRevoked === true || fields.deleted === true,
      };
    },
    readRecord: (eventId) => getRecord("rewardEvents", eventId!),
    writeRecord: (record) => putRecord("rewardEvents", record, "remote"),
    refreshSummary: true,
  },
];
