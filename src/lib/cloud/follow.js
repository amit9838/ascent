// Follow system + public profile doc helpers for stats comparison:
// users/{me}/following/{targetUid} and profiles/{uid}.
// Owner-only per Firestore rules; visibility of a profile is governed by
// the target's shareEnabled flag. (profiles is top-level: Firestore doc
// paths need an even number of segments.)

import { loadFirestore } from "./firebase.js";
import { cached, forget } from "../cache.js";

let kit = null;
const fs = () => (kit ??= loadFirestore());

const profileKey = (uid) => `profile:${uid}`;

// TTL cache: profiles change rarely (name/photo/share toggles) and are
// read on every profile-page visit plus each invite/connection flow.
export function getProfile(uid) {
  return cached(
    profileKey(uid),
    async () => {
      const { db, m } = await fs();
      const snap = await m.getDoc(m.doc(db, "profiles", uid));
      return snap.exists() ? { uid, ...snap.data() } : null;
    },
    { ttl: 30_000, tags: ["profiles", profileKey(uid)] }
  );
}

// Call after any local write to profiles/{uid} so the next read is fresh.
export function invalidateProfile(uid) {
  forget(profileKey(uid));
}

export async function updateProfileDoc(uid, patch) {
  const { db, m } = await fs();
  await m.setDoc(m.doc(db, "profiles", uid), patch, { merge: true });
  invalidateProfile(uid);
}

export async function listFollowing(uid) {
  const { db, m } = await fs();
  const snap = await m.getDocs(m.collection(db, "users", uid, "following"));
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
}

export async function followUser(myUid, targetUid, displayName) {
  const { db, m } = await fs();
  await m.setDoc(m.doc(db, "users", myUid, "following", targetUid), {
    displayName: displayName ?? "Solver",
    addedAt: new Date().toISOString(),
  });
}

export async function unfollowUser(myUid, targetUid) {
  const { db, m } = await fs();
  await m.deleteDoc(m.doc(db, "users", myUid, "following", targetUid));
}

export async function isFollowing(myUid, targetUid) {
  const { db, m } = await fs();
  const snap = await m.getDoc(
    m.doc(db, "users", myUid, "following", targetUid)
  );
  return snap.exists();
}
