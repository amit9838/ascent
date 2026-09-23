import { useEffect, useRef, useState } from "react";
import {
  authErrorMessage,
  requestPasswordReset,
  signInEmail,
  signInGoogle,
  signUpEmail,
  signOutUser,
} from "../lib/auth.js";
import { cloudEnabled } from "../lib/cloud/firebase.js";
import { syncErrorHint } from "../lib/cloud/sync.js";

const primaryBtn =
  "flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white";
const googleBtn =
  "flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700";
const input =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100";
const label = "block text-xs font-medium text-slate-600 dark:text-slate-300";

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.2-2.2H12v4.2h6.5c-.1 1.1-.8 2.7-2.4 3.8l3.7 2.9c2.2-2 3.7-5 3.7-8.7z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.8-3c-1 .7-2.4 1.2-4.2 1.2-3.2 0-5.9-2.1-6.8-5l-4 3.1C3.2 21.3 7.3 24 12 24z" />
      <path fill="#FBBC05" d="M5.2 14.3c-.2-.7-.4-1.5-.4-2.3s.1-1.6.4-2.3l-4-3.1C.4 8.2 0 10 0 12s.4 3.8 1.2 5.4l4-3.1z" />
      <path fill="#EA4335" d="M12 4.7c2.3 0 3.8.9 4.7 1.7l3.4-3.3C18 1.2 15.2 0 12 0 7.3 0 3.2 2.7 1.2 6.6l4 3.1c.9-2.9 3.6-5 6.8-5z" />
    </svg>
  );
}

export function AuthModal({ onClose }) {
  const [mode, setMode] = useState("signin"); // signin | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const fail = (err) => setError(authErrorMessage(err));

  const google = async () => {
    setBusy(true);
    setError("");
    try {
      await signInGoogle();
      onClose();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (mode === "signin") await signInEmail(email.trim(), password);
      else await signUpEmail(email.trim(), password);
      onClose();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const forgot = async () => {
    if (!email.trim()) {
      setError("Enter your email above first, then tap reset.");
      return;
    }
    setError("");
    try {
      await requestPasswordReset(email.trim());
      setNotice("Reset email sent — check your inbox.");
    } catch (err) {
      fail(err);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Sign in to sync</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Optional — everything works offline. Signing in syncs your progress
          across devices and unlocks sharing.
        </p>

        <button onClick={google} disabled={busy} className={`${googleBtn} mt-4`}>
          <GoogleMark /> Continue with Google
        </button>

        <div className="my-4 flex items-center gap-3 text-xs text-slate-400">
          <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
          or
          <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
        </div>

        <form onSubmit={submit}>
          <label className={label}>
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={input}
              autoComplete="email"
            />
          </label>
          <label className={`${label} mt-3`}>
            Password
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={input}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
            />
          </label>
          {error && (
            <p className="mt-3 text-sm text-rose-700 dark:text-rose-400">{error}</p>
          )}
          {notice && (
            <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-400">{notice}</p>
          )}
          <button type="submit" disabled={busy} className={`${primaryBtn} mt-4`}>
            {busy ? "…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <div className="mt-4 flex items-center justify-between text-xs">
          <button
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError("");
              setNotice("");
            }}
            className="text-blue-600 hover:underline dark:text-blue-400"
          >
            {mode === "signin"
              ? "Need an account? Sign up"
              : "Have an account? Sign in"}
          </button>
          {mode === "signin" && (
            <button onClick={forgot} className="text-slate-500 hover:underline dark:text-slate-400">
              Forgot password?
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function statusDot(status) {
  if (status?.state === "synced") return "bg-emerald-500";
  if (status?.state === "syncing") return "bg-amber-400 animate-pulse";
  if (status?.state === "offline") return "bg-slate-400";
  if (status?.state === "error") return "bg-rose-500";
  return "bg-slate-300 dark:bg-slate-600";
}

function statusText(status) {
  return {
    synced: "Synced",
    syncing: "Syncing…",
    offline: "Offline — saved locally",
    error: "Sync error — saved locally",
    idle: "Signed in",
  }[status?.state] ?? "Signed in";
}

export default function AuthMenu({ user, status }) {
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  if (!cloudEnabled()) return null;

  if (!user) {
    return (
      <>
        <button
          onClick={() => setModal(true)}
          className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
        >
          Sign in
        </button>
        {modal && <AuthModal onClose={() => setModal(false)} />}
      </>
    );
  }

  const initial = (user.displayName || user.email || "?").slice(0, 1).toUpperCase();

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-slate-300 bg-slate-100 text-sm font-bold text-slate-700 hover:ring-2 hover:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
        aria-label="Account"
      >
        {user.photoURL ? (
          <img src={user.photoURL} alt="" className="h-full w-full object-cover" />
        ) : (
          initial
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <p className="truncate font-medium">{user.displayName || "Signed in"}</p>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
          <div className="mt-2 flex items-center gap-2 border-t border-slate-100 pt-2 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <span className={`h-2 w-2 shrink-0 rounded-full ${statusDot(status)}`} />
            {statusText(status)}
          </div>
          {status?.state === "error" && (
            <p className="mt-1 rounded-md bg-rose-50 p-2 text-[11px] leading-snug text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
              {syncErrorHint(status)}
            </p>
          )}
          <button
            onClick={async () => {
              setOpen(false);
              await signOutUser().catch(() => {});
            }}
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-left text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Sign out (keep local data)
          </button>
        </div>
      )}
    </div>
  );
}
