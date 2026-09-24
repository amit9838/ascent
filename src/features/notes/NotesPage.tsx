import { useEffect, useRef, useState } from "react";
import type { User } from "firebase/auth";
import { Link } from "react-router-dom";
import { BackIcon, DownloadIcon, NotesIcon, TrashIcon } from "../../components/icons.jsx";
import { Avatar, Button, IconButton, Modal } from "../../components/primitives/index.js";
import { subscribeRecords } from "../../lib/store/records.ts";
import { useAuth } from "../../lib/auth.js";
import { cloudEnabled } from "../../lib/cloud/firebase.js";
import { getProfile } from "../../lib/cloud/follow.js";
import {
  fetchSharedNote,
  leaveSharedNote,
  listSharedInbox,
  pushSharedNote,
  shareNoteWith,
  stopSharing,
  subscribeSharedInbox,
  unshareMember,
} from "../../lib/cloud/sharedNotes.js";
import type { SharedMemberInfo } from "../../lib/cloud/sharedNotes.ts";
import {
  MAX_NOTES,
  TITLE_LIMIT,
  BODY_LIMIT,
  makeNote,
  uniqueTitle,
  listNoteMeta,
  readNote,
  writeNote,
  deleteNote,
} from "../../lib/entities/notes.ts";
import type { NoteMeta } from "../../lib/entities/notes.ts";
import type { NoteRecord } from "../../lib/store/types.ts";

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function snippet(note: NoteRecord): string {
  const line = (note.body ?? "").split("\n").find((l) => l.trim());
  return (line ?? "Empty note").slice(0, 100);
}

// writeNote takes NoteLike (indexed), which the bare NoteRecord interface
// doesn't satisfy — this threads the index signature through in one place.
type WritableNote = NoteRecord & Record<string, unknown>;
const writable = (note: NoteRecord): WritableNote => note as WritableNote;

interface ShareInfo {
  members: string[];
  memberInfo: Record<string, SharedMemberInfo>;
  ownerUid: string;
  ownerName: string;
}

