# Data model redesign — plan

> Status: **built.** Decisions (§8) locked: `users/{uid}/settings/preferences`, stored rewardEvents, remote-wins ties. **No legacy data: fresh start — migration (§6), `legacy:*` quarantine, and v1 backup compat were DROPPED.** Storage/sync fully rewritten for modularity; functionality unchanged. **Schema v3 + TypeScript landed** (see `docs/schema-v3-plan.md`): six typed stores (no `kv`, no `pref:` keys), single-row `syncState`, rewrite-layer modules in `.ts`.

## 0. Goals & constraints

- Keep local-first + offline: app must work with zero cloud, IndexedDB stays source of truth.
- Make sync record-level instead of blob-level (smaller writes, fewer conflicts, no bespoke merge math per feature).
- Firestore must be queryable/indexable (no JSON-string-in-a-field hacks) and rules must see real fields (e.g. `shareEnabled`, `ownerUid`).
- Preserve: export/import backup compat, account-switch merge/replace flow, typing guard, undo/reset propagation.

## 1. Current-state audit (what's wrong today)

| Area | Current shape | Problem |
|---|---|---|
| `progress` (local + cloud) | One map `{url: ISO-timestamp}`; cloud = whole map as a JSON **string** in `users/{uid}/state/progress` | Every toggle rewrites + uploads the entire blob (grows with solved count); `/` in URLs forces the string-in-string hack; hand-rolled 3-way merge with clock-dependent undo heuristics; delete = key removal, no tombstone |
| `rewards` | `{daily: {date: earned\|collected}, weekly: {...}}`, same blob treatment | Derived data (computable from solve timestamps + target history) stored as second source of truth with its own merge strategy; 2 of 5 sync strategies exist just for this |
| `plans` | `{weeklyTarget, months, monthAt}` blob | Field-level LWW reimplemented by hand (`mergePlans` ~70 lines) |
| `notes` | Local is already per-record (`dsa-note-v1:{id}` + index + `deleted` tombstones) but cloud is one aggregate blob | Best local design in the app, thrown away at the sync boundary; tombstones serialized into the blob; typing guard is a global 3s timer on the whole blob |
| `profiles`, `invites`, `sent`, `connections`, `sharedNotes`, `emails` | Proper entity docs | ✅ Keep — this is the target pattern for everything else |
| Leaderboard | Fan-out: N connection-doc writes per solve (`pushSummaryToConnections`) | Write amplification; stale copies if a fan-out fails; duplicates peer data instead of referencing it |
| Problem identity | Work-at-tech **URL** as the key everywhere | Unstable (site restructures URLs → identity breaks), verbose, un-queryable |

## 2. Target schema

**Local IndexedDB — `ascent-db` v3**, one object store per entity (keyPath + indexes). Six stores (details in `docs/schema-v3-plan.md` §2):

- `solves` — key `problemId`, value `{ problemId, solvedAt, updatedAt, isDone }`. `isDone` is a live STATE flag (solved ⇄ unsolved), not a tombstone — rows are never pruned. Index on `updatedAt` for change cursors.
- `notes` — keep existing per-note layout, formalized: `{ id, title, body, createdAt, updatedAt, isDeleted? }` + sharing markers stay (`shared, ownerUid, sharedId`). Soft-deletes pruned 30d after sync.
- `settings` — one row (`key: "settings"`): `{ weeklyTarget, weeklyTargetAt, months, monthAt, updatedAt }`. Synced only.
- `rewardEvents` — replace `rewards` blob: `{ id: "YYYY-MM-DD:daily" | "YYYY-Www:weekly", kind, periodStart, target, status: earned|collected, earnedAt, updatedAt }`. Append-mostly, tiny, per-record LWW. Recomputable from solves + target history but stored so "earned" survives target changes (current semantic preserved).
- `prefs` — device-local rows (`key: name`): `theme`, `qotd`, `qotdIgnored`. Never synced.
- `syncState` — one row (`key: "state"`): `{ uid, cursors: { entity: ISO|null } }` — push cursors + last-used account. No full-blob `base` snapshots (3-way baseline merge goes away entirely). The legacy `kv` store is deleted in the v3 upgrade.

**Firestore** — mirror the same entities under the owner, replacing `state/*`:

