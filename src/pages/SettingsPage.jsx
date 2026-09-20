import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { BackIcon, DownloadIcon, MoonIcon, SunIcon, TrashIcon, UploadIcon } from "../components/icons.jsx";
import { applyBackup, exportProfile, parseBackup } from "../lib/profile.js";

export default function SettingsPage({ done, onReplace, onReset, theme, setTheme }) {
  const fileRef = useRef(null);
  const [message, setMessage] = useState(null); // { ok, text }
  const solved = Object.keys(done).length;

  const exportFile = () => {
    const payload = exportProfile();
    const day = new Date().toISOString().slice(0, 10);
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dsa-profile-${day}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importFile = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      let parsed;
      try {
        parsed = parseBackup(JSON.parse(reader.result));
      } catch {
        setMessage({
          ok: false,
          text: "Could not import: not a valid backup file.",
        });
        return;
      }
      if (
        !window.confirm(
          "Restore this backup? Progress merges in; notes, goals, rewards, theme and question-of-day will be replaced, then the app reloads."
        )
      )
        return;
      onReplace(applyBackup(parsed, done));
      window.location.reload();
    };
    reader.onerror = () =>
      setMessage({ ok: false, text: "Could not read the selected file." });
    reader.readAsText(file);
  };

  return (
    <div>
      <Link to="/" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100">
        <BackIcon className="h-4 w-4" /> All topics
      </Link>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">Settings</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Your progress is stored only in this browser (localStorage).
      </p>

      <section className="mt-6 max-w-2xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-lg font-semibold">Appearance</h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Defaults to your system preference.
        </p>
        <div className="mt-3 inline-flex rounded-lg border border-slate-300 p-1 dark:border-slate-600">
          <button
            onClick={() => setTheme("light")}
            className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium ${
              theme === "light"
                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            }`}
          >
            <SunIcon className="h-4 w-4" /> Light
          </button>
          <button
            onClick={() => setTheme("dark")}
            className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium ${
              theme === "dark"
                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            }`}
          >
            <MoonIcon className="h-4 w-4" /> Dark
          </button>
        </div>
      </section>

      <section className="mt-6 max-w-2xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-lg font-semibold">Backup & restore</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {solved} {solved === 1 ? "problem" : "problems"} marked as solved.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={exportFile}
            className="flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
          >
            <DownloadIcon className="h-4 w-4" /> Export profile
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <UploadIcon className="h-4 w-4" /> Import profile
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) importFile(e.target.files[0]);
              e.target.value = "";
            }}
          />
        </div>
        {message && (
          <p className={`mt-3 text-sm ${message.ok ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}>
            {message.text}
          </p>
        )}
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          Backs up progress, notes, goals, rewards, theme and question-of-day.
          Importing merges progress and replaces the rest, then reloads.
          Old progress-only backups still import.
        </p>
      </section>

      <section className="mt-4 max-w-2xl rounded-xl border border-rose-200 bg-white p-5 shadow-sm dark:border-rose-900 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-rose-700 dark:text-rose-400">Danger zone</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Clears all solved marks. Export a backup first if you want to keep them.
        </p>
        <button
          onClick={() => {
            if (window.confirm("Reset all solved progress?")) {
              onReset();
              setMessage({ ok: true, text: "Progress reset." });
            }
          }}
            className="mt-4 flex items-center gap-2 rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-sm text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950"
          >
            <TrashIcon className="h-4 w-4" /> Reset progress
        </button>
      </section>
    </div>
  );
}
