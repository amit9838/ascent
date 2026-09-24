// Connections: email invites with accept/reject, and mutual connections
// that power the leaderboard.
//
// Firestore model (see firestore.rules):
//   emails/{sha256(email)}          = { uid }            email -> uid index
//   users/{to}/invites/{from}       = invite to `to`    created by inviter `from`
//   users/{from}/sent/{to}          = status mirror     updated by invitee on accept/reject
//   users/{uid}/connections/{peer}  = { uid: peer, displayName, photoURL,
//                                      connectedAt, updatedAt }
//
// Connection entries are identity-only (name + photo). Stats always come
// from the peer's public profile (profiles/{uid}), read live by the
// leaderboard — no fan-out copies, nothing to go stale.
//
// Emails are stored only as SHA-256 hashes so the index can't be enumerated
// or harvested. Writing is restricted to your own entry by rules.

import { getProfile } from "./follow.js";
import type { Profile } from "./follow.js";
import { loadFirestore } from "./firebase.js";
import { cached, invalidateTag } from "../cache.js";

export interface Invite {
  uid: string;
  displayName?: string;
  photoURL?: string;
  email?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Connection {
  uid: string;
  displayName?: string;
  photoURL?: string;
  connectedAt?: string;
  updatedAt?: string;
}

export interface DirectoryEntry {
  uid: string;
  [key: string]: unknown;
}

type FirestoreKit = Awaited<ReturnType<typeof loadFirestore>>;

let kit: Promise<FirestoreKit> | null = null;
const fs = (): Promise<FirestoreKit> => (kit ??= loadFirestore());

// Relation caches are tagged per user pair so any mutation for that pair
// (invite / accept / reject / remove) can drop them in one call.
const relTag = (a: string, b: string): string => `rel:${a}:${b}`;
function invalidateRel(a: string, b: string): void {
  invalidateTag(relTag(a, b));
  invalidateTag(relTag(b, a));
}

// Tags failures with the step that caused them, so permission errors say
// exactly which operation the cloud rejected.
async function step<T>(name: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err: unknown) {
    console.warn(`[connections] ${name} failed`, err);
    const e = err instanceof Error ? err : new Error(String(err));
    e.message = `${name}: ${e.message}`;
    throw e;
  }
}

export async function sha256(text: string): Promise<string | null> {
  if (!text || !crypto?.subtle) return null;
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text)
  );
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Called at sign-in so others can find this account by email.
export async function registerEmailIndex(
  user: { uid: string; email?: string | null } | null | undefined
): Promise<void> {
  if (!user?.email) return;
  const hash = await sha256(user.email.trim().toLowerCase());
  if (!hash) return;
  const { db, m } = await fs();
  await m
    .setDoc(m.doc(db, "emails", hash), { uid: user.uid }, { merge: true })
    .catch((err: unknown) =>
      console.warn("[connections] email index registration failed", err)
    );
}

async function myProfileInfo(uid: string): Promise<{ displayName: string; photoURL: string }> {
  const profile: Profile | null = await getProfile(uid).catch(() => null);
  return {
    displayName: profile?.displayName ?? "Solver",
    photoURL: profile?.photoURL ?? "",
  };
}

export async function sendInviteToUid(
  myUid: string,
  targetUid: string,
  email = ""
): Promise<void> {
  if (!targetUid || targetUid === myUid) throw new Error("That's your own profile.");
  const { db, m } = await fs();
  const conn = await step(
    "checking existing connections",
    () => m.getDoc(m.doc(db, "users", myUid, "connections", targetUid))
  ).catch(() => null);
  if (conn?.exists()) throw new Error("You're already connected.");
  const sent0 = await step(
    "checking pending invites",
    () => m.getDoc(m.doc(db, "users", myUid, "sent", targetUid))
  ).catch(() => null);
  if (sent0?.exists() && sent0.data()?.status === "pending") {
    throw new Error("Invite already sent — waiting for their reply.");
  }
  const info = await myProfileInfo(myUid);
  const now = new Date().toISOString();
  await step(
    "delivering the invite",
    () =>
      m.setDoc(m.doc(db, "users", targetUid, "invites", myUid), {
        uid: myUid,
        displayName: info.displayName,
        photoURL: info.photoURL,
        status: "pending",
        createdAt: now,
      })
  );
  await step(
    "recording the sent invite",
    () =>
      m.setDoc(m.doc(db, "users", myUid, "sent", targetUid), {
        uid: targetUid,
        email,
        status: "pending",
        createdAt: now,
      })
  );
  invalidateRel(myUid, targetUid);
}

