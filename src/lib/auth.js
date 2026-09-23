// Auth: Google + email/password. Everything no-ops when Firebase env is
// unset so the local-only app is unchanged. Firebase itself loads lazily
// (src/lib/cloud/firebase.js) and never touches the main bundle.

import { useEffect, useState } from "react";
import { cloudEnabled, loadFirebaseAuth, loadFirestore } from "./cloud/firebase.js";
import { KEYS } from "./db.js";
import { clearCache } from "./cache.js";

let kit = null;
const authKit = () => (kit ??= loadFirebaseAuth());

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!cloudEnabled());

  useEffect(() => {
    if (!cloudEnabled()) return;
    let unsub = () => {};
    let cancelled = false;
    authKit().then(({ auth, m }) => {
      if (cancelled) return;
      unsub = m.onAuthStateChanged(auth, (u) => {
        setUser(u);
        setLoading(false);
      });
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  return { user, loading };
}

export async function signInGoogle() {
  const { auth, m } = await authKit();
  return m.signInWithPopup(auth, new m.GoogleAuthProvider());
}

export async function signInEmail(email, password) {
  const { auth, m } = await authKit();
  return m.signInWithEmailAndPassword(auth, email, password);
}

export async function signUpEmail(email, password) {
  const { auth, m } = await authKit();
  const cred = await m.createUserWithEmailAndPassword(auth, email, password);
  const name = email.split("@")[0];
  if (name) {
    await m.updateProfile(cred.user, { displayName: name }).catch(() => {});
  }
  return cred;
}

export async function requestPasswordReset(email) {
  const { auth, m } = await authKit();
  return m.sendPasswordResetEmail(auth, email);
}

export async function signOutUser() {
  const { auth, m } = await authKit();
  await m.signOut(auth);
  clearCache(); // no cached profiles/relations leak across accounts
}

export async function setDisplayName(name) {
  const { auth, m } = await authKit();
  if (auth.currentUser) {
    await m.updateProfile(auth.currentUser, { displayName: name });
  }
}

// Deletes all cloud data for the current user, then the account itself.
// Docs go first: if the final deleteUser needs recent-login, the user can
// re-auth and retry (the second run only deletes the account).
export async function deleteAccountAndCloudData() {
  const { auth, m } = await authKit();
  const user = auth.currentUser;
  if (!user) return;
  const { db, m: fs } = await loadFirestore();
  for (const key of [KEYS.progress, KEYS.notes, KEYS.plans, KEYS.rewards]) {
    await fs.deleteDoc(fs.doc(db, "users", user.uid, "state", key)).catch(() => {});
  }
  await fs.deleteDoc(fs.doc(db, "profiles", user.uid)).catch(() => {});
  const following = await fs
    .getDocs(fs.collection(db, "users", user.uid, "following"))
    .catch(() => null);
  if (following) {
    for (const d of following.docs) {
      await fs.deleteDoc(d.ref).catch(() => {});
    }
  }
  await m.deleteUser(user);
  clearCache();
}

// Friendly message for auth error codes shown in the sign-in modal.
export function authErrorMessage(err) {
  const code = err?.code ?? "";
  if (
    code === "auth/invalid-credential" ||
    code === "auth/wrong-password" ||
    code === "auth/user-not-found"
  )
    return "Wrong email or password.";
  if (code === "auth/email-already-in-use")
    return "That email already has an account — sign in instead.";
  if (code === "auth/weak-password")
    return "Password too weak — use at least 6 characters.";
  if (code === "auth/invalid-email") return "That doesn't look like an email.";
  if (code === "auth/too-many-requests") return "Too many attempts — try again later.";
  if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request")
    return "";
  if (code === "auth/network-request-failed")
    return "Network error — check your connection.";
  if (code === "auth/requires-recent-login")
    return "Please sign out and sign in again, then retry.";
  return err?.message || "Something went wrong.";
}