- `users/{uid}/solves/{problemId}` = `{ solvedAt, updatedAt, isDone }` (state row — never pruned)
- `users/{uid}/notes/{noteId}` = `{ title, body, createdAt, updatedAt, isDeleted }` (private notes; `sharedNotes` top-level stays for collaborative ones)
- `users/{uid}/settings/preferences` = settings row (single doc — decided, §8.1; nested one level because doc paths need an even segment count)
- `users/{uid}/rewardEvents/{eventId}` = reward event
- `profiles/{uid}` — unchanged, but computed from entity stores (summary already is; no change in shape)
- Connections/read models unchanged, except leaderboard fan-out (see §4)

**Stable problem IDs (decided)**: random 16-char surrogate keys, not ordinals. Each CSV row gets an `id` column; the existing `#` column stays as display order only and rows may be reordered / inserted freely without affecting identity. Rules:

- Format: 16 chars, `[a-z0-9]`, generated once from crypto randomness (`crypto.getRandomValues` — ~95 bits, collision-safe). Random (not sequential) so problems can be added from anywhere with no "next free number" coordination.
- Generate once, never regenerate, never reuse after deletion.
- Same problem listed under two topics shares one id: ~10 workat.tech URLs currently appear in multiple CSVs (e.g. `three-sum`, `word-break`, `trapped-rain-water`), and today solving one solves both (URL-keyed). Preserve that: dedupe by `Link` column — same Link → copy the existing `id`. Opaque ids avoid implying a "home" topic for shared problems.
- `url` (`Link` column) becomes a plain attribute used only for outbound links, never as a key.
- Enforcement: a `validate-data` script (run pre-build) checks `id` uniqueness across all CSVs, format `^[a-z0-9]{16}$`, and that every row has a non-empty `id` and `#`. Build fails on violation — a duplicated id would otherwise silently merge two problems' progress.
- Runtime: a single problem index (`id` → `{ id, seq, topic, name, url, difficulty, score, equivalents }`) built from CSVs; all features (solves store key, points, heatmap, leaderboard math) key by `id`.
- Migration: old URL-keyed solves map to `id` via the `Link` column (same Link → same id, so shared-topic solves collapse correctly); URLs with no CSV match → `legacy:{sha8(url)}` with `url` preserved (see §6).

## 3. Entity models (field-level)

Conventions for every synced entity: timestamps are ISO-8601 strings with ms
(`new Date().toISOString()`); every record carries `updatedAt` (sync clock);
**deletes/state are domain flags** — solves `isDone` (live state row, never
pruned), notes `isDeleted`, rewards `isRevoked` (the last two pruned 30d
after being synced everywhere; the engine asks each entity `tombstone(record)`);
sync conflicts resolve per-record LWW on
`updatedAt` (§4); exact ties (same ms) resolve **remote-wins** (decided §8.5 —
simpler; ties are vanishingly rare). `?` = optional, `PK` = primary key (IDB keyPath / Firestore doc id).

```
Catalog (bundled, read-only)          User data (synced, owner-only)
  Problem                               Solve ──derived──▶ summary ──▶ Profile
  (CSV + topics.js)                     Note ──shared?──▶ SharedNote
                                        Settings (targets + plans)
                                        RewardEvent
Social (existing, unchanged shape)      Local-only
  Connection  Invite  Sent                SyncMeta  DevicePrefs
  EmailIndex  SharedWithMe(inbox)
```

### E1 — Problem (catalog, read-only, bundled with the app)

Not user data: ships in `source/*.csv` + `src/data/topics.js`, loaded via
fetch and cached. Never stored in IDB, never synced. Runtime builds one index:
`byId`, plus per-topic lists ordered by `seq`.

| Field | Type | Notes |
|---|---|---|
| `id` | string `^[a-z0-9]{16}$`, PK | Stable surrogate; dedupe by `Link` for cross-topic shared problems |
| `seq` | int | Display order = `#` column value within its topic file; reorder-safe |
| `topic` | string (slug) | e.g. `arrays`, `dynamic-programming` |
| `name` | string | `Problem Name` |
| `url` | string (URL) | `Link` — outbound links only, never a key |
| `score` | int | `Score` — points weight |
| `accuracy` | string | `Accuracy` as published (e.g. `54%`) |
| `difficulty` | `easy`\|`medium`\|`hard` | `Difficulty`, lowercased |
| `companies` | string | `Companies`, opaque |
| `lcName` / `lcUrl` | string | LeetCode equivalent + link |
| `otherName` / `otherUrl` | string | Other-platform equivalent + link |
| `note` | string | Curator note (`Notes` column) |