export async function sendInvite(myUid: string, email: string): Promise<void> {
  const addr = (email ?? "").trim().toLowerCase();
  if (!addr || !addr.includes("@")) throw new Error("Enter a valid email address.");
  const hash = await sha256(addr);
  if (!hash) throw new Error("Invites need a secure connection (https).");
  const { db, m } = await fs();
  const snap = await step(
    "looking up that email",
    () => m.getDoc(m.doc(db, "emails", hash))
  );
  if (!snap.exists()) {
    throw new Error("No account with that email yet — ask them to sign out and back in once, then retry.");
  }
  const targetUid = snap.data()?.uid as string | undefined;
  if (targetUid === myUid) throw new Error("That's your own email.");
  if (!targetUid) throw new Error("That lookup didn't return a user — try again.");
  return sendInviteToUid(myUid, targetUid, addr);
}

// Connection status helpers for profile pages — cached per pair so page
// visits don't re-read Firestore on every render/navigation.
export function isConnected(myUid: string, peerUid: string): Promise<boolean> {
  return cached<boolean>(
    `conn:${myUid}:${peerUid}`,
    async () => {
      const { db, m } = await fs();
      const snap = await m
        .getDoc(m.doc(db, "users", myUid, "connections", peerUid))
        .catch(() => null);
      return Boolean(snap?.exists());
    },
    { ttl: 30_000, tags: [relTag(myUid, peerUid)] }
  );
}

export function getSentStatus(myUid: string, peerUid: string): Promise<string | null> {
  return cached<string | null>(
    `sent:${myUid}:${peerUid}`,
    async () => {
      const { db, m } = await fs();
      const snap = await m
        .getDoc(m.doc(db, "users", myUid, "sent", peerUid))
        .catch(() => null);
      return snap?.exists() ? ((snap.data()?.status as string | null) ?? null) : null;
    },
    { ttl: 30_000, tags: [relTag(myUid, peerUid)] }
  );
}

const byNewest = <T extends { createdAt?: unknown }>(a: T, b: T): number =>
  String(a.createdAt ?? "") < String(b.createdAt ?? "") ? 1 : -1;

export async function listReceivedInvites(uid: string): Promise<Invite[]> {
  const { db, m } = await fs();
  const snap = await m.getDocs(m.collection(db, "users", uid, "invites"));
  return snap.docs.map((d): Invite => ({ uid: d.id, ...d.data() })).sort(byNewest);
}

export async function listSentInvites(uid: string): Promise<Invite[]> {
  const { db, m } = await fs();
  const snap = await m.getDocs(m.collection(db, "users", uid, "sent"));
  return snap.docs.map((d): Invite => ({ uid: d.id, ...d.data() })).sort(byNewest);
}

// Sender withdraws a pending invite: drop the recipient's inbox copy
// (rules allow the inviter to delete their own invite) plus my status
// mirror. The recipient's live listener updates their UI automatically.
export async function withdrawInvite(myUid: string, peerUid: string): Promise<void> {
  const { db, m } = await fs();
  await step(
    "withdrawing the invite",
    () =>
      // not-found: they accepted/rejected between render and click —
      // their inbox copy is already gone, keep going.
      m
        .deleteDoc(m.doc(db, "users", peerUid, "invites", myUid))
        .catch((err: unknown) => {
          if ((err as { code?: string })?.code !== "not-found") throw err;
        })
  );
  await step(
    "clearing your sent record",
    () => m.deleteDoc(m.doc(db, "users", myUid, "sent", peerUid))
  );
  invalidateRel(myUid, peerUid);
}

// Deletes sent-invite records in terminal states (accepted/rejected).
// Pending rows are kept so the sender can still track or withdraw them.
// Connections are untouched — only invitation history is removed.
export async function clearFinishedSentInvites(uid: string): Promise<number> {
  const { db, m } = await fs();
  const snap = await step("loading invite history", () =>
    m.getDocs(m.collection(db, "users", uid, "sent"))
  );
  const terminal = snap.docs.filter((d) =>
    ["accepted", "rejected"].includes(d.data()?.status)
  );
  await Promise.all(terminal.map((d) => m.deleteDoc(d.ref).catch(() => {})));
  return terminal.length;
}

