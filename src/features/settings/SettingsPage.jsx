import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  BackIcon,
  DatabaseIcon,
  DownloadIcon,
  MoonIcon,
  SunIcon,
  TrashIcon,
  UploadIcon,
  UserIcon,
} from "../../components/icons.jsx";
import { applyBackup, exportProfile, parseBackup } from "./backup.js";
import { AuthModal } from "../../components/AuthMenu.jsx";
import {
  deleteAccountAndCloudData,
  setDisplayName,
  signOutUser,
} from "../../lib/auth.js";
import { cloudEnabled } from "../../lib/cloud/firebase.js";
import { getProfile, updateProfileDoc } from "../../lib/cloud/follow.js";
import { refreshProfileSummary, syncErrorHint } from "../../lib/cloud/sync.js";
import { refreshConnectionSummaries } from "../../lib/cloud/connections.js";

// Priority order: Account (identity/sync) → Data (safety) → Appearance
// (preference) → Danger zone (destructive, always last, isolated).
// Industry-standard layout: setting rows with label+description on the
// left and the control on the right, divided by hairlines.

const sectionCls =
  "rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 dark:border-slate-700 dark:bg-slate-900";
const dangerCls =
  "rounded-xl border border-rose-200 bg-white p-5 shadow-sm sm:p-6 dark:border-rose-900 dark:bg-slate-900";

const btnPrimary =
  "flex items-center gap-2 rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white";
const btnSecondary =
  "flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700";
const btnDanger =
  "flex items-center gap-2 rounded-lg border border-rose-300 bg-white px-3.5 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950";
const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100";

function Section({ icon, chip, title, desc, children, danger = false }) {
  return (
    <section className={danger ? dangerCls : sectionCls}>
      <div className="flex items-start gap-3.5">
        <span className={`shrink-0 rounded-lg p-2 ${chip}`}>{icon}</span>
        <div className="min-w-0">
          <h2
            className={`text-base font-semibold ${
              danger ? "text-rose-700 dark:text-rose-400" : ""
            }`}
          >
            {title}
          </h2>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            {desc}
          </p>
        </div>
      </div>
      <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
        {children}
      </div>
    </section>
  );
}

function Row({ title, desc, children, wide = false }) {
  return (
    <div className="flex flex-col gap-3 py-4 first:pt-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 sm:max-w-md">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
          {title}
        </p>
        {desc && (
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            {desc}
          </p>
        )}
      </div>
      {children && (
        <div
          className={
            wide
              ? "flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end"
              : "flex shrink-0 flex-wrap items-center justify-start gap-2 sm:justify-end"
          }
        >
          {children}
        </div>
      )}
    </div>
  );
}