Constraints (enforced by `validate-data`, pre-build): `id` unique across all
files; `seq` unique within a topic; every row has non-empty `id`, `#`, `name`, `Link`.

### E2 — Solve (user progress)

| Field | Type | Notes |
|---|---|---|
| `problemId` | string, PK | E1 `id` |
| `solvedAt` | ISO timestamp | When the user marked it solved; drives streaks/heatmap/weekly stats |
| `updatedAt` | ISO timestamp | Sync clock (bumped on solve *and* on unsolve) |
| `isDone` | bool | `true` = solved, `false` = unchecked. Live state row — unchecking keeps the row (re-solving flips it back); never pruned |

- Local: IDB store `solves`, keyPath `problemId`, index on `updatedAt` (sync cursor).
- Cloud: `users/{uid}/solves/{problemId}` = same fields.
- Lifecycle: toggle on → `isDone: true` (fresh `solvedAt`); toggle off → `isDone: false` (row kept); reset-all → flip every done row to `false` (no generation counters).
- Merge: per-record LWW. Concurrent solve + unsolve → later action wins.
- Derived, never stored: solved count, points (via E1 `score`), streaks, heatmap, rank, `summary`.

### E3 — Note (private)

| Field | Type | Notes |
|---|---|---|
| `id` | string, PK | Client-generated (`crypto.randomUUID()`), never reused |
| `title` | string ≤120 | |
| `body` | string ≤12000 | |
| `createdAt` / `updatedAt` | ISO timestamps | |
| `shared` | bool | True once shared (marker only; content lives in E4) |
| `ownerUid` / `ownerName` / `sharedId` | strings | Present only when `shared`; `sharedId` = E4 doc id |
| `isDeleted` | bool | Soft delete (was `deleted` tombstone); pruned 30d after sync |

