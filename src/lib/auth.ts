// Auth: Google + email/password. Everything no-ops when Firebase env is
// unset so the local-only app is unchanged. Firebase itself loads lazily
// (src/lib/cloud/firebase.js) and never touches the main bundle.

import { useEffect, useState } from "react";
import type { User, UserCredential } from "firebase/auth";
import { cloudEnabled, loadFirebaseAuth, loadFirestore } from "./cloud/firebase.js";
import { sha256 } from "./cloud/connections.js";
import { SETTINGS_DOC_ID } from "./entities/settings.ts";
import { clearCache } from "./cache.js";

type AuthKit = Awaited<ReturnType<typeof loadFirebaseAuth>>;

let kit: Promise<AuthKit> | null = null;
const authKit = (): Promise<AuthKit> => (kit ??= loadFirebaseAuth());

export function useAuth(): { user: User | null; loading: boolean } {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(!cloudEnabled());

  useEffect(() => {
    if (!cloudEnabled()) return;
    let unsub: () => void = () => {};
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

export async function signInGoogle(): Promise<UserCredential> {
  const { auth, m } = await authKit();
  return m.signInWithPopup(auth, new m.GoogleAuthProvider());
}

export async function signInEmail(email: string, password: string): Promise<UserCredential> {
  const { auth, m } = await authKit();
  return m.signInWithEmailAndPassword(auth, email, password);
}

export async function signUpEmail(email: string, password: string): Promise<UserCredential> {
  const { auth, m } = await authKit();
  const cred = await m.createUserWithEmailAndPassword(auth, email, password);
  const name = email.split("@")[0];
  if (name) {
    await m.updateProfile(cred.user, { displayName: name }).catch(() => {});
  }
  return cred;
}

export async function requestPasswordReset(email: string): Promise<void> {
  const { auth, m } = await authKit();
  return m.sendPasswordResetEmail(auth, email);
}

export async function signOutUser(): Promise<void> {
  const { auth, m } = await authKit();
  await m.signOut(auth);
  clearCache(); // no cached profiles/relations leak across accounts
}

export async function setDisplayName(name: string): Promise<void> {
  const { auth, m } = await authKit();
  if (auth.currentUser) {
    await m.updateProfile(auth.currentUser, { displayName: name });
  }
}

// Deletes all cloud data for the current user, then the account itself.
// Wipes (in order): every doc in the user's own subcollections, the
// settings doc, the public profile, every shared note they own (plus each
// member's inbox entry), and their email-index entry. Runs before
// deleteUser while owner rules still apply.
// Docs go first: if the final deleteUser needs recent-login, the user can
// re-auth and retry (the second run only deletes the account).
export async function deleteAccountAndCloudData(): Promise<void> {
  const { auth, m } = await authKit();
  const user = auth.currentUser;
  if (!user) return;
  const { db, m: fs } = await loadFirestore();
  const wipeCollection = async (segments: [string, ...string[]]): Promise<void> => {
    const snap = await fs.getDocs(fs.collection(db, ...segments)).catch(() => null);
    if (snap) {
      for (const d of snap.docs) {
        await fs.deleteDoc(d.ref).catch(() => {});
      }
    }
  };
  // Own subcollections (synced entities, invites, connections, inbox).
  for (const collection of [
    "solves",
    "notes",
    "rewardEvents",
    "invites",
    "sent",
    "connections",
    "sharedWithMe",
  ]) {
    await wipeCollection(["users", user.uid, collection]);
  }
  await fs.deleteDoc(fs.doc(db, "users", user.uid, "settings", SETTINGS_DOC_ID)).catch(() => {});
  await fs.deleteDoc(fs.doc(db, "profiles", user.uid)).catch(() => {});
  // Shared notes I own: delete the doc plus every member's inbox entry so
  // no ghost collaborations survive me.
  const owned = await fs
    .getDocs(
      fs.query(
        fs.collection(db, "sharedNotes"),
        fs.where("ownerUid", "==", user.uid)
      )
    )
    .catch(() => null);
  if (owned) {
    for (const d of owned.docs) {
      const members = d.data()?.members;
      await fs.deleteDoc(d.ref).catch(() => {});
      if (Array.isArray(members)) {
        for (const memberUid of members) {
          if (typeof memberUid !== "string" || memberUid === user.uid) continue;
          await fs
            .deleteDoc(fs.doc(db, "users", memberUid, "sharedWithMe", d.id))
            .catch(() => {});
        }
      }
    }
  }
  // Email index entry (hashed — resolve it the same way invites do).
  if (user.email) {
    const hash = await sha256(user.email.trim().toLowerCase()).catch(() => null);
    if (hash) {
      await fs.deleteDoc(fs.doc(db, "emails", hash)).catch(() => {});
    }
  }
  await m.deleteUser(user);
  clearCache();
}

// Friendly message for auth error codes shown in the sign-in modal.
export function authErrorMessage(err: unknown): string {
  const code =
    typeof err === "object" && err !== null && "code" in err
      ? String((err as { code?: unknown }).code ?? "")
      : "";
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
  const message =
    err instanceof Error
      ? err.message
      : typeof err === "object" && err !== null && "message" in err
        ? String((err as { message?: unknown }).message ?? "")
        : "";
  return message || "Something went wrong.";
}