function Switch({ checked, onChange, disabled = false, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
        checked ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
          checked ? "left-[1.375rem]" : "left-0.5"
        }`}
      />
    </button>
  );
}

function statusLine(syncStatus) {
  const map = {
    synced: "Synced to cloud",
    syncing: "Syncing…",
    offline: "Offline — will sync",
    error: "Sync error",
    idle: "Signed in",
  };
  return map[syncStatus?.state] ?? "Signed in";
}

function statusDotCls(syncStatus) {
  if (syncStatus?.state === "synced") return "bg-emerald-500";
  if (syncStatus?.state === "syncing") return "bg-amber-400 animate-pulse";
  if (syncStatus?.state === "offline") return "bg-slate-400";
  if (syncStatus?.state === "error") return "bg-rose-500";
  return "bg-slate-300 dark:bg-slate-600";
}

// --- P1: account & sync ---

function AccountSection({ user, syncStatus }) {
  const [modal, setModal] = useState(false);
  const [name, setName] = useState("");
  const [share, setShare] = useState(false);
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getProfile(user.uid)
      .then((p) => {
        if (cancelled || !p) return;
        setName(p.displayName ?? "");
        setShare(Boolean(p.shareEnabled));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  if (!cloudEnabled()) return null;

  if (!user) {
    return (
      <Section
        icon={<UserIcon className="h-5 w-5" />}
        chip="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
        title="Account"
        desc="Optional — sign in to sync across devices, unlock the leaderboard and share stats. Everything works offline either way."
      >
        <Row
          title="Cloud account"
          desc="Google or email. Your local data mirrors to your private cloud storage."
        >
          <button onClick={() => setModal(true)} className={btnPrimary}>
            Sign in
          </button>
        </Row>
        {modal && <AuthModal onClose={() => setModal(false)} />}
      </Section>
    );
  }

  const shareUrl = `${location.origin}${location.pathname}#/u/${user.uid}`;

  const saveProfile = async (patch) => {
    setBusy(true);
    setMessage(null);
    try {
      await updateProfileDoc(user.uid, patch);
      setMessage({ ok: true, text: "Saved." });
    } catch {
      setMessage({ ok: false, text: "Could not save — check your connection." });
    } finally {
      setBusy(false);
    }
  };

  const saveName = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    await setDisplayName(trimmed).catch(() => {});
    await saveProfile({ displayName: trimmed });
    // propagate the new name to connected leaderboards
    refreshConnectionSummaries(user.uid).catch(() => {});
  };

  const toggleShare = async (next) => {
    setShare(next);
    if (next) await refreshProfileSummary(user.uid).catch(() => {});
    await saveProfile({ shareEnabled: next });
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setMessage({ ok: true, text: "Share link copied." });
    } catch {
      setMessage({ ok: false, text: shareUrl });
    }
  };

  return (
    <Section
      icon={<UserIcon className="h-5 w-5" />}
      chip="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
      title="Account"
      desc="Identity, cloud sync and sharing."
    >
      <div className="flex flex-wrap items-center gap-3 py-4 first:pt-2">
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt=""
            className="h-10 w-10 rounded-full object-cover"
          />
        ) : (
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-sm font-bold text-white">
            {(user.displayName || user.email || "?").slice(0, 1).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
            {user.displayName || "Solver"}
          </p>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
            {user.email}
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          <span className={`h-2 w-2 rounded-full ${statusDotCls(syncStatus)}`} />
          {statusLine(syncStatus)}
        </span>
        <button onClick={() => signOutUser().catch(() => {})} className={btnSecondary}>
          Sign out
        </button>
      </div>

      {syncStatus?.state === "error" && (
        <p className="pb-4 text-xs leading-snug text-rose-700 dark:text-rose-400">
          {syncErrorHint(syncStatus)}
        </p>
      )}

      <Row
        wide
        title="Display name"
        desc="Shown on your public profile, leaderboard and invites."
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="How others see you"
          className={`${inputCls} sm:w-56`}
        />
        <button
          onClick={saveName}
          disabled={busy || !name.trim() || name.trim() === user.displayName}
          className={`${btnSecondary} disabled:opacity-50`}
        >
          Save
        </button>
      </Row>

      <Row
        title="Public stats page"
        desc="Anyone with the link sees solved, points, streak and rank — never your notes or full history."
      >
        <Switch
          checked={share}
          onChange={toggleShare}
          disabled={busy}
          label="Share public stats"
        />
      </Row>

      {share && (
        <Row wide title="Share link" desc="Send this to anyone — no account needed to view.">
          <input
            readOnly
            value={shareUrl}
            onFocus={(e) => e.target.select()}
            className={`${inputCls} truncate font-mono text-xs sm:w-72`}
          />
          <button onClick={copyLink} className={btnSecondary}>
            Copy
          </button>
        </Row>
      )}

      {message && (
        <p
          className={`pb-1 pt-3 text-sm ${
            message.ok
              ? "text-emerald-700 dark:text-emerald-400"
              : "text-rose-700 dark:text-rose-400"
          }`}
        >
          {message.text}
        </p>
      )}
    </Section>
  );
}

// --- page ---

