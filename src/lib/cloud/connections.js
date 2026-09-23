// Connections: email invites with accept/reject, and mutual connections
// that power the leaderboard.
//
// Firestore model (see firestore.rules):
//   emails/{sha256(email)}          = { uid }            email -> uid index
//   users/{to}/invites/{from}       = invite to `to`    created by inviter `from`
//   users/{from}/sent/{to}          = status mirror     updated by invitee on accept/reject
//   users/{uid}/connections/{peer}  = { uid: peer, displayName, photoURL, summary, ... }
//
// Connection entries are ABOUT the peer. On accept, the invitee writes both
// sides: their own full entry (name + photo + stats) into the inviter's
// list, and a name-only entry for the inviter in their own list. Each user
// keeps their stats fresh in all their peers' lists via
// pushSummaryToConnections (called from the sync engine after every
// progress sync), so boards stay live without reading anyone's private data.
//
// Emails are stored only as SHA-256 hashes so the index can't be enumerated
// or harvested. Writing is restricted to your own entry by rules.

import { getProfile } from "./follow.js";
import { computeSummary } from "./profileSummary.js";
import { loadFirestore } from "./firebase.js";

let kit = null;
const fs = () => (kit ??= loadFirestore());

// Tags failures with the step that caused them, so permission errors say
// exactly which operation the cloud rejected.
async function step(name, fn) {
  try {
    return await fn();
  } catch (err) {
    console.warn(`[connections] ${name} failed`, err);
    const e = err instanceof Error ? err : new Error(String(err));
    e.message = `${name}: ${e.message}`;
    throw e;
  }
}

export async function sha256(text) {
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
export async function registerEmailIndex(user) {
  if (!user?.email) return;
  const hash = await sha256(user.email.trim().toLowerCase());
  if (!hash) return;
  const { db, m } = await fs();
  await m
    .setDoc(m.doc(db, "emails", hash), { uid: user.uid }, { merge: true })
    .catch((err) =>
      console.warn("[connections] email index registration failed", err)
    );
}

async function myProfileInfo(uid) {
  const profile = await getProfile(uid).catch(() => null);
  return {
    displayName: profile?.displayName ?? "Solver",
    photoURL: profile?.photoURL ?? "",
  };
}

export async function sendInviteToUid(myUid, targetUid, email = "") {
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
}

export async function sendInvite(myUid, email) {
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
  const targetUid = snap.data()?.uid;
  if (targetUid === myUid) throw new Error("That's your own email.");
  return sendInviteToUid(myUid, targetUid, addr);
}

// Connection status helpers for profile pages.
export async function isConnected(myUid, peerUid) {
  const { db, m } = await fs();
  const snap = await m
    .getDoc(m.doc(db, "users", myUid, "connections", peerUid))
    .catch(() => null);
  return Boolean(snap?.exists());
}

export async function getSentStatus(myUid, peerUid) {
  const { db, m } = await fs();
  const snap = await m
    .getDoc(m.doc(db, "users", myUid, "sent", peerUid))
    .catch(() => null);
  return snap?.exists() ? snap.data()?.status ?? null : null;
}

const byNewest = (a, b) => ((a.createdAt ?? "") < (b.createdAt ?? "") ? 1 : -1);

export async function listReceivedInvites(uid) {
  const { db, m } = await fs();
  const snap = await m.getDocs(m.collection(db, "users", uid, "invites"));
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() })).sort(byNewest);
}

export async function listSentInvites(uid) {
  const { db, m } = await fs();
  const snap = await m.getDocs(m.collection(db, "users", uid, "sent"));
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() })).sort(byNewest);
}

export async function acceptInvite(myUid, invite) {
  const from = invite.uid;
  const [info, summary, inviterProfile] = await Promise.all([
    myProfileInfo(myUid),
    computeSummary(),
    getProfile(from).catch(() => null),
  ]);
  const now = new Date().toISOString();
  const { db, m } = await fs();
  // My full entry in the inviter's leaderboard (name + photo + stats).
  await step(
    "adding me to their leaderboard",
    () =>
      m.setDoc(m.doc(db, "users", from, "connections", myUid), {
        uid: myUid,
        displayName: info.displayName,
        photoURL: info.photoURL,
        summary,
        connectedAt: now,
        updatedAt: now,
      })
  );
  // The inviter's entry in my leaderboard — stats arrive on their next
  // sync, or now if their profile is public.
  await step(
    "adding them to my leaderboard",
    () =>
      m.setDoc(m.doc(db, "users", myUid, "connections", from), {
        uid: from,
        displayName: invite.displayName ?? inviterProfile?.displayName ?? "Solver",
        photoURL: invite.photoURL ?? inviterProfile?.photoURL ?? "",
        summary: inviterProfile?.shareEnabled ? inviterProfile.summary ?? null : null,
        connectedAt: now,
        updatedAt: now,
      })
  );
  // Tell the inviter their invite was accepted.
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
}

export async function rejectInvite(myUid, invite) {
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
}

export async function listConnections(uid) {
  const { db, m } = await fs();
  const snap = await m.getDocs(m.collection(db, "users", uid, "connections"));
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
}

// Removes both sides of a connection.
export async function removeConnection(myUid, peerUid) {
  const { db, m } = await fs();
  await m.deleteDoc(m.doc(db, "users", myUid, "connections", peerUid));
  await m.deleteDoc(m.doc(db, "users", peerUid, "connections", myUid)).catch(() => {});
}

// Pushes my current name + photo + stats into every peer's leaderboard
// entry. Called by the sync engine after each summary refresh, so boards
// stay fresh without anyone reading another user's private data.
export async function pushSummaryToConnections(uid, summary) {
  const peers = await listConnections(uid).catch(() => []);
  if (!peers.length) return;
  const info = await myProfileInfo(uid);
  const now = new Date().toISOString();
  const { db, m } = await fs();
  for (const peer of peers) {
    await m
      .setDoc(
        m.doc(db, "users", peer.uid, "connections", uid),
        { uid, displayName: info.displayName, photoURL: info.photoURL, summary, updatedAt: now },
        { merge: true }
      )
      .catch(() => {});
  }
}

// Recompute and push (used after a name change in Settings).
export async function refreshConnectionSummaries(uid) {
  const summary = await computeSummary();
  await pushSummaryToConnections(uid, summary);
}

// --- live subscriptions (leaderboard auto-refresh) ---

function subscribeCollection(uid, name, onChange, onError) {
  let unsub = () => {};
  fs()
    .then(({ db, m }) => {
      unsub = m.onSnapshot(
        m.collection(db, "users", uid, name),
        (snap) =>
          onChange(snap.docs.map((d) => ({ uid: d.id, ...d.data() }))),
        onError
      );
    })
    .catch(onError);
  return () => unsub();
}

export const subscribeConnections = (uid, onChange, onError) =>
  subscribeCollection(uid, "connections", onChange, onError);

export const subscribeInvites = (uid, onChange, onError) =>
  subscribeCollection(uid, "invites", onChange, onError);

export const subscribeSent = (uid, onChange, onError) =>
  subscribeCollection(uid, "sent", onChange, onError);
