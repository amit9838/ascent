// Collaborative notes: share a note so others can see and edit it.
// Ownership always stays with the creator (ownerUid); members get
// read + content-edit rights only (enforced by firestore.rules).
//
// Sync is save-based, NOT realtime: writers push on save, readers pull
// on open. Discovery is instant via the per-user inbox.
//
// Firestore model (see firestore.rules):
//   sharedNotes/{noteId}          = { ownerUid, ownerName, title, body,
//                                     createdAt, updatedAt,
//                                     members: [uids, owner first],
//                                     memberInfo: { uid: { displayName, photoURL } } }
//   users/{uid}/sharedWithMe/{id} = { shareId, ownerUid, title, updatedAt }

import { loadFirestore } from "./firebase.js";
import { sha256 } from "./connections.js";

let kit = null;
const fs = () => (kit ??= loadFirestore());

function step(name, fn) {
  return Promise.resolve()
    .then(fn)
    .catch((err) => {
      console.warn(`[sharedNotes] ${name} failed`, err);
      const e = err instanceof Error ? err : new Error(String(err));
      e.message = `${name}: ${e.message}`;
      throw e;
    });
}

function selfInfo(user) {
  return {
    displayName: user?.displayName || user?.email?.split("@")[0] || "Solver",
    photoURL: user?.photoURL || "",
  };
}

// Resolve an email to a uid via the hashed email index (same as invites).
async function lookupUid(email) {
  const addr = (email ?? "").trim().toLowerCase();
  if (!addr || !addr.includes("@")) throw new Error("Enter a valid email address.");
  const hash = await sha256(addr);
  if (!hash) throw new Error("Sharing needs a secure connection (https).");
  const { db, m } = await fs();
  const snap = await step(
    "looking up that email",
    () => m.getDoc(m.doc(db, "emails", hash))
  );
  if (!snap.exists()) {
    throw new Error("No account with that email yet — they need to sign in once first.");
  }
  return { uid: snap.data()?.uid, email: addr };
}

// Owner shares `note` with the account behind `email`. Creates the shared
// doc (or adds to it) and writes the recipient's inbox entry. Returns the
// updated member uid list.
export async function shareNoteWith(ownerUser, note, email) {
  if (!ownerUser) throw new Error("Sign in to share notes.");
  if (!note?.id) throw new Error("Open a note first.");
  const { uid: targetUid } = await lookupUid(email);
  if (targetUid === ownerUser.uid) throw new Error("That's your own email.");
  if (!targetUid) throw new Error("Could not resolve that email.");

  const { db, m } = await fs();
  const ref = m.doc(db, "sharedNotes", note.id);
  const snap = await step("loading the shared note", () => m.getDoc(ref)).catch(
    () => null
  );
  const now = new Date().toISOString();
  const me = selfInfo(ownerUser);
  let members;
  let memberInfo;
  if (snap?.exists()) {
    const d = snap.data() ?? {};
    if (d.ownerUid && d.ownerUid !== ownerUser.uid) {
      throw new Error("Only the note owner can manage sharing.");
    }
    members = Array.isArray(d.members) ? [...d.members] : [ownerUser.uid];
    if (!members.includes(ownerUser.uid)) members.unshift(ownerUser.uid);
    if (!members.includes(targetUid)) members.push(targetUid);
    memberInfo = { ...(d.memberInfo ?? {}), [ownerUser.uid]: me };
    await step(
      "adding them to the note",
      () =>
        m.setDoc(
          ref,
          {
            ownerUid: ownerUser.uid,
            ownerName: me.displayName,
            title: note.title ?? "",
            body: note.body ?? "",
            updatedAt: now,
            members,
            memberInfo,
          },
          { merge: true }
        )
    );
  } else {
    members = [ownerUser.uid, targetUid];
    memberInfo = { [ownerUser.uid]: me };
    await step(
      "creating the shared note",
      () =>
        m.setDoc(ref, {
          ownerUid: ownerUser.uid,
          ownerName: me.displayName,
          title: note.title ?? "",
          body: note.body ?? "",
          createdAt: note.createdAt ?? now,
          updatedAt: now,
          members,
          memberInfo,
        })
    );
  }
  await step(
    "notifying them",
    () =>
      m.setDoc(m.doc(db, "users", targetUid, "sharedWithMe", note.id), {
        shareId: note.id,
        ownerUid: ownerUser.uid,
        ownerName: me.displayName,
        title: note.title ?? "",
        updatedAt: now,
      })
  );
  return members;
}

// Owner removes one member. If nobody is left besides the owner, the
// shared doc is deleted (the note becomes private again).
export async function unshareMember(ownerUser, note, targetUid) {
  if (!ownerUser) throw new Error("Sign in to manage sharing.");
  const { db, m } = await fs();
  const ref = m.doc(db, "sharedNotes", note.sharedId || note.id);
  const snap = await step("loading the shared note", () => m.getDoc(ref));
  if (!snap.exists()) throw new Error("This note is no longer shared.");
  const d = snap.data() ?? {};
  if (d.ownerUid !== ownerUser.uid) {
    throw new Error("Only the note owner can manage sharing.");
  }
  const members = (Array.isArray(d.members) ? d.members : []).filter(
    (u) => u !== targetUid && u !== ownerUser.uid
  );
  await step(
    "removing their access",
    () => m.deleteDoc(m.doc(db, "users", targetUid, "sharedWithMe", note.sharedId || note.id))
  ).catch(() => {});
  if (!members.length) {
    await step("closing sharing", () => m.deleteDoc(ref));
    return [];
  }
  const memberInfo = { ...(d.memberInfo ?? {}) };
  delete memberInfo[targetUid];
  await step(
    "updating the note",
    () => m.setDoc(ref, { members: [ownerUser.uid, ...members], memberInfo }, { merge: true })
  );
  return [ownerUser.uid, ...members];
}

