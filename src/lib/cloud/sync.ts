// Cloud sync wiring: mirrors local entity stores to Firestore and merges
// remote changes back. Local stays the source of truth — if anything here
// fails, the app behaves exactly like the offline version.
//
// Model (docs/schema-v3-plan.md): per-record LWW on `updatedAt` across
// users/{uid}/{solves,notes,rewardEvents}/{id} + the single
// users/{uid}/settings/preferences doc. The generic merge/push/pull
// machinery lives in sync/engine.ts; the per-entity mapping in
// sync/entities.ts; sync bookkeeping (cursors + account uid) in the local
// syncState store. This file is just React wiring (useCloudSync), the
// profile summary refresh, and the sign-in bootstrap (profile seeding +
// email index).

import { useEffect, useRef, useState } from "react";
import type { User } from "firebase/auth";
import { loadFirestore } from "./firebase.js";
import { createEngine } from "./sync/engine.ts";
import type { SyncStatus } from "./sync/engine.ts";
import { SYNC_ENTITIES } from "./sync/entities.ts";
import { computeSummary } from "./profileSummary.js";
import { invalidateProfile } from "./follow.js";
import { registerEmailIndex } from "./connections.js";

let firestoreKit = null as ReturnType<typeof loadFirestore> | null;
const fs = () => (firestoreKit ??= loadFirestore());

const profileRef = async (uid: string) => {
  const kit = await fs();
  return kit.m.doc(kit.db, "profiles", uid);
};

// Writes the public stats snapshot, preserving displayName/shareEnabled.
// The leaderboard reads profiles directly, so no fan-out is needed.
export async function refreshProfileSummary(uid: string): Promise<void> {
  const summary = await computeSummary();
  const kit = await fs();
  const ref = await profileRef(uid);
  await kit.m.setDoc(
    ref,
    { summary, updatedAt: new Date().toISOString() },
    { merge: true }
  );
  invalidateProfile(uid);
}

// Seed display info on the public profile: default name if none, and
// always keep the auth photo current (Google accounts).
async function seedProfile(user: User): Promise<void> {
  const kit = await fs();
  const ref = await profileRef(user.uid);
  const snap = await kit.m.getDoc(ref).catch(() => null);
  const data = snap && snap.exists() ? snap.data() : null;
  const patch: Record<string, string> = {};
  if (!data?.displayName) {
    patch.displayName =
      user.displayName || (user.email ? user.email.split("@")[0] : "Solver");
  }
  if (user.photoURL && data?.photoURL !== user.photoURL) {
    patch.photoURL = user.photoURL;
  }
  if (Object.keys(patch).length) {
    await kit.m.setDoc(ref, patch, { merge: true }).catch(() => {});
    invalidateProfile(user.uid);
  }
}

export function useCloudSync(user: User | null | undefined) {
  const [status, setStatus] = useState<SyncStatus>({ state: "idle", at: null });
  const engineRef = useRef<ReturnType<typeof createEngine> | null>(null);

  useEffect(() => {
    if (!user) {
      engineRef.current?.stop();
      engineRef.current = null;
      setStatus({ state: "idle", at: null });
      return;
    }

    let active = true;

    const run = async () => {
      try {
        setStatus({ state: "syncing", at: Date.now() });
        const firestore = await fs();

        const engine = createEngine({
          uid: user.uid,
          firestore,
          setStatus,
          entities: SYNC_ENTITIES,
          onSummaryDirty: (changedUid) => refreshProfileSummary(changedUid),
          // Account switch detected by the engine (syncState.uid): merge
          // (OK) this browser's data into the new account, or replace it
          // (Cancel) with the cloud copy.
          onAccountSwitch: () =>
            window.confirm(
              `This browser last synced a different account.\n\n` +
                `OK — merge this browser's data into ${user.email ?? "the new account"}\n` +
                `Cancel — replace this browser's data with the cloud copy`
            ),
        });
        engineRef.current = engine;

        await engine.start();
        if (!active) return;

        await seedProfile(user).catch(() => {});
        // Register my email in the invite index (hashed) so others can
        // find this account by email.
        await registerEmailIndex(user);

        if (active) setStatus({ state: "synced", at: Date.now() });
      } catch (err) {
        console.warn("[cloud sync] setup failed", err);
        if (active) {
          const error = err as { message?: string; code?: string };
          setStatus({
            state: "error",
            at: Date.now(),
            message: error?.message,
            code: error?.code,
          });
        }
      }
    };
    run();

    return () => {
      active = false;
      engineRef.current?.stop();
      engineRef.current = null;
    };
  }, [user?.uid]);

  return { status };
}

// Human-readable diagnosis for the sync-error state.
export function syncErrorHint(status?: SyncStatus | null): string {
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
