// Cloud sync engine: mirrors local IndexedDB state to Firestore and merges
// remote changes back. Local stays the source of truth — if anything here
// fails, the app behaves exactly like the offline version.
//
// Model: users/{uid}/state/{key} = { value: JSON-string, updatedAt: ISO }
// Keys synced: progress, notes, plans, rewards. Theme and qotd caches are
// device-specific and never synced.
//
// Merge strategies (lib/cloud/merge.js):
//   progress — per-problem LWW union (solves are never lost)
//   rewards  — union, collected > earned
//   notes, plans — last-write-wins by updatedAt, with a typing guard so a
//     remote change never clobbers notes being edited right now

import { useEffect, useRef, useState } from "react";
import {
  KEYS,
  getJSON,
  removeItem,
  setJSON,
  subscribe,
} from "../db.js";
import { loadFirestore } from "./firebase.js";
import { mergeProgress, mergeRewards, lwwNewer } from "./merge.js";
import { readNotesBlob, writeNotesBlob, clearAllNotes } from "../notes.js";
import { computeSummary } from "./profileSummary.js";
import { invalidateProfile } from "./follow.js";
import {
  pushSummaryToConnections,
  registerEmailIndex,
} from "./connections.js";

const SYNCED_KEYS = [KEYS.progress, KEYS.notes, KEYS.plans, KEYS.rewards];
const PUSH_DEBOUNCE_MS = 1500;
const NOTES_TYPING_GUARD_MS = 3000;

let kit = null;
const fs = () => (kit ??= loadFirestore());

const stateRef = async (uid, key) => {
  const { db, m } = await fs();
  return m.doc(db, "users", uid, "state", key);
};

// Public profile lives at profiles/{uid} (top-level) — Firestore doc paths
// need an even number of segments, so users/{uid}/profile (3) is invalid.
const profileRef = async (uid) => {
  const { db, m } = await fs();
  return m.doc(db, "profiles", uid);
};

// Writes the public stats snapshot, preserving displayName/shareEnabled,
// and keeps every connected peer's leaderboard entry up to date.
export async function refreshProfileSummary(uid) {
  const summary = await computeSummary();
  const { m } = await fs();
  const ref = await profileRef(uid);
  await m.setDoc(
    ref,
    { summary, updatedAt: new Date().toISOString() },
    { merge: true }
  );
  await pushSummaryToConnections(uid, summary).catch(() => {});
}

async function readLocalValue(key) {
  // Notes live as per-note records locally; the cloud doc stays one
  // aggregate JSON string (see lib/notes.js).
  if (key === KEYS.notes) return await readNotesBlob();
  const fallback = key === KEYS.progress || key === KEYS.rewards ? {} : null;
  return await getJSON(key, fallback);
}

async function writeLocalValue(key, value) {
  if (key === KEYS.notes) await writeNotesBlob(value, "remote");
  else await setJSON(key, value, "remote");
}

function sameJson(a, b) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

// Merge one remote doc into local. Returns true if local changed.
async function applyRemote(key, data, st) {
  if (typeof data?.value !== "string") return false;
  const remoteAt = Date.parse(data.updatedAt ?? "") || 0;
  const localWrite = st.lastLocalWrite[key] ?? 0;

  if (key === KEYS.notes || key === KEYS.plans) {
    if (!lwwNewer(remoteAt, localWrite)) return false;
    // never clobber notes that were just typed locally
    if (key === KEYS.notes && Date.now() - localWrite < NOTES_TYPING_GUARD_MS)
      return false;
  }

  let remoteValue;
  try {
    remoteValue = JSON.parse(data.value);
  } catch {
    return false;
  }
  const localValue = await readLocalValue(key);

  let merged;
  if (key === KEYS.progress)
    merged = mergeProgress(localValue ?? {}, remoteValue ?? {});
  else if (key === KEYS.rewards) merged = mergeRewards(localValue, remoteValue);
  else merged = remoteValue;

  if (sameJson(localValue, merged)) return false;
  await writeLocalValue(key, merged);
  return true;
}

async function pushDirty(uid, st, setStatus) {
  if (st.pushing || !st.dirty.size) return;
  st.pushing = true;
  const keys = [...st.dirty];
  try {
    setStatus({ state: "syncing", at: Date.now() });
    for (const key of keys) {
      const value = await readLocalValue(key);
      if (value == null) continue; // never-written key
      const { m } = await fs();
      await m.setDoc(
        await stateRef(uid, key),
        { value: JSON.stringify(value), updatedAt: new Date().toISOString() },
        { merge: true }
      );
      st.dirty.delete(key);
    }
    if (keys.includes(KEYS.progress) || keys.includes(KEYS.rewards)) {
      await refreshProfileSummary(uid).catch(() => {});
    }
    st.dirty.clear();
    setStatus({ state: "synced", at: Date.now() });
  } catch (err) {
    console.warn("[cloud sync] push failed", err);
    setStatus({
      state: navigator.onLine ? "error" : "offline",
      at: Date.now(),
      message: err?.message,
      code: err?.code,
    });
    // keep failed keys dirty; retried on next write or connectivity
  } finally {
    st.pushing = false;
  }
}

function teardown(st) {
  if (!st) return;
  clearTimeout(st.timer);
  for (const unsub of st.unsubs) {
    try {
      unsub();
    } catch {}
  }
  st.unsubs.length = 0;
  if (st.onOnline) window.removeEventListener("online", st.onOnline);
}