export default function SettingsPage({
  done,
  onReplace,
  onReset,
  theme,
  setTheme,
  user,
  syncStatus,
}) {
  const fileRef = useRef(null);
  const [message, setMessage] = useState(null); // data section feedback
  const [resetMsg, setResetMsg] = useState(null);
  const [deleteMsg, setDeleteMsg] = useState(null);
  const solved = Object.keys(done).length;

  const exportFile = async () => {
    const payload = await exportProfile();
    const day = new Date().toISOString().slice(0, 10);
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dsa-progress-${day}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importFile = (file) => {
    const reader = new FileReader();
    reader.onload = async () => {
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
      const merged = await applyBackup(parsed, done);
      await onReplace(merged);
      window.location.reload();
    };
    reader.onerror = () =>
      setMessage({ ok: false, text: "Could not read the selected file." });
    reader.readAsText(file);
  };

  const themeBtn = (mode, icon, label) => (
    <button
      onClick={() => setTheme(mode)}
      className={`flex items-center justify-center gap-2 rounded-md px-4 py-1.5 text-sm font-medium transition ${
        theme === mode
          ? "bg-slate-900 text-white shadow-sm dark:bg-slate-100 dark:text-slate-900"
          : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
      }`}
    >
      {icon} {label}
    </button>
  );

  return (
    <div>
      <Link
        to="/"
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
      >
        <BackIcon className="h-4 w-4" /> All topics
      </Link>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">Settings</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Account, data and preferences — grouped by priority.
      </p>

      <div className="mt-6 max-w-3xl space-y-5">
        <AccountSection user={user} syncStatus={syncStatus} />

        <Section
          icon={<DatabaseIcon className="h-5 w-5" />}
          chip="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
          title="Data"
          desc={`${solved} ${solved === 1 ? "problem" : "problems"} solved — stored in this browser (IndexedDB). Cloud sync, when signed in, mirrors it; backups move it.`}
        >
          <Row
            title="Export profile"
            desc="Progress, notes, goals, rewards, theme and question-of-day in one JSON file."
          >
            <button onClick={exportFile} className={btnPrimary}>
              <DownloadIcon className="h-4 w-4" /> Export
            </button>
          </Row>
          <Row
            title="Import profile"
            desc="Merges progress; replaces the other sections; reloads when done. Old progress-only files still work."
          >
            <button onClick={() => fileRef.current?.click()} className={btnSecondary}>
              <UploadIcon className="h-4 w-4" /> Import
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
          </Row>
          {message && (
            <p
              className={`py-3 text-sm ${
                message.ok
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-rose-700 dark:text-rose-400"
              }`}
            >
              {message.text}
            </p>
          )}
        </Section>

        <Section
          icon={<SunIcon className="h-5 w-5" />}
          chip="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
          title="Appearance"
          desc="Personalise how Ascent looks on this device."
        >
          <Row
            title="Theme"
            desc="Defaults to your system preference; remembered per device."
          >
            <div className="inline-flex rounded-lg border border-slate-300 p-1 dark:border-slate-600">
              {themeBtn("light", <SunIcon className="h-4 w-4" />, "Light")}
              {themeBtn("dark", <MoonIcon className="h-4 w-4" />, "Dark")}
            </div>
          </Row>
        </Section>

        <Section
          danger
          icon={<TrashIcon className="h-5 w-5" />}
          chip="bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
          title="Danger zone"
          desc="Irreversible, destructive actions — kept isolated from everything else."
        >
          <Row
            title="Reset solved progress"
            desc="Clears all solved marks and rewards in this browser. Export first if you want to keep them."
          >
            <button
              onClick={async () => {
                if (window.confirm("Reset all solved progress?")) {
                  await onReset();
                  setResetMsg({ ok: true, text: "Progress reset." });
                }
              }}
              className={btnDanger}
            >
              <TrashIcon className="h-4 w-4" /> Reset
            </button>
          </Row>
          {cloudEnabled() && user && (
            <Row
              title="Delete account"
              desc="Deletes your account and all cloud data. Local data in this browser stays."
            >
              <button
                onClick={async () => {
                  if (
                    !window.confirm(
                      "Delete your account and ALL cloud data? This cannot be undone."
                    )
                  )
                    return;
                  setDeleteMsg(null);
                  try {
                    await deleteAccountAndCloudData();
                  } catch (err) {
                    setDeleteMsg({
                      ok: false,
                      text:
                        err?.code === "auth/requires-recent-login"
                          ? "Cloud data deleted. To remove the account too: sign out, sign in again, and retry."
                          : "Could not delete — try again.",
                    });
                  }
                }}
                className={btnDanger}
              >
                <TrashIcon className="h-4 w-4" /> Delete
              </button>
            </Row>
          )}
          {resetMsg && (
            <p className="py-3 text-sm text-emerald-700 dark:text-emerald-400">
              {resetMsg.text}
            </p>
          )}
          {deleteMsg && (
            <p className="py-3 text-sm text-rose-700 dark:text-rose-400">
              {deleteMsg.text}
            </p>
          )}
        </Section>
      </div>
    </div>
  );
}