export async function acceptInvite(myUid: string, invite: Invite): Promise<void> {
  const from = invite.uid;
  const inviterProfile = await getProfile(from).catch(() => null);
  const now = new Date().toISOString();
  const { db, m } = await fs();
  // Owner-only connections (see firestore.rules): each side writes only
  // their own list. I add the inviter to mine here; the inviter adds me
  // to theirs when they observe my accepted status (ensureConnection).
  // The inviter's stats are read live from their public profile — never
  // stamped here.
  await step(
    "adding them to my leaderboard",
    () =>
      m.setDoc(m.doc(db, "users", myUid, "connections", from), {
        uid: from,
        displayName: invite.displayName ?? inviterProfile?.displayName ?? "Solver",
        photoURL: invite.photoURL ?? inviterProfile?.photoURL ?? "",
        connectedAt: now,
        updatedAt: now,
      })
  );
  // Tell the inviter their invite was accepted. They add me to their
  // own leaderboard when they observe this status (ensureConnection).
  const info = await myProfileInfo(myUid);
  await step(
    "updating the sent-invite status",
    () =>
      m.setDoc(
        m.doc(db, "users", from, "sent", myUid),
        { uid: myUid, displayName: info.displayName, status: "accepted", updatedAt: now },
        { merge: true }
      )
  );
  // Clear my inbox.
  await step(
    "clearing the invite",
    () => m.deleteDoc(m.doc(db, "users", myUid, "invites", from))
  );
  invalidateRel(myUid, from);
  invalidateTag(`conns:${myUid}`);
}

export async function rejectInvite(myUid: string, invite: Invite): Promise<void> {
  const from = invite.uid;
  const now = new Date().toISOString();
  const info = await myProfileInfo(myUid);
  const { db, m } = await fs();
  await step(
    "updating the sent-invite status",
    () =>
      m.setDoc(
        m.doc(db, "users", from, "sent", myUid),
        { uid: myUid, displayName: info.displayName, status: "rejected", updatedAt: now },
        { merge: true }
      )
  );
  await step(
    "clearing the invite",
    () => m.deleteDoc(m.doc(db, "users", myUid, "invites", from))
  );
  invalidateRel(myUid, from);
}

export function listConnections(uid: string): Promise<Connection[]> {
  return cached<Connection[]>(
    `conns:${uid}`,
    async () => {
      const { db, m } = await fs();
      const snap = await m.getDocs(m.collection(db, "users", uid, "connections"));
      return snap.docs.map((d): Connection => ({ uid: d.id, ...d.data() }));
    },
    { ttl: 30_000, tags: [`conns:${uid}`] }
  );
}

// Inviter side of an accepted invite: add the peer to MY leaderboard if
// not there yet. Called when I observe an accepted sent-invite status —
// the invitee cannot write my list (owner-only rules), so I do it myself.
export async function ensureConnection(myUid: string, peerUid: string): Promise<void> {
  if (!myUid || !peerUid || myUid === peerUid) return;
  const { db, m } = await fs();
  const existing = await m
    .getDoc(m.doc(db, "users", myUid, "connections", peerUid))
    .catch(() => null);
  if (existing?.exists()) return;
  const profile = await getProfile(peerUid).catch(() => null);
  const now = new Date().toISOString();
  await step(
    "adding them to my leaderboard",
    () =>
      m.setDoc(m.doc(db, "users", myUid, "connections", peerUid), {
        uid: peerUid,
        displayName: profile?.displayName ?? "Solver",
        photoURL: profile?.photoURL ?? "",
        connectedAt: now,
        updatedAt: now,
      })
  );
  invalidateRel(myUid, peerUid);
  invalidateTag(`conns:${myUid}`);
}

// Removes my side of a connection. Owner-only rules mean the peer keeps
// their own entry until they remove me too (unfollow semantics).
export async function removeConnection(myUid: string, peerUid: string): Promise<void> {
  const { db, m } = await fs();
  await m.deleteDoc(m.doc(db, "users", myUid, "connections", peerUid));
  invalidateRel(myUid, peerUid);
  invalidateTag(`conns:${myUid}`);
}

// --- live subscriptions (leaderboard auto-refresh) ---

function subscribeCollection(
  uid: string,
  name: string,
  onChange: (items: DirectoryEntry[]) => void,
  onError?: (err: unknown) => void
): () => void {
  let unsub: () => void = () => {};
  fs()
    .then(({ db, m }) => {
      unsub = m.onSnapshot(
        m.collection(db, "users", uid, name),
        (snap) =>
          onChange(snap.docs.map((d): DirectoryEntry => ({ uid: d.id, ...d.data() }))),
        onError
      );
    })
    .catch(onError);
  return () => unsub();
}

export const subscribeConnections = (
  uid: string,
  onChange: (items: DirectoryEntry[]) => void,
  onError?: (err: unknown) => void
): (() => void) =>
  subscribeCollection(uid, "connections", onChange, onError);

export const subscribeInvites = (
  uid: string,
  onChange: (items: DirectoryEntry[]) => void,
  onError?: (err: unknown) => void
): (() => void) =>
  subscribeCollection(uid, "invites", onChange, onError);

export const subscribeSent = (
  uid: string,
  onChange: (items: DirectoryEntry[]) => void,
  onError?: (err: unknown) => void
): (() => void) =>
  subscribeCollection(uid, "sent", onChange, onError);
