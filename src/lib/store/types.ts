// Record row shapes for every IDB store (docs/schema-v3-plan.md §2).
// Kept separate from records.ts so entity modules can import types
// without pulling in the IDB machinery.

// Domain flags replace the old generic `deleted` tombstone:
//   solves       -> isDone      (live state: solved / not solved)
//   notes        -> isDeleted   (soft delete)
//   rewardEvents -> isRevoked   (reset flow)
// Pre-flag rows may still carry `deleted: true` — read sites treat that as
// the equivalent flag; no new write ever produces `deleted`.

export interface SolveRecord {
  problemId: string;
  solvedAt: string;
  updatedAt: string;
  /** true = solved, false = unsolved (row stays, is NOT a tombstone). */
  isDone: boolean;
}

export interface NoteRecord {
  id: string;
  // Optional: minimal delete rows carry only { id, updatedAt, isDeleted }.
  title?: string;
  body?: string;
  createdAt?: string;
  updatedAt: string;
  /** Soft delete — still pruned 30d after every peer has seen it. */
  isDeleted: boolean;
  /** Marker copy of a shared note — offline rendering only, never pushed. */
  shared?: boolean;
  ownerUid?: string;
  ownerName?: string;
  /** Shared cloud id (differs from local id for marker copies). */
  sharedId?: string;
}

export interface SettingsRow {
  key: "settings";
  weeklyTarget?: number;
  weeklyTargetAt?: string;
  /** { "YYYY-MM": [topicSlug, ...] } */
  months?: Record<string, string[]>;
  /** { "YYYY-MM": ISO } — per-month rotation clock */
  monthAt?: Record<string, string>;
  updatedAt?: string;
}

export interface RewardEventRecord {
  id: string;
  kind: "daily" | "weekly";
  periodStart: string;
  target?: number;
  status: "earned" | "collected";
  earnedAt?: string;
  updatedAt: string;
  /** Reset flow — still pruned 30d after every peer has seen it. */
  isRevoked: boolean;
}

export interface PrefRecord {
  name: string;
  value: unknown;
  updatedAt: string;
}

export interface SyncStateRow {
  key: "state";
  /** Last account that used this browser's sync (account-switch detection). */
  uid?: string | null;
  /** entity name -> last pushed/applied updatedAt ISO */
  cursors?: Record<string, string | null>;
  updatedAt?: string;
}

/** Primary mapping: store name -> row type. Mirrors STORES in schema.ts. */
export interface StoreMap {
  solves: SolveRecord;
  notes: NoteRecord;
  settings: SettingsRow;
  rewardEvents: RewardEventRecord;
  prefs: PrefRecord;
  syncState: SyncStateRow;
}

export type StoreName = keyof StoreMap;

/** Write origin: "local" marks the record dirty for sync; "remote" must not. */
export type WriteSource = "local" | "remote";