- Local: IDB store `notes`, keyPath `id`, index on `updatedAt` (formalizes today's `dsa-note-v1:{id}` layout).
- Cloud: `users/{uid}/notes/{noteId}` = same fields.
- Merge: per-record LWW + per-note typing guard (skip a remote update that lands within 3s of a local keystroke).
- Limits: `MAX_NOTES = 10` (unchanged).

### E4 — SharedNote (collaborative) — shape unchanged, documented

- `sharedNotes/{noteId}` = `{ ownerUid, ownerName, title, body, createdAt, updatedAt, members: [uid…] (owner first), memberInfo: { uid: { displayName, photoURL } } }`.
- `users/{uid}/sharedWithMe/{noteId}` (discovery inbox) = `{ shareId, ownerUid, ownerName, title, updatedAt }`.
- Sync is save-based, not realtime: writers push on save, readers pull on open. Owner manages members; members edit title/body only (rules-enforced).

### E5 — Settings (targets + plans — synced row only)

Single-row entity. Device-local prefs (theme, qotd) live in the separate
`prefs` store (E13) — not here.

| Field | Type | Synced? | Notes |
|---|---|---|---|
| `weeklyTarget` | pos int | ✅ | Default 21 |
| `weeklyTargetAt` | ISO timestamp | ✅ | LWW clock for the target |
| `months` | `{ YYYY-MM: [topicSlug…] }` | ✅ | Monthly topic plans |
| `monthAt` | `{ YYYY-MM: ISO }` | ✅ | Per-month LWW clocks (kept from `mergePlans`) |
| `updatedAt` | ISO timestamp | ✅ | Bumped on any synced-field write |

- Local: IDB store `settings`, single row key `"settings"`.
- Cloud: `users/{uid}/settings/preferences` (decided §8.1; doc id `SETTINGS_DOC_ID`).
- Merge: whole-doc LWW on `updatedAt` — replaces the 70-line `mergePlans`. Rationale: single-user settings, conflicts are vanishingly rare, and per-field clocks stay as tiebreak metadata if we ever need them back.

### E6 — RewardEvent (replaces `rewards` blob)

| Field | Type | Notes |
|---|---|---|
| `id` | string, PK | `{YYYY-MM-DD}:daily` \| `{YYYY-Www}:weekly` (week = Monday key) |
| `kind` | `daily`\|`weekly` | Redundant with `id` suffix; kept for queries |
| `periodStart` | `YYYY-MM-DD` | The day / week-Monday this event covers |
| `target` | pos int | Daily-target snapshot at earn time (preserves "earned survives target change") |
| `status` | `earned`\|`collected` | Only moves `earned` → `collected`; auto-collect on earn (current behavior) |
| `earnedAt` / `updatedAt` | ISO timestamps | |
| `isRevoked` | bool | Reset flow (was `deleted` tombstone); pruned 30d after sync |

- Local: IDB store `rewardEvents`, keyPath `id`, index on `updatedAt`.
- Cloud: `users/{uid}/rewardEvents/{eventId}`.
- Merge: per-record LWW (status monotonicity makes conflicts nearly impossible).
- Derived: stars = count of `kind: daily` events (current rule: `collected`); crowns = count of `kind: weekly`. Counting rule must be pinned here, not scattered in UI code.

### E7 — Profile (public stats snapshot)

- `profiles/{uid}` = `{ displayName, photoURL, shareEnabled: bool, summary: { solved, points, streak, rank, stars, crowns, total?, updatedAt }, updatedAt }`.
- Computed client-side from E1+E2+E6 after every solve/reward change; pushed with `{merge: true}` preserving `displayName`/`shareEnabled`.
- Rules: read if owner or `shareEnabled == true`; write owner only. Unchanged.
- Post-fan-out-removal (§4): the *only* place peer stats live — leaderboard reads these docs directly.

### E8 — Connection — slimmed (drop stamped summaries)

- `users/{uid}/connections/{peerUid}` = `{ uid: peerUid, displayName, photoURL }`. **No `summary` copy** (fan-out deleted; see §4).
- Rules simplify to owner-only read/write (the peer-write allowance existed only for fan-out updates).

### E9 — Invite / E10 — Sent — unchanged

- `users/{uid}/invites/{fromUid}` = `{ uid, displayName, photoURL, status: pending\|accepted\|rejected, createdAt }`. Created by the inviter (`uid == auth.uid`, `status == pending`); updated only by the owner.
- `users/{uid}/sent/{toUid}` = `{ uid, email, status, createdAt }`. Owner CRUD; invitee may update own status.
- Plus the `sendInviteToUid` / pending-invite guards already in `connections.js`.

### E11 — EmailIndex — unchanged

- `emails/{sha256(email)}` = `{ uid }`. Read: any signed-in user (single-hash resolve); write: own `uid` only. No enumeration by design.

### E12 — SyncState (local only, replaces `cloudMeta`)

- IDB store `syncState`, single row `{ key: "state", uid, cursors: { "solves"|"notes"|"settings"|"rewardEvents": ISO|null }, updatedAt }` — all push cursors plus the last-used account uid (account-switch detection) in one read/write.
- No full-blob `base` snapshots (3-way merge is gone); the cursors are the entire bookkeeping.

### E13 — DevicePrefs (local only, never synced)

- IDB store `prefs`, rows `{ name, value, updatedAt }`: `theme`, `qotd`, `qotdIgnored`. Explicitly excluded from sync (backups are local files, so they may still include theme — unchanged behavior). No more `pref:` prefix keys inside the settings store.

## 4. Sync protocol v2 (replaces 3-way baseline merge)

One generic engine, same code path for solves/notes/settings/rewardEvents:

- **Per-record LWW by `updatedAt` (ISO, ms precision)**; exact ties resolve **remote-wins** (decided §8.5).
- **Deletes = domain flags** (`solves.isDone: false` state rows — never pruned; `notes.isDeleted: true` / `rewardEvents.isRevoked: true` — pruned locally 30d after the push cursor proves peers saw them). This deletes the entire class of "undo doesn't propagate" special cases — a state change is just a record write.
- **Push**: query local store `updatedAt > cursor`, `setDoc` each changed record (no transactions, no read-modify-write), advance cursor. Debounced 1.5s as today.
- **Pull**: `onSnapshot` per collection (not per doc) with `where(updatedAt > lastSeen)`; apply LWW locally. Multi-device falls out naturally — no `state/*` doc listeners.
- **Conflict policy**: LWW per record is the whole policy. Consequences: concurrent edits to the same note on two offline devices → last writer wins (acceptable; keep per-field out of scope). Concurrent solve + unsolve → the later action wins (actually *more* correct than today).
- **Fan-out removal**: connections store `{peerUid, displayName, photoURL}` only; leaderboard reads peer `profiles/{uid}` docs directly (already public/shared-gated) instead of stamped copies. Kills write amplification and stale-copy bugs; `pushSummaryToConnections` and the "invite/update entry" write paths are deleted.
- **Typing guard**: moves from blob-global to per-note (skip applying a remote note update newer than local edit within 3s; or drop it — per-record LWW + fast typing makes collisions rare; recommend keeping a lightweight version).

What disappears: `merge.js` strategies for progress/rewards/plans (keep per-note helpers only if needed during migration), `base` snapshots, `localAt` clock heuristics, JSON-string fields, `state/*` collection.

## 5. Rules changes (`firestore.rules`)

- New owner-only matches: `users/{uid}/solves/{id}`, `users/{uid}/notes/{id}`, `users/{uid}/rewardEvents/{id}`, settings doc. Same `isOwner` pattern — no new trust model.
- Delete `state/*` match after migration (or keep read-only during transition — decide in §7).
- No change needed for invites/sent/connections/profiles/emails/sharedNotes.
- Validation hardening now possible (real fields!): e.g. `rewardEvents` status in `["earned","collected"]`, note body size limit — recommend adding.

## 6. Migration — DROPPED (fresh start, no legacy data)

No v1→v2 migrator, no URL→id mapping at runtime, no v1 backup import.
Old `state/*` cloud docs are orphaned (owner-only, kilobytes); delete them
by hand in the Firebase console if desired. `urlToProblemId` was removed
as dead code.

## 7. Rollout phases — all built ✅

1. **Schema + ID mapping** ✅ — IDB v2 stores (`store/schema.js`, `store/records.js`), 16-char CSV ids + `validate-data` prebuild gate, problem index (`data/problemRows.js`, `data/problems.js`) with unit tests.
2. **Local cutover** ✅ — `entities/solves.js` (+`useSolves`), `entities/settings.js` (targets/months/theme/prefs/qotd), rewards engine on `rewardEvents`, `entities/notes.js` on the `notes` store; all pages on E1 problem ids. Deleted: `lib/db.js`, `lib/progress.js`, `lib/theme.js`, `gamification/plans.js`.
3. **Sync v2** ✅ — generic engine (`cloud/sync/engine.js`) + entity configs (`cloud/sync/entities.js`); per-record LWW remote-wins-ties, deletes as syncable records, cursors, typing guard, 30d prune of soft-delete rows. Deleted: old `merge.js` strategies, blob sync.
4. **Fan-out removal + rules** ✅ — connections are identity-only, leaderboard reads live `profiles/{uid}` (`follow.subscribeProfile`); `firestore.rules` rewritten for entity collections (owner-only + light validation). Deleted: `pushSummaryToConnections`, legacy `following/*`, `state/*` rules.
5. **Migration + cleanup** ✅ — dropped (fresh start); dead code deleted; new tests: `tests/sync-engine.test.js` (LWW), `tests/backup.test.js` (v2 sanitizers).
6. **Schema v3 + TypeScript** ✅ — six typed stores (kv deleted, `prefs`/`syncState` added), single LWW merge core in the engine, account handling inside the engine, rewrite-layer modules converted to `.ts` (`npm run typecheck`). See `docs/schema-v3-plan.md`.

## 8. Open questions — decided ✅

1. **Settings doc placement** → `users/{uid}/settings/preferences` (updated by schema v3 — doc paths need an even segment count).
2. **Reward events vs. pure derivation** → stored `rewardEvents`.
3. **Legacy URL fallback** → quarantine as `legacy:*`.
4. **Old cloud `state/*` docs** → one-shot cleanup after stable v2.
5. **LWW ties** → remote wins.
