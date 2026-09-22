import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BackIcon, DownloadIcon, TrashIcon } from "../components/icons.jsx";
import { KEYS, getItem, setItem } from "../lib/db.js";

export default function NotesPage() {
  const [text, setText] = useState(null); // null = loading from IndexedDB
  const [savedAt, setSavedAt] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getItem(KEYS.notes).then((v) => {
      if (!cancelled) setText(v ?? "");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Debounced write: IndexedDB transactions are cheap but per-keystroke
  // writes are still wasteful.
  useEffect(() => {
    if (text === null) return;
    const t = setTimeout(() => {
      setItem(KEYS.notes, text).then(() => setSavedAt(new Date()));
    }, 500);
    return () => clearTimeout(t);
  }, [text]);

  const lines = !text ? 0 : text.split("\n").length;

  const download = () => {
    const blob = new Blob([text ?? ""], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "dsa-notes.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const clear = () => {
    if (window.confirm("Delete all notes?")) setText("");
  };

  if (text === null) {
    return (
      <div>
        <Link to="/" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100">
          <BackIcon className="h-4 w-4" /> All topics
        </Link>
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Loading notes…</p>
      </div>
    );
  }

  return (
    <div>
      <Link to="/" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100">
        <BackIcon className="h-4 w-4" /> All topics
      </Link>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notes</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Plain text, saved automatically in this browser.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={download}
            className="flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
          >
            <DownloadIcon className="h-4 w-4" /> Download .txt
          </button>
          <button
            onClick={clear}
            className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <TrashIcon className="h-4 w-4" /> Clear
          </button>
        </div>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Write anything — approaches, tricks, problems to revisit…"
        spellCheck={false}
        className="mt-4 min-h-[60vh] w-full rounded-xl border border-slate-300 bg-white p-4 font-mono text-sm outline-none focus:border-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
      />
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        {lines} lines &middot; {text.length} characters
        {savedAt ? ` · saved ${savedAt.toLocaleTimeString()}` : ""}
      </p>
    </div>
  );
}