export default function NotesPage() {
  // meta: light index entries (always loaded). active: full note in the
  // editor (latest note at start). listNotes: all bodies — fetched only
  // when the notes modal opens (lazy load).
  const [meta, setMeta] = useState<NoteMeta[] | null>(null); // null = loading
  const [active, setActive] = useState<NoteRecord | null | undefined>(undefined); // undefined = loading, null = none
  const [listNotes, setListNotes] = useState<NoteRecord[] | null>(null); // null = not loaded yet
  const [listOpen, setListOpen] = useState(false); // modal closed by default
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [ready, setReady] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareInfo, setShareInfo] = useState<ShareInfo | null>(null); // {members, memberInfo, ownerUid, ownerName}
  const [shareBusy, setShareBusy] = useState(false);
  const [shareError, setShareError] = useState("");
  const [shareEmail, setShareEmail] = useState("");
  const { user } = useAuth();
  const userRef = useRef<User | null>(null);
  userRef.current = user;
  const canCloud = cloudEnabled();

  const dirtyUntil = useRef(0);
  const pendingRef = useRef(new Map<string, WritableNote>()); // id → note awaiting debounced write
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const flushRef = useRef<(() => void) | null>(null);
  const activeRef = useRef<NoteRecord | null | undefined>(null); // always-fresh active for subscriptions
  activeRef.current = active;

  // Push saved shared notes to their cloud doc (save-based, not realtime).
  const pushShared = (batch: WritableNote[]): void => {
    const u = userRef.current;
    if (!u || !cloudEnabled()) return;
    const shared = batch.filter((n) => n?.shared);
    if (!shared.length) return;
    Promise.all(shared.map((n) => pushSharedNote(n, u))).catch((err: unknown) =>
      console.warn("[notes] shared push failed", err)
    );
  };

  const flush = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!pendingRef.current.size) return;
    const batch = [...pendingRef.current.values()];
    pendingRef.current.clear();
    dirtyUntil.current = 0;
    Promise.all(batch.map((n) => writeNote(n))).then(() => {
      setSavedAt(new Date());
      pushShared(batch);
    });
  };
  flushRef.current = flush;

  const scheduleSave = (note: NoteRecord): void => {
    pendingRef.current.set(note.id, writable(note));
    if (timerRef.current) return;
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      const batch = [...pendingRef.current.values()];
      pendingRef.current.clear();
      dirtyUntil.current = 0;
      Promise.all(batch.map((n) => writeNote(n))).then(() => {
        setSavedAt(new Date());
        pushShared(batch);
      });
    }, 500);
  };

  // Pull the latest cloud copy of a shared note (on open — not realtime).
  const pullShared = async (note: NoteRecord): Promise<NoteRecord> => {
    const u = userRef.current;
    if (!u || !cloudEnabled() || !note?.shared) return note;
    const remote = await fetchSharedNote(note.sharedId || note.id).catch(() => null);
    if (!remote) return note;
    const merged = {
      ...note,
      title: remote.title ?? note.title,
      body: remote.body ?? note.body,
      updatedAt: remote.updatedAt ?? note.updatedAt,
      ownerUid: remote.ownerUid ?? note.ownerUid,
      ownerName: remote.ownerName ?? note.ownerName,
    };
    await writeNote(merged, "remote");
    return merged;
  };

  // Startup: index only, then open the latest note (no body bulk-load).
  // A shared latest note pulls its cloud copy on open.
  useEffect(() => {
    let cancelled = false;
    listNoteMeta().then(async (m) => {
      if (cancelled) return;
      setMeta(m);
      let opened = m[0] ? await readNote(m[0].id) : null;
      if (cancelled) return;
      if (opened?.shared) {
        try {
          opened = await pullShared(opened);
        } catch {
          // keep the local copy
        }
        if (cancelled) return;
        setMeta(await listNoteMeta());
        if (cancelled) return;
      }
      setActive(opened ?? null);
      setReady(true);
    });
    return () => {
      cancelled = true;
      flushRef.current?.();
    };
  }, []);

  // Remote updates: apply only when no unsaved local edits.
  useEffect(() => {
    const unsub = subscribeRecords((storeName, source) => {
      if (storeName !== "notes" || source !== "remote") return;
      if (Date.now() < dirtyUntil.current) return;
      (async () => {
        const m = await listNoteMeta();
        setMeta(m);
        const cur = activeRef.current;
        if (cur) {
          if (!m.some((e) => e.id === cur.id)) {
            setActive(m[0] ? await readNote(m[0].id) : null);
          } else {
            const fresh = await readNote(cur.id);
            if (fresh) setActive(fresh);
          }
        }
        if (listNotesRef.current) {
          const ns = await Promise.all(m.map((e) => readNote(e.id)));
          setListNotes(ns.filter((n): n is NoteRecord => Boolean(n)));
        }
      })().catch((err: unknown) => console.warn("[notes] remote refresh failed", err));
    });
    return unsub;
  }, []);
  const listNotesRef = useRef<NoteRecord[] | null>(null);
  listNotesRef.current = listNotes;

  // Shared-notes inbox: pull notes others shared with me into local
  // shared copies (content itself pulls on open; saves push).
  useEffect(() => {
    if (!user || !canCloud) return;
    let cancelled = false;
    const pullInbox = async () => {
      try {
        const inbox = await listSharedInbox(user.uid);
        if (cancelled) return;
        for (const entry of inbox) {
          const remote = await fetchSharedNote(entry.shareId).catch(() => null);
          if (cancelled) return;
          if (!remote) continue;
          await writeNote(
            {
              id: entry.shareId,
              sharedId: entry.shareId,
              shared: true,
              ownerUid: remote.ownerUid ?? entry.ownerUid ?? "",
              ownerName: remote.ownerName ?? entry.ownerName ?? "",
              title: remote.title ?? entry.title ?? "",
              body: remote.body ?? "",
              createdAt: remote.createdAt ?? new Date().toISOString(),
              updatedAt: remote.updatedAt ?? new Date().toISOString(),
            },
            "remote"
          );
        }
        if (cancelled) return;
        setMeta(await listNoteMeta());
        const cur = activeRef.current;
        if (cur?.shared) {
          const fresh = await readNote(cur.id);
          if (!cancelled && fresh) setActive(fresh);
        }
      } catch (err) {
        console.warn("[notes] shared inbox pull failed", err);
      }
    };
    pullInbox();
    const unsub = subscribeSharedInbox(
      user.uid,
      () => pullInbox(),
      (err) => console.warn("[notes] shared inbox listener failed", err)
    );
    return () => {
      cancelled = true;
      unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  // Collaborator info for the open shared note (avatar stack + manage list).
  useEffect(() => {
    if (!user || !canCloud || !active?.shared) {
      setShareInfo(null);
      return;
    }
    let cancelled = false;
    fetchSharedNote(active.sharedId || active.id)
      .then((remote) => {
        if (cancelled || !remote) return;
        setShareInfo({
          members: Array.isArray(remote.members) ? remote.members : [],
          memberInfo: remote.memberInfo ?? {},
          ownerUid: remote.ownerUid ?? active.ownerUid ?? "",
          ownerName: remote.ownerName ?? active.ownerName ?? "",
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id, active?.shared, user?.uid]);

  // Switching notes always returns the title to its h4 form.
  useEffect(() => {
    setEditingTitle(false);
  }, [active?.id]);

  const touch = () => {
    dirtyUntil.current = Date.now() + 2500;
  };

  const patchActive = (patch: Partial<Pick<NoteRecord, "title" | "body">>): void => {
    if (!active) return;
    touch();
    const updated = { ...active, ...patch, updatedAt: new Date().toISOString() };
    setActive(updated);
    setListNotes((lb) => (lb ? lb.map((n) => (n.id === updated.id ? updated : n)) : lb));
    setMeta((ms) =>
      ms
        ? ms.map((e) =>
            e.id === updated.id
              ? { ...e, title: updated.title, updatedAt: updated.updatedAt }
              : e
          )
        : ms
    );
    scheduleSave(updated);
  };

  const takenTitles = new Set((meta ?? []).map((e) => e.title ?? ""));

  const refreshShareInfo = async (target?: NoteRecord | null): Promise<void> => {
    const t = target ?? activeRef.current;
    if (!t?.shared) {
      setShareInfo(null);
      return;
    }
    const remote = await fetchSharedNote(t.sharedId || t.id).catch(() => null);
    if (remote) {
      setShareInfo({
        members: Array.isArray(remote.members) ? remote.members : [],
        memberInfo: remote.memberInfo ?? {},
        ownerUid: remote.ownerUid ?? t.ownerUid ?? "",
        ownerName: remote.ownerName ?? t.ownerName ?? "",
      });
    }
  };

  const markSharedLocal = async (
    note: NoteRecord,
    extra: { ownerUid: string; ownerName: string }
  ): Promise<NoteRecord> => {
    const updated = { ...note, shared: true, sharedId: note.sharedId || note.id, ...extra };
    await writeNote(updated);
    setActive((cur) => (cur?.id === updated.id ? updated : cur));
    setMeta(await listNoteMeta());
    return updated;
  };

  const openShare = () => {
    setShareError("");
    setShareEmail("");
    refreshShareInfo().catch(() => {});
    setShareOpen(true);
  };

  const doShare = async () => {
    if (!user || !active) return;
    setShareBusy(true);
    setShareError("");
    try {
      await shareNoteWith(user, active, shareEmail);
      setShareEmail("");
      const updated = await markSharedLocal(active, {
        ownerUid: user.uid,
        ownerName: user.displayName || user.email?.split("@")[0] || "Solver",
      });
      await pushSharedNote(updated, user).catch(() => {});
      await refreshShareInfo(updated);
    } catch (err) {
      setShareError(err instanceof Error ? err.message : "Could not share this note.");
    } finally {
      setShareBusy(false);
    }
  };

  const doUnshare = async (targetUid: string): Promise<void> => {
    if (!user || !active) return;
    setShareBusy(true);
    setShareError("");
    try {
      const members = await unshareMember(user, active, targetUid);
      if (!members.length) {
        const updated = { ...active, shared: false, ownerUid: "", ownerName: "", sharedId: "" };
        await writeNote(updated);
        setActive(updated);
        setMeta(await listNoteMeta());
        setShareInfo(null);
      } else {
        await refreshShareInfo(active);
      }
    } catch (err) {
      setShareError(err instanceof Error ? err.message : "Could not update sharing.");
    } finally {
      setShareBusy(false);
    }
  };

  const doStopSharing = async () => {
    if (!user || !active) return;
    if (!window.confirm("Stop sharing? Collaborators will lose access.")) return;
    setShareBusy(true);
    setShareError("");
    try {
      await stopSharing(user, active);
      const updated = { ...active, shared: false, ownerUid: "", ownerName: "", sharedId: "" };
      await writeNote(updated);
      setActive(updated);
      setMeta(await listNoteMeta());
      setShareInfo(null);
      setShareOpen(false);
    } catch (err) {
      setShareError(err instanceof Error ? err.message : "Could not stop sharing.");
    } finally {
      setShareBusy(false);
    }
  };

  const doLeave = async () => {
    if (!user || !active) return;
    if (!window.confirm("Leave this shared note? It stays with its owner.")) return;
    setShareBusy(true);
    try {
      const id = active.id;
      pendingRef.current.delete(id);
      await leaveSharedNote(user, active).catch(() => {});
      await deleteNote(id);
      const m = await listNoteMeta();
      setMeta(m);
      setListNotes((lb) => (lb ? lb.filter((n) => n.id !== id) : lb));
      setActive(m[0] ? (await readNote(m[0].id)) ?? null : null);
      setShareInfo(null);
      setShareOpen(false);
    } catch (err) {
      setShareError(err instanceof Error ? err.message : "Could not leave this note.");
    } finally {
      setShareBusy(false);
    }
  };

  const addNote = () => {
    if (!meta || meta.length >= MAX_NOTES) return;
    touch();
    const n = makeNote({ title: uniqueTitle(todayKey(), takenTitles) });
    setMeta((ms) => [
      {
        id: n.id,
        title: n.title,
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
        shared: n.shared === true,
        ownerUid: n.ownerUid ?? "",
        ownerName: n.ownerName ?? "",
      },
      ...(ms ?? []),
    ]);
    setListNotes((lb) => (lb ? [n, ...lb] : lb));
    setActive(n);
    scheduleSave(n);
    setListOpen(false); // show the new note in the editor
    setEditingTitle(true); // jump straight into titling it
  };

  const removeNote = async (id: string): Promise<void> => {
    const target =
      listNotes?.find((n) => n.id === id) ?? (active?.id === id ? active : null);
    const u = userRef.current;
    if (target?.shared && u && cloudEnabled()) {
      const isOwner = !target.ownerUid || target.ownerUid === u.uid;
      if (!isOwner) {
        if (!window.confirm("Leave this shared note? It stays with its owner.")) return;
        touch();
        pendingRef.current.delete(id);
        await leaveSharedNote(u, target).catch(() => {});
      } else {
        if (!window.confirm("Delete this note? Collaborators will lose access.")) return;
        touch();
        pendingRef.current.delete(id);
        await stopSharing(u, target).catch(() => {});
      }
    } else {
      if (!window.confirm("Delete this note?")) return;
      touch();
      pendingRef.current.delete(id);
    }
    await deleteNote(id);
    const nextMeta = (meta ?? []).filter((e) => e.id !== id);
    setMeta(nextMeta);
    setListNotes((lb) => (lb ? lb.filter((n) => n.id !== id) : lb));
    if (active?.id === id) {
      if (nextMeta[0]) readNote(nextMeta[0].id).then((n) => setActive(n ?? null));
      else setActive(null);
    }
  };

  const selectNote = (note: NoteRecord): void => {
    flush(); // don't lose the previous note's tail edits
    setActive(note);
    setEditingTitle(false);
    setListOpen(false);
    if (note?.shared) {
      pullShared(note)
        .then((merged) => {
          if (merged !== note) {
            setActive(merged);
            listNoteMeta().then(setMeta).catch(() => {});
          }
        })
        .catch(() => {});
    }
  };

  const openList = () => {
    setListOpen(true);
    if (listNotes === null) {
      if (!meta?.length) {
        setListNotes([]);
        return;
      }
      Promise.all(
        meta.map((e) =>
          active && e.id === active.id ? Promise.resolve(active) : readNote(e.id)
        )
      ).then((ns) => setListNotes(ns.filter((n): n is NoteRecord => Boolean(n))));
    }
  };

  const download = () => {
    if (!active) return;
    const blob = new Blob([active.body ?? ""], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(active.title || "note").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "note"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!ready || meta === null || active === undefined) {
    return (
      <div>
        <BackLink />
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Loading notes…</p>
      </div>
    );
  }

  const atLimit = meta.filter((e) => !e.shared).length >= MAX_NOTES;
  const lines = active ? (active.body ?? "").split("\n").length : 0;
  const nearLimit = active ? (active.body ?? "").length >= BODY_LIMIT * 0.95 : false;
  const isOwner = !active?.ownerUid || active.ownerUid === user?.uid;

  const options = (
    <div className="order-1 flex flex-wrap items-center gap-2 my-1 md:order-2 md:ml-auto">
      {active && user && canCloud &&
        (active.shared ? (
          <AvatarStackButton
            members={shareInfo?.members ?? []}
            memberInfo={shareInfo?.memberInfo ?? {}}
            ownerUid={shareInfo?.ownerUid ?? active.ownerUid ?? ""}
            onClick={openShare}
          />
        ) : (
          <Button size="sm" variant="secondary" onClick={openShare}>
            Share
          </Button>
        ))}
      <Button size="sm" variant="secondary" onClick={openList}>
        <NotesIcon className="h-4 w-4" /> All notes
      </Button>
      <Button
        size="sm"
        variant="secondary"
        onClick={addNote}
        disabled={atLimit}
        title={atLimit ? `Limit reached (${MAX_NOTES} notes)` : undefined}
      >
        New note
      </Button>
      <Button size="sm" variant="secondary" onClick={download} disabled={!active}>
        <DownloadIcon className="h-4 w-4" /> Download .txt
      </Button>
    </div>
  );

  return (
    <div className="flex min-h-[calc(100dvh-6.5rem)] flex-col">
      <BackLink />

      {/* Notes list modal — closed by default; bodies lazy-load on first open */}
      <Modal
        open={listOpen}
        onClose={() => setListOpen(false)}
        title="All notes"
        description={`${meta.length} / ${MAX_NOTES} notes`}
        size="md"
        footer={
          <Button
            size="sm"
            variant="secondary"
            onClick={addNote}
            disabled={atLimit}
            title={atLimit ? `Limit reached (${MAX_NOTES} notes)` : undefined}
          >
            New note
          </Button>
        }
      >
        {listNotes === null ? (
          <p className="py-4 text-sm text-slate-400 dark:text-slate-500">Loading…</p>
        ) : listNotes.length === 0 ? (
          <p className="py-4 text-sm text-slate-400 dark:text-slate-500">
            No notes yet.
          </p>
        ) : (
          <ul className="max-h-[55vh] space-y-1 overflow-y-auto">
            {listNotes.map((n) => {
              const isActive = active?.id === n.id;
              return (
                <li
                  key={n.id}
                  className={`flex items-center gap-1 rounded-lg ${
                    isActive
                      ? "bg-blue-50 dark:bg-blue-950/40"
                      : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => selectNote(n)}
                    className="min-w-0 flex-1 px-2 py-1.5 text-left"
                  >
                    <span className="block truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                      {n.title || "Untitled"}
                      {n.shared && (
                        <span className="ml-1.5 rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                          Shared
                        </span>
                      )}
                    </span>
                    <span className="block truncate text-xs text-slate-400 dark:text-slate-500">
                      {snippet(n)}
                    </span>
                  </button>
                  <IconButton
                    aria-label={`Delete ${n.title || "untitled"} note`}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeNote(n.id);
                    }}
                    className="mr-1 shrink-0 text-rose-500 hover:text-rose-600 dark:text-rose-400"
                  >
                    <TrashIcon className="h-3.5 w-3.5" />
                  </IconButton>
                </li>
              );
            })}
          </ul>
        )}
      </Modal>

      {/* Editor — stretches so the textarea reaches the bottom of the page */}
      <div className="mt-4 flex min-h-0 flex-1 flex-col">
        {/* Title + options: options above the title on phones, same row on desktop */}
        <div className="flex shrink-0 flex-col gap-2 md:flex-row md:items-center md:justify-between">
          {active && (
            <div className="order-2 min-w-0 md:order-1">
              {editingTitle ? (
                <input
                  ref={titleRef}
                  type="text"
                  value={active.title ?? ""}
                  maxLength={TITLE_LIMIT}
                  autoFocus
                  onChange={(e) => patchActive({ title: e.target.value })}
                  onBlur={() => {
                    setEditingTitle(false);
                    flush(); // click-away saves immediately
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur();
                  }}
                  placeholder="Title"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-lg font-semibold outline-none focus:border-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
                />
              ) : (
                <h4
                  onClick={() => setEditingTitle(true)}
                  title="Click to edit title"
                  className="cursor-text truncate text-lg font-semibold text-slate-900 dark:text-white"
                >
                  {active.title || (
                    <span className="font-normal text-slate-400 dark:text-slate-500">
                      Untitled
                    </span>
                  )}
                </h4>
              )}
            </div>
          )}
          {options}
        </div>
        {active?.shared && (
          <p className="mt-1 shrink-0 text-xs text-slate-400 dark:text-slate-500">
            {isOwner
              ? `Shared${shareInfo && shareInfo.members.length > 1 ? ` with ${shareInfo.members.length - 1} collaborator${shareInfo.members.length === 2 ? "" : "s"}` : ""} — ownership stays with you`
              : `Shared by ${active.ownerName || "owner"} — ownership stays with them`}
            {" · "}changes sync on save
          </p>
        )}

        {active ? (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <textarea
              value={active.body ?? ""}
              maxLength={BODY_LIMIT}
              onChange={(e) => patchActive({ body: e.target.value })}
              placeholder="Write anything — approaches, tricks, problems to revisit…"
              spellCheck={false}
              className="mt-3 min-h-0 w-full flex-1 resize-none rounded-xl border border-slate-300 bg-white p-4 font-mono text-sm outline-none focus:border-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
            <p className="mt-2 shrink-0 text-xs text-slate-500 dark:text-slate-400">
              {lines} lines &middot;{" "}
              <span className={nearLimit ? "text-amber-600 dark:text-amber-400" : undefined}>
                {(active.body ?? "").length.toLocaleString()} / {BODY_LIMIT.toLocaleString()}
              </span>{" "}
              characters
              {savedAt ? ` · saved ${savedAt.toLocaleTimeString()}` : ""}
            </p>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-400 dark:border-slate-700 dark:text-slate-500">
            <span>{atLimit ? "No note selected." : "No notes yet — hit “New note”."}</span>
            {!atLimit && (
              <Button size="sm" variant="secondary" onClick={addNote}>
                New note
              </Button>
            )}
          </div>
        )}

        {/* Page-bottom note */}
        <p className="mt-3 shrink-0 text-xs text-slate-400 dark:text-slate-500">
          Plain text, autosaved — max {MAX_NOTES} notes,{" "}
          {BODY_LIMIT.toLocaleString()} characters each.
          {user && canCloud && " Shared notes sync with collaborators on save."}
        </p>
      </div>

      <ShareModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        note={active}
        user={user}
        shareInfo={shareInfo}
        busy={shareBusy}
        error={shareError}
        email={shareEmail}
        setEmail={setShareEmail}
        onShare={doShare}
        onUnshare={doUnshare}
        onStop={doStopSharing}
        onLeave={doLeave}
      />
    </div>
  );
}

// Overlapped collaborator avatars — the share trigger on open shared
// notes. Clicking opens share management.
function AvatarStackButton({
  members,
  memberInfo,
  ownerUid,
  onClick,
}: {
  members: string[];
  memberInfo: Record<string, SharedMemberInfo>;
  ownerUid: string;
  onClick: () => void;
}) {
  const shown = members.slice(0, 4);
  const extra = members.length - shown.length;
  const infoOf = (uid: string): SharedMemberInfo =>
    memberInfo?.[uid] ?? { displayName: "?", photoURL: "" };
  return (
    <button
      type="button"
      onClick={onClick}
      title="Manage sharing"
      aria-label="Manage sharing"
      className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white py-1.5 pl-2 pr-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
    >
      <span className="flex -space-x-1.5">
        {shown.map((uid) => {
          const info = infoOf(uid);
          return (
            <Avatar
              key={uid}
              src={info.photoURL}
              name={info.displayName || "?"}
              className={`h-6 w-6 text-[9px] ring-2 ring-white dark:ring-slate-800 ${
                uid === ownerUid ? "outline outline-1 outline-amber-400" : ""
              }`}
            />
          );
        })}
      </span>
      {extra > 0 && (
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
          +{extra}
        </span>
      )}
      <span className="text-xs text-slate-500 dark:text-slate-400">Shared</span>
    </button>
  );
}

function ShareModal({
  open,
  onClose,
  note,
  user,
  shareInfo,
  busy,
  error,
  email,
  setEmail,
  onShare,
  onUnshare,
  onStop,
  onLeave,
}: {
  open: boolean;
  onClose: () => void;
  note: NoteRecord | null;
  user: User | null;
  shareInfo: ShareInfo | null;
  busy: boolean;
  error: string;
  email: string;
  setEmail: (value: string) => void;
  onShare: () => void;
  onUnshare: (uid: string) => void;
  onStop: () => void;
  onLeave: () => void;
}) {
  const members: string[] =
    shareInfo?.members ??
    (note?.shared ? [note.ownerUid || user?.uid].filter((u): u is string => Boolean(u)) : []);
  // Names for members whose info hasn't been stamped yet (they haven't
  // saved) resolve via their public profile.
  const [resolvedNames, setResolvedNames] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const missing = members.filter(
      (uid) =>
        uid !== user?.uid &&
        !shareInfo?.memberInfo?.[uid]?.displayName &&
        !resolvedNames[uid]
    );
    if (!missing.length) return;
    Promise.all(missing.map((uid) => getProfile(uid).catch(() => null))).then(
      (profiles) => {
        if (cancelled) return;
        const next: Record<string, string> = {};
        profiles.forEach((p, i) => {
          if (p?.displayName) next[missing[i]] = p.displayName;
        });
        if (Object.keys(next).length) {
          setResolvedNames((prev) => ({ ...prev, ...next }));
        }
      }
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, members.join("|")]);
  if (!note) return null;
  const isOwner = !note.ownerUid || note.ownerUid === user?.uid;
  const infoOf = (uid: string): { displayName?: string; photoURL?: string } =>
    shareInfo?.memberInfo?.[uid] ??
    (resolvedNames[uid] ? { displayName: resolvedNames[uid], photoURL: "" } : null) ??
    (uid === user?.uid
      ? {
          displayName: user.displayName || user.email?.split("@")[0] || "Solver",
          photoURL: user.photoURL || "",
        }
      : { displayName: "", photoURL: "" });
  const ownerUid: string = shareInfo?.ownerUid ?? note.ownerUid ?? user?.uid ?? "";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={note.shared ? "Manage sharing" : "Share this note"}
      description={
        isOwner
          ? "They can see and edit — ownership stays with you. Changes sync when saved."
          : "Ownership stays with the creator. Your edits sync when saved."
      }
      size="sm"
    >
      {isOwner ? (
        <>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
            Add by email
            <span className="mt-1 flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onShare();
                  }
                }}
                placeholder="friend@example.com"
                autoComplete="email"
                className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
              <Button
                size="sm"
                variant="secondary"
                onClick={onShare}
                disabled={busy || !email.trim()}
              >
                Add
              </Button>
            </span>
          </label>
          {error && (
            <p className="mt-2 text-sm text-rose-700 dark:text-rose-400">{error}</p>
          )}
          <p className="mb-1 mt-4 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Who has access
          </p>
          {members.length === 0 ? (
            <p className="py-2 text-sm text-slate-400 dark:text-slate-500">
              Only you — add someone above to start collaborating.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {members.map((uid) => {
                const info = infoOf(uid);
                const mine = uid === user?.uid;
                const owner = uid === ownerUid;
                return (
                  <li key={uid} className="flex items-center gap-2.5 py-2">
                    <Avatar
                      src={info.photoURL}
                      name={info.displayName || "?"}
                      className={`h-8 w-8 text-xs ${owner ? "outline outline-1 outline-amber-400" : ""}`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                        {info.displayName || "Collaborator"}
                        {mine && (
                          <span className="ml-1.5 text-xs font-normal text-slate-400">you</span>
                        )}
                      </span>
                      {owner && (
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                          Owner
                        </span>
                      )}
                    </span>
                    {!owner && !mine && (
                      <Button
                        size="xs"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => onUnshare(uid)}
                      >
                        Remove
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {note.shared && (
            <Button
              size="sm"
              variant="danger"
              className="mt-3"
              disabled={busy}
              onClick={onStop}
            >
              Stop sharing
            </Button>
          )}
        </>
      ) : (
        <>
          <div className="flex items-center gap-2.5 py-1">
            <Avatar
              src={shareInfo?.memberInfo?.[ownerUid]?.photoURL}
              name={shareInfo?.memberInfo?.[ownerUid]?.displayName || resolvedNames[ownerUid] || note.ownerName || "?"}
              className="h-9 w-9 text-sm"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                {shareInfo?.memberInfo?.[ownerUid]?.displayName || resolvedNames[ownerUid] || note.ownerName || "Owner"}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Note owner</p>
            </div>
          </div>
          {members.length > 1 && (
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              + {members.length - 1} other collaborator{members.length === 2 ? "" : "s"}
            </p>
          )}
          {error && (
            <p className="mt-2 text-sm text-rose-700 dark:text-rose-400">{error}</p>
          )}
          <Button
            size="sm"
            variant="secondary"
            className="mt-4"
            disabled={busy}
            onClick={onLeave}
          >
            Leave this note
          </Button>
        </>
      )}
    </Modal>
  );
}

function BackLink() {
  return (
    <Link
      to="/"
      className="flex shrink-0 items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
    >
      <BackIcon className="h-4 w-4" /> All topics
    </Link>
  );
}
