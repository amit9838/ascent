import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { BackIcon, DownloadIcon, NotesIcon, TrashIcon } from "../../components/icons.jsx";
import { Button, IconButton, Modal } from "../../components/primitives/index.js";
import { KEYS, subscribe } from "../../lib/db.js";
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
} from "../../lib/notes.js";

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function snippet(note) {
  const line = note.body.split("\n").find((l) => l.trim());
  return (line ?? "Empty note").slice(0, 100);
}

export default function NotesPage() {
  // meta: light index entries (always loaded). active: full note in the
  // editor (latest note at start). listNotes: all bodies — fetched only
  // when the notes modal opens (lazy load).
  const [meta, setMeta] = useState(null); // null = loading
  const [active, setActive] = useState(undefined); // undefined = loading, null = none
  const [listNotes, setListNotes] = useState(null); // null = not loaded yet
  const [listOpen, setListOpen] = useState(false); // modal closed by default
  const [savedAt, setSavedAt] = useState(null);
  const [ready, setReady] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);

  const dirtyUntil = useRef(0);
  const pendingRef = useRef(new Map()); // id → note awaiting debounced write
  const timerRef = useRef(null);
  const titleRef = useRef(null);
  const flushRef = useRef(null);
  const activeRef = useRef(null); // always-fresh active for subscriptions
  activeRef.current = active;

  const flush = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!pendingRef.current.size) return;
    const batch = [...pendingRef.current.values()];
    pendingRef.current.clear();
    dirtyUntil.current = 0;
    Promise.all(batch.map((n) => writeNote(n))).then(() => setSavedAt(new Date()));
  };
  flushRef.current = flush;

  const scheduleSave = (note) => {
    pendingRef.current.set(note.id, note);
    if (timerRef.current) return;
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      const batch = [...pendingRef.current.values()];
      pendingRef.current.clear();
      dirtyUntil.current = 0;
      Promise.all(batch.map((n) => writeNote(n))).then(() => setSavedAt(new Date()));
    }, 500);
  };

  // Startup: index only, then open the latest note (no body bulk-load).
  useEffect(() => {
    let cancelled = false;
    listNoteMeta().then(async (m) => {
      if (cancelled) return;
      setMeta(m);
      const latest = m[0] ? await readNote(m[0].id) : null;
      if (cancelled) return;
      setActive(latest ?? null);
      setReady(true);
    });
    return () => {
      cancelled = true;
      flushRef.current?.();
    };
  }, []);

  // Remote updates: apply only when no unsaved local edits.
  useEffect(() => {
    const unsub = subscribe((key, source) => {
      if (key !== KEYS.notes || source !== "remote") return;
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
          setListNotes(ns.filter(Boolean));
        }
      })().catch((err) => console.warn("[notes] remote refresh failed", err));
    });
    return unsub;
  }, []);
  const listNotesRef = useRef(null);
  listNotesRef.current = listNotes;

  // Switching notes always returns the title to its h4 form.
  useEffect(() => {
    setEditingTitle(false);
  }, [active?.id]);

  const touch = () => {
    dirtyUntil.current = Date.now() + 2500;
  };

  const patchActive = (patch) => {
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

  const takenTitles = new Set((meta ?? []).map((e) => e.title));

  const addNote = () => {
    if (!meta || meta.length >= MAX_NOTES) return;
    touch();
    const n = makeNote({ title: uniqueTitle(todayKey(), takenTitles) });
    setMeta((ms) => [{ id: n.id, title: n.title, createdAt: n.createdAt, updatedAt: n.updatedAt }, ...(ms ?? [])]);
    setListNotes((lb) => (lb ? [n, ...lb] : lb));
    setActive(n);
    scheduleSave(n);
    setListOpen(false); // show the new note in the editor
    setEditingTitle(true); // jump straight into titling it
  };

  const removeNote = (id) => {
    if (!window.confirm("Delete this note?")) return;
    touch();
    pendingRef.current.delete(id); // never resurrect a just-deleted note
    deleteNote(id);
    const nextMeta = (meta ?? []).filter((e) => e.id !== id);
    setMeta(nextMeta);
    setListNotes((lb) => (lb ? lb.filter((n) => n.id !== id) : lb));
    if (active?.id === id) {
      if (nextMeta[0]) readNote(nextMeta[0].id).then((n) => setActive(n ?? null));
      else setActive(null);
    }
  };

  const selectNote = (note) => {
    flush(); // don't lose the previous note's tail edits
    setActive(note);
    setEditingTitle(false);
    setListOpen(false);
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
      ).then((ns) => setListNotes(ns.filter(Boolean)));
    }
  };

  const download = () => {
    if (!active) return;
    const blob = new Blob([active.body], { type: "text/plain;charset=utf-8" });
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

  const atLimit = meta.length >= MAX_NOTES;
  const lines = active ? active.body.split("\n").length : 0;
  const nearLimit = active && active.body.length >= BODY_LIMIT * 0.95;

  const options = (
    <div className="order-1 flex flex-wrap items-center gap-2 md:order-2 md:ml-auto">
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
                  value={active.title}
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

        {active ? (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <textarea
              value={active.body}
              maxLength={BODY_LIMIT}
              onChange={(e) => patchActive({ body: e.target.value })}
              placeholder="Write anything — approaches, tricks, problems to revisit…"
              spellCheck={false}
              className="mt-3 min-h-0 w-full flex-1 resize-none rounded-xl border border-slate-300 bg-white p-4 font-mono text-sm outline-none focus:border-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
            <p className="mt-2 shrink-0 text-xs text-slate-500 dark:text-slate-400">
              {lines} lines &middot;{" "}
              <span className={nearLimit ? "text-amber-600 dark:text-amber-400" : undefined}>
                {active.body.length.toLocaleString()} / {BODY_LIMIT.toLocaleString()}
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
        </p>
      </div>
    </div>
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