// Owner stops sharing entirely: shared doc + every inbox entry go away.
// The local copy stays as a normal private note.
export async function stopSharing(ownerUser, note) {
  if (!ownerUser) throw new Error("Sign in to manage sharing.");
  const { db, m } = await fs();
  const shareId = note.sharedId || note.id;
  const snap = await step("loading the shared note", () => m.getDoc(m.doc(db, "sharedNotes", shareId))).catch(
    () => null
  );
  const members = snap?.exists()
    ? (Array.isArray(snap.data()?.members) ? snap.data().members : [])
    : [];
  await step("closing sharing", () =>
    m.deleteDoc(m.doc(db, "sharedNotes", shareId)).catch(() => {})
  );
  await Promise.all(
    members
      .filter((u) => u && u !== ownerUser.uid)
      .map((u) =>
        m.deleteDoc(m.doc(db, "users", u, "sharedWithMe", shareId)).catch(() => {})
      )
  );
}

// Member leaves: my inbox entry is deleted and I remove myself from the
// member list (rules allow self-removal), so the owner never sees ghosts.
// Local cleanup (deleting the copy) is the caller's job.
export async function leaveSharedNote(user, note) {
  if (!user) return;
  const { db, m } = await fs();
  const shareId = note.sharedId || note.id;
  await m.deleteDoc(m.doc(db, "users", user.uid, "sharedWithMe", shareId)).catch(() => {});
  if (note.ownerUid && note.ownerUid !== user.uid) {
    const ref = m.doc(db, "sharedNotes", shareId);
    const snap = await m.getDoc(ref).catch(() => null);
    if (snap?.exists()) {
      const d = snap.data() ?? {};
      const members = (Array.isArray(d.members) ? d.members : []).filter(
        (u) => u !== user.uid
      );
      const memberInfo = { ...(d.memberInfo ?? {}) };
      delete memberInfo[user.uid];
      await m
        .setDoc(
          ref,
          { members, memberInfo, updatedAt: d.updatedAt ?? new Date().toISOString() },
          { merge: true }
        )
        .catch(() => {});
    }
  }
}

// Inbox entries: notes shared with me that I haven't left.
export async function listSharedInbox(uid) {
  if (!uid) return [];
  const { db, m } = await fs();
  const snap = await m
    .getDocs(m.collection(db, "users", uid, "sharedWithMe"))
    .catch(() => null);
  if (!snap) return [];
  return snap.docs.map((d) => ({ ...(d.data() ?? {}), shareId: d.id }));
}

// Full shared doc (content + members). Returns null when gone/unshared.
export async function fetchSharedNote(shareId) {
  if (!shareId) return null;
  const { db, m } = await fs();
  const snap = await m.getDoc(m.doc(db, "sharedNotes", shareId)).catch(() => null);
  if (!snap?.exists()) return null;
  return { shareId, ...(snap.data() ?? {}) };
}

// Push local content to the shared doc (called on save — not realtime).
// Also stamps my own member info so collaborator avatars stay fresh, and
// (owner only) refreshes every inbox title.
export async function pushSharedNote(note, user) {
  if (!user || !note?.shared) return;
  const shareId = note.sharedId || note.id;
  const { db, m } = await fs();
  const me = selfInfo(user);
  const now = new Date().toISOString();
  await step(
    "syncing the shared note",
    () =>
      m.setDoc(
        m.doc(db, "sharedNotes", shareId),
        {
          title: note.title ?? "",
          body: note.body ?? "",
          updatedAt: now,
          [`memberInfo.${user.uid}`]: me,
        },
        { merge: true }
      )
  ).catch(() => {});
  if (note.ownerUid === user.uid || (!note.ownerUid && !note.shared)) {
    const snap = await m.getDoc(m.doc(db, "sharedNotes", shareId)).catch(() => null);
    const members = snap?.exists() && Array.isArray(snap.data()?.members)
      ? snap.data().members
      : [];
    await Promise.all(
      members
        .filter((u) => u && u !== user.uid)
        .map((u) =>
          m
            .setDoc(
              m.doc(db, "users", u, "sharedWithMe", shareId),
              { title: note.title ?? "", updatedAt: now },
              { merge: true }
            )
            .catch(() => {})
        )
    );
  }
}

// Live inbox listener (discovery only — content still pulls on open).
export function subscribeSharedInbox(uid, onChange, onError) {
  if (!uid) return () => {};
  let unsub = () => {};
  loadFirestore()
    .then(({ db, m }) => {
      unsub = m.onSnapshot(
        m.collection(db, "users", uid, "sharedWithMe"),
        (snap) => onChange(snap.docs.map((d) => ({ ...(d.data() ?? {}), shareId: d.id }))),
        onError
      );
    })
    .catch(onError);
  return () => unsub();
}
