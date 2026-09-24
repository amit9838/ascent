# Clean schema v3 — plan (implemented ✅)

> Verification: `npm run typecheck` + `npm test` + `npm run build` green.

> Context: all local + cloud data wiped. No migration, no backward compat,
> no legacy reads. Every store gets one entity, one key, documented fields.
> Nothing KV-shaped survives except where the data genuinely is a setting.
>
> Decisions locked (§7): single `prefs` store; account uid folded into the
> `syncState` row; backup filename renamed; **TypeScript for the rewrite
> layer** (§8); **no state library** — pub/sub + hooks stay (§9).

## 0. Goals

- One store = one entity = one keyPath. No mixed-purpose stores, no string-prefixed keys (`pref:*`), no `kv` catch-all.
- Sync-relevant fields live only in synced stores; device-local data lives only in local stores. A reader can tell what syncs by the store name.
- Same Firestore paths as today (they're already clean) — this rewrite is local-schema + module cleanup.
- While touching these files: apply the logic cleanup from §8 and land them as TypeScript.
- Honest note: schema clarity alone doesn't change sync *behavior*. The unsolve-sync robustness (per-entity push isolation, currently reverted) is tracked as follow-up F1 below.

## 1. Residue audit (what's still KV-ish today)

| # | Location | Problem |
|---|---|---|
| R1 | `store/schema.js` + `records.js`: `kv` store created/preserved | Dead weight kept for a migration that will never run |
| R2 | `settings` store holds the synced settings row **and** `pref:theme`, `pref:qotd`, `pref:qotdIgnored` rows | Mixed synced/local data in one store; prefix-keys are KV thinking |
| R3 | `sync` store holds `{entity, cursor}` rows + an `account` row | Entity-keyed rows; cursor and account are different concerns sharing a store |
| R4 | Cosmetic `dsa-` strings (`dsa-progress-` filename, `dsa-qotd:` seed) | Harmless but pre-rewrite naming; normalize to `ascent-` |

## 2. Target schema — `ascent-db` v3

Six stores, each with keyPath + typed fields. `kv` is deleted in the upgrade (`deleteObjectStore`), which is safe because all data was wiped.

| Store | keyPath | Fields | Syncs? |
|---|---|---|---|
| `solves` | `problemId` | `problemId`, `solvedAt`, `updatedAt`, **`isDone`** (state flag: solved ⇄ unsolved — never pruned) | ✅ collection `solves` |
| `notes` | `id` | `id`, `title`, `body`, `createdAt`, `updatedAt`, **`isDeleted`** (soft delete, pruned 30d after sync), `shared?`, `ownerUid?`, `ownerName?`, `sharedId?` | ✅ owned only → collection `notes` |
| `settings` | `key` (single row `"settings"`) | `weeklyTarget`, `weeklyTargetAt`, `months`, `monthAt`, `updatedAt` | ✅ doc `settings/preferences` |
| `rewardEvents` | `id` | `id`, `kind`, `periodStart`, `target`, `status`, `earnedAt`, `updatedAt`, **`isRevoked`** (reset flow, pruned 30d after sync) | ✅ collection `rewardEvents` |
| `prefs` *(new)* | `name` | `name`, `value`, `updatedAt` — rows: `theme`, `qotd`, `qotdIgnored` | ❌ never |
| `syncState` *(replaces `sync` store)* | `key` (single row `"state"`) | `{ uid, cursors: { solves?, notes?, settings?, rewardEvents? } }` — one row, one read/write per cycle | ❌ local bookkeeping |

**Domain flags replace generic `deleted` tombstones** (decided): every synced entity names its state — solves `isDone` (a live state row: uncheck → `false`, re-solve → `true` again, never pruned), notes `isDeleted`, rewards `isRevoked` (both still pruned locally 30d after the push cursor proves peers saw them; the engine asks each entity via `tombstone(record)`). Pre-flag rows carrying legacy `deleted` are read leniently; no new write emits it.

Indexes: `by-updated` on `updatedAt` for `solves`, `notes`, `rewardEvents` (push cursors). No indexes on single-row stores.

Why single-row `syncState` instead of per-entity rows: cursors are always loaded/saved together at engine start/push; one get/put replaces N round trips, and the shape is self-documenting.

## 3. Module changes

- `store/schema.ts` — v3: drop `LEGACY_KV_STORE`; add `prefs` + `syncState` defs; upgrade handler deletes `kv` if present; `DB_VERSION = 3`.
- `store/records.ts` — remove kv-preservation branch (keep the generic helpers + `(store, source)` pub/sub unchanged).
- `entities/settings.ts` — split in two:
  - synced half stays (`getWeeklyTarget`, `setWeeklyTarget`, month plans, `readSettingsRow`/`writeSettingsRow`, `useWeeklyTarget`);
  - prefs half moves to `entities/prefs.ts` (`getPref`, `setPref`, `removePref`, `useTheme`) backed by the `prefs` store. No `PREF_PREFIX`, no key juggling.
- `features/home/qotd.js` — unchanged API, imports prefs from `entities/prefs.ts`.
- `cloud/sync/engine.ts` — cursor load/save goes through `readSyncState`/`writeSyncState` helpers; account uid handled inside the engine (moved out of `sync.js`).
- `cloud/sync.ts` — shrinks to React wiring + `refreshProfileSummary` + `syncErrorHint` + seed/bootstrap; loses `readLastUid`/`writeLastUid`.
- Cosmetics: `dsa-progress-` → `ascent-backup-` filename; `dsa-qotd:` → `ascent-qotd:` seed. Backup payload unchanged.
- Plan doc `data-model-redesign.md` §§2–3, E5/E12/E13 updated to v3 names.

## 4. Upgrade path (no migration code)

`onupgradeneeded` v2→v3: create `prefs` + `syncState`, `deleteObjectStore("kv")`. No data moves (nothing worth moving). Fresh sign-in re-pulls cloud state; offline-first launch starts empty, exactly like a new install. The v2 `settings`-store pref rows and `sync`-store rows are abandoned with the old version (same wiped-data assumption as everything else).

## 5. Verification

- `npm run typecheck` (new — `tsc --noEmit`, must be green).
- `npm test` (existing suites; add one test: upgrade path creates v3 stores and drops `kv` — assertable against the fake-IDB harness pattern if cheap, else manual DevTools check).
- `npm run build` (prebuild validator unaffected).
- Manual: DevTools → Application → IndexedDB → `ascent-db` shows exactly the six stores, no `kv`; toggle theme (writes `prefs`, never marks sync dirty); solve/unsolve + note + target change sync; delete-account flow unchanged.

## 6. Follow-ups (not this plan)

- **F1 — push robustness**: per-entity push isolation + retry-while-dirty (previously written, reverted). Schema v3 doesn't fix stranding; if unsolve-sync misbehaves again, this is the fix to re-apply.
- **F2 — soft-delete pruning** already in the engine (per-entity `tombstone` predicate; solves exempt). Unchanged.
- **F3 — feature `.jsx` → `.tsx`**: opportunistic, not in this pass (see §8 scope).

## 7. Resolved decisions

1. `prefs` store: single store with `name` keyPath ✅ (not one store per pref).
2. Account uid: folded into the single `syncState` row ✅.
3. Backup filename: rename to `ascent-backup-*.json` ✅.

## 8. TypeScript for the rewrite layer (Option A)

Scope: every file this plan touches — `store/`, `entities/`, `gamification/`, `cloud/sync/` + `cloud/sync.js` — lands as `.ts`. Feature `.jsx` files stay JS for now (migrated opportunistically later, F3). We're editing these files anyway, so the conversion cost is near zero and the types pay off exactly where field drift hurts most: entity configs (`toCloud`/`fromCloud`), record shapes, and the rules/paths contract.

Toolchain:

- devDeps: `typescript`, `@types/react`, `@types/react-dom` (react types only — no other new deps).
- `tsconfig.json`: `strict: true`, `noEmit: true`, `allowImportingTsExtensions: true`, `jsx: "react-jsx"`, `moduleResolution: "bundler"`, `types: ["vite/client"]`.
- New script: `"typecheck": "tsc --noEmit"`; run alongside `npm test` before finishing each phase.
- Imports inside `.ts` files use explicit `.ts` extensions — Vite resolves them, `tsc` accepts them under `allowImportingTsExtensions`, and Node 26's native type-stripping runs the existing `node --test` suites unchanged (a `.js` test can import a `.ts` source).
- `.js`-from-`.ts` imports (feature files importing the new `.ts` modules) keep the literal `.js` specifier — Vite and tsc both map it to the `.ts` source; no feature edits needed.

Typing priorities (strict where it pays, `any` where the SDK fights us):

- `sync/entities.ts`: an `EntityConfig` interface (discriminated on `kind: "collection" | "doc"`) — this is the highest-value type; it catches field drift between `toCloud` and `fromCloud` at compile time.
- `store/records.ts`: `Record<string, unknown>`-constrained `putRecord`, per-store row types via a `StoreMap` interface (`{ solves: SolveRecord, notes: NoteRecord, … }`) so `getRecord("solves", …)` is typed end to end.
- Firestore SDK calls: use its shipped types (`DocumentData`, `QueryDocumentSnapshot`); where generics get noisy, one narrow `// eslint-disable`-style `any` at the boundary, never inside entity logic.

## 9. State management — no Redux Toolkit (decided)

The app's source of truth is IndexedDB (durable) + Firestore (replica); reactivity flows through the existing `subscribeRecords` pub/sub → thin hooks. RTK would introduce a **third** in-memory copy kept in lockstep by every write path (feature write, sync pull, backup import) — the same class of drift this rewrite exists to eliminate. The real identified pain (hook boilerplate) is fixed by a shared `useEntityState` helper (§10.4). Revisit a state library only when non-durable cross-page UI state (filters, selection, undo/redo) or stale-copy debugging demands it.

## 10. Logic simplification & cleanup (audit results)

Found during the logic review — applied while rewriting the same files:

1. **Engine: three copies of the LWW-merge decision.** `applyRemoteDoc` (collections), `pullDoc` (startup), and `watchDoc` (listener) each re-implement echo-check → LWW → dirty-mark → cursor-advance. Unify: one `mergeRemote(entity, id, data)` core; `pullDoc`/`watchDoc` become thin adapters that fetch a single doc and call it. Cuts ~60 lines and kills the possibility of the three drifting.
2. **Account handling out of `sync.js`.** `readLastUid`/`writeLastUid` + the merge/replace confirm dialog are bookkeeping, not React wiring — they move into the engine's `start()` (or a small `account.js` helper using `syncState`), shrinking `sync.js` to pure UI concerns.
3. **Dead code removal** (0 callers): `solves.removeSolveRecord`, `settings.getSettingsSnapshot`. Also inline `listSolves` into `getSolvedMap` if its only consumer is that pair (verify at implementation).
4. **Shared `useEntityState(store, read)` hook** in `store/` (or a tiny `store/useEntityState.ts`): the load-then-subscribe pattern repeats in `useSolves`, `useWeeklyTarget`, `useTheme` with identical shape. One helper, three one-liners — and future entities get reactivity for free.
5. **`getSettingsSnapshot` double-read** disappears with #3 (or with `loadSettingsRow` reuse if the function stays).
6. **Naming cosmetics (R4)**: `dsa-progress-*` → `ascent-backup-*`, `dsa-qotd:` → `ascent-qotd:`.

## 11. Implementation order

1. TS toolchain (§8): devDeps + tsconfig + `typecheck` script.
2. Schema v3 + records cleanup (§2, §4) — `store/*.ts`.
3. Entities split (§3): `prefs.ts`, slim `settings.ts`, `useEntityState` (§10.4).
4. Engine rewrite (§10.1–2): `syncState` helpers, unified `mergeRemote`, account handling; `entities.ts` with `EntityConfig` types.
5. Gamification + remaining layer files → `.ts` (types only, no logic changes).
6. Dead code + naming cleanup (§10.3, §10.6).
7. Verify (§5), update `data-model-redesign.md` names.