export function useCloudSync(user) {
  const [status, setStatus] = useState({ state: "idle", at: null });
  const stRef = useRef(null);

  useEffect(() => {
    if (!user) {
      teardown(stRef.current);
      stRef.current = null;
      setStatus({ state: "idle", at: null });
      return;
    }

    const st = {
      unsubs: [],
      dirty: new Set(),
      timer: null,
      lastLocalWrite: {},
      pushing: false,
      onOnline: null,
    };
    stRef.current = st;
    let active = true;

    const run = async () => {
      try {
        setStatus({ state: "syncing", at: Date.now() });

        // Account switch on this browser: merge (default) or replace local.
        const meta = (await getJSON(KEYS.cloudMeta, {})) ?? {};
        if (meta.lastSyncedUid && meta.lastSyncedUid !== user.uid) {
          const merge = window.confirm(
            `This browser last synced a different account.\n\n` +
              `OK — merge this browser's data into ${user.email ?? "the new account"}\n` +
              `Cancel — replace this browser's data with the cloud copy`
          );
          if (!merge) {
            for (const key of SYNCED_KEYS) {
              if (key === KEYS.notes) await clearAllNotes("remote");
              else await removeItem(key, "remote");
            }
          }
        }

        // Initial pull — all four state docs in parallel.
        await Promise.all(
          SYNCED_KEYS.map(async (key) => {
            const ref = await stateRef(user.uid, key);
            const { m } = await fs();
            const snap = await m.getDoc(ref).catch(() => null);
            if (!snap || !snap.exists()) {
              st.dirty.add(key); // nothing in the cloud yet — push local
              return;
            }
            await applyRemote(key, snap.data(), st);
          })
        );
        await setJSON(
          KEYS.cloudMeta,
          { ...meta, lastSyncedUid: user.uid },
          "remote"
        );

        // Seed display info on the public profile: default name if none,
        // and always keep the auth photo current (Google accounts).
        const { m } = await fs();
        const pRef = await profileRef(user.uid);
        const pSnap = await m.getDoc(pRef).catch(() => null);
        const pData = pSnap?.exists() ? pSnap.data() : null;
        const patch = {};
        if (!pData?.displayName) {
          patch.displayName =
            user.displayName ||
            (user.email ? user.email.split("@")[0] : "Solver");
        }
        if (user.photoURL && pData?.photoURL !== user.photoURL) {
          patch.photoURL = user.photoURL;
        }
        if (Object.keys(patch).length) {
          await m.setDoc(pRef, patch, { merge: true }).catch(() => {});
          invalidateProfile(user.uid);
        }

        // Register my email in the invite index (hashed) so others can
        // find this account by email.
        await registerEmailIndex(user);

        if (!active) return;

        // Live remote changes (multi-device).
        for (const key of SYNCED_KEYS) {
          const ref = await stateRef(user.uid, key);
          const unsub = m.onSnapshot(
            ref,
            (snap) => {
              if (snap.exists()) {
                applyRemote(key, snap.data(), st).catch(() => {});
              }
            },
            (err) => {
              console.warn("[cloud sync] listener failed", err);
              setStatus({
                state: "error",
                at: Date.now(),
                message: err?.message,
                code: err?.code,
              });
            }
          );
          st.unsubs.push(unsub);
        }

        // Local writes → debounced push.
        st.unsubs.push(
          subscribe((key, source) => {
            if (source !== "local" || !SYNCED_KEYS.includes(key)) return;
            st.lastLocalWrite[key] = Date.now();
            st.dirty.add(key);
            clearTimeout(st.timer);
            st.timer = setTimeout(
              () => pushDirty(user.uid, st, setStatus).catch(() => {}),
              PUSH_DEBOUNCE_MS
            );
          })
        );

        // Retry after connectivity returns.
        st.onOnline = () => {
          if (st.dirty.size) {
            pushDirty(user.uid, st, setStatus).catch(() => {});
          }
        };
        window.addEventListener("online", st.onOnline);

        // Anything marked dirty during the pull (fresh account, or local
        // writes while signing in).
        if (st.dirty.size) {
          st.timer = setTimeout(
            () => pushDirty(user.uid, st, setStatus).catch(() => {}),
            PUSH_DEBOUNCE_MS
          );
        }

        setStatus({ state: "synced", at: Date.now() });
      } catch (err) {
        console.warn("[cloud sync] setup failed", err);
        if (active) {
          setStatus({
            state: "error",
            at: Date.now(),
            message: err?.message,
            code: err?.code,
          });
        }
      }
    };
    run();

    return () => {
      active = false;
      teardown(st);
    };
  }, [user?.uid]);

  return { status };
}

// Human-readable diagnosis for the sync-error state.
export function syncErrorHint(status) {
  const code = status?.code ?? "";
  if (code === "permission-denied")
    return "Cloud database rejected access. Open the Firebase console → Firestore → Rules tab, paste the contents of firestore.rules from this repo, and click Publish. (Default production-mode rules deny everything.)";
  if (code === "failed-precondition")
    return "The Firestore database doesn't exist yet (or is disabled). Firebase console → Firestore Database → click 'Create database' (production mode, any region).";
  if (code === "unavailable")
    return "Can't reach Firestore right now — check your connection. Data is safe locally and will sync when back online.";
  if (code === "unauthenticated")
    return "Your session expired — sign out and sign in again.";
  if (code === "resource-exhausted")
    return "Firestore quota exceeded — check usage in the Firebase console.";
  return status?.message || "Unknown error — see the browser console for details.";
}
