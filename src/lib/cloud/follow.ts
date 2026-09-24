// Public profile doc helpers: profiles/{uid} (top-level — Firestore doc
// paths need an even number of segments).
// Owner-only writes; visibility is governed by the target's shareEnabled
// flag (see firestore.rules).

import { loadFirestore } from "./firebase.js";
import { cached, forget } from "../cache.js";

export interface Profile {
  uid: string;
  displayName?: string;
  photoURL?: string;
  shareEnabled?: boolean;
  [key: string]: unknown;
}

type FirestoreKit = Awaited<ReturnType<typeof loadFirestore>>;

let kit: Promise<FirestoreKit> | null = null;
const fs = (): Promise<FirestoreKit> => (kit ??= loadFirestore());

const profileKey = (uid: string): string => `profile:${uid}`;

// TTL cache: profiles change rarely (name/photo/share toggles) and are
// read on every profile-page visit plus each invite/connection flow.
export function getProfile(uid: string): Promise<Profile | null> {
  return cached<Profile | null>(
    profileKey(uid),
    async (): Promise<Profile | null> => {
      const { db, m } = await fs();
      const snap = await m.getDoc(m.doc(db, "profiles", uid));
      return snap.exists() ? { uid, ...(snap.data() ?? {}) } : null;
    },
    { ttl: 30_000, tags: ["profiles", profileKey(uid)] }
  );
}

// Call after any local write to profiles/{uid} so the next read is fresh.
export function invalidateProfile(uid: string): void {
  forget(profileKey(uid));
}

export async function updateProfileDoc(
  uid: string,
  patch: Record<string, unknown>
): Promise<void> {
  const { db, m } = await fs();
  await m.setDoc(m.doc(db, "profiles", uid), patch, { merge: true });
  invalidateProfile(uid);
}

// Live profile updates (the leaderboard subscribes one per connected peer
// so boards refresh the moment anyone solves a problem). Rules still gate
// the read — non-shared profiles arrive as missing docs.
export function subscribeProfile(
  uid: string,
  onChange: (profile: Profile | null) => void,
  onError?: (err: unknown) => void
): () => void {
  let unsub: () => void = () => {};
  fs()
    .then(({ db, m }) => {
      unsub = m.onSnapshot(
        m.doc(db, "profiles", uid),
        (snap) => {
          forget(profileKey(uid)); // keep the TTL cache honest
          onChange(snap.exists() ? { uid, ...(snap.data() ?? {}) } : null);
        },
        onError
      );
    })
    .catch(onError);
  return () => unsub();
}
