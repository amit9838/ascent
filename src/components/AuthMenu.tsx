import { useState } from "react";
import type { FormEvent } from "react";
import type { User } from "firebase/auth";
import { Link } from "react-router-dom";
import type { SyncStatus } from "../lib/cloud/sync/engine.ts";
import {
  authErrorMessage,
  requestPasswordReset,
  signInEmail,
  signInGoogle,
  signUpEmail,
  signOutUser,
} from "../lib/auth.ts";
import { cloudEnabled } from "../lib/cloud/firebase.ts";
import { syncErrorHint } from "../lib/cloud/sync.ts";
import { useTheme } from "../lib/entities/prefs.ts";
import {
  ArrowRightIcon,
  MoonIcon,
  SettingsIcon,
  SunIcon,
  UserIcon,
} from "./icons.tsx";
import {
  Avatar,
  Button,
  Divider,
  Field,
  Input,
  Modal,
  Popover,
} from "./primitives/index.ts";

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

export function AuthModal({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState("signin"); // signin | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const fail = (err: unknown) => setError(authErrorMessage(err));

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

  const submit = async (e: FormEvent<HTMLFormElement>) => {
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
    <Modal
      onClose={onClose}
      title="Sign in to sync"
      description="Optional — everything works offline. Signing in syncs your progress across devices and unlocks sharing."
    >
      <Button
        variant="secondary"
        onClick={google}
        disabled={busy}
        className="mt-4 w-full"
      >
        <GoogleMark /> Continue with Google
      </Button>

      <Divider label="or" className="my-4" />

      <form onSubmit={submit}>
        <Field label="Email">
          <Input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </Field>
        <Field label="Password" className="mt-3">
          <Input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
          />
        </Field>
        {error && (
          <p className="mt-3 text-sm text-rose-700 dark:text-rose-400">{error}</p>
        )}
        {notice && (
          <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-400">
            {notice}
          </p>
        )}
        <Button type="submit" loading={busy} className="mt-4 w-full">
          {mode === "signin" ? "Sign in" : "Create account"}
        </Button>
      </form>

      <div className="mt-4 flex items-center justify-between text-xs">
        <Button
          variant="link"
          size="xs"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError("");
            setNotice("");
          }}
        >
          {mode === "signin"
            ? "Need an account? Sign up"
            : "Have an account? Sign in"}
        </Button>
        {mode === "signin" && (
          <Button variant="ghost" size="xs" onClick={forgot}>
            Forgot password?
          </Button>
        )}
      </div>
    </Modal>
  );
}

function statusDot(status: SyncStatus | null): string {
  if (status?.state === "synced") return "bg-emerald-500";
  if (status?.state === "syncing") return "bg-amber-400 animate-pulse";
  if (status?.state === "offline") return "bg-slate-400";
  if (status?.state === "error") return "bg-rose-500";
  return "bg-slate-300 dark:bg-slate-600";
}

function statusText(status: SyncStatus | null): string {
  const key = status?.state ?? "idle";
  return (
    {
      synced: "Synced",
      syncing: "Syncing…",
      offline: "Offline — saved locally",
      error: "Sync error — saved locally",
      idle: "Signed in",
    }[key] ?? "Signed in"
  );
}

const rowCls =
  "flex w-full gap-3 rounded-lg px-2 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800";

export default function AuthMenu({
  user,
  status,
}: {
  user: User | null;
  status: SyncStatus | null;
}) {
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState(false);
  const { theme, toggleTheme } = useTheme();

  const trigger = user ? (
    <button
      onClick={() => setOpen(!open)}
      className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-slate-300 bg-slate-100 text-sm font-bold text-slate-700 hover:ring-2 hover:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
      aria-label="Account"
      aria-expanded={open}
    >
      <Avatar
        src={user.photoURL}
        name={user.displayName || user.email}
        className="h-full w-full text-sm"
      />
    </button>
  ) : (
    <button
      onClick={() => setOpen(!open)}
      className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
      aria-label="Account menu"
      aria-expanded={open}
    >
      <UserIcon className="h-4 w-4" />
      Account
    </button>
  );

  return (
    <>
      <Popover open={open} onOpenChange={setOpen} trigger={trigger} panelClassName="w-64">
        {user && (
          <>
            <div className="px-2 py-1">
              <p className="truncate font-medium">{user.displayName || "Signed in"}</p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                {user.email}
              </p>
            </div>
            <Divider className="my-2" />
          </>
        )}

        <Link
          to="/settings"
          onClick={() => setOpen(false)}
          className={`${rowCls} items-center`}
        >
          <SettingsIcon className="h-4 w-4 shrink-0" />
          Settings
        </Link>
        <button
          type="button"
          onClick={toggleTheme}
          className={`${rowCls} items-center`}
        >
          {theme === "dark" ? (
            <MoonIcon className="h-4 w-4 shrink-0" />
          ) : (
            <SunIcon className="h-4 w-4 shrink-0" />
          )}
          Theme
          <span className="ml-auto text-xs font-normal text-slate-400 dark:text-slate-500">
            {theme === "dark" ? "Dark" : "Light"}
          </span>
        </button>

        {user ? (
          <>
            <Divider className="my-2" />
            <div className="flex items-center gap-2 px-2 py-1 text-xs text-slate-500 dark:text-slate-400">
              <span className={`h-2 w-2 shrink-0 rounded-full ${statusDot(status)}`} />
              {statusText(status)}
            </div>
            {status?.state === "error" && (
              <p className="mt-1 rounded-md bg-rose-50 p-2 text-[11px] leading-snug text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
                {syncErrorHint(status)}
              </p>
            )}
            <button
              type="button"
              onClick={async () => {
                setOpen(false);
                await signOutUser().catch(() => {});
              }}
              className="mt-1 flex w-full items-start gap-3 rounded-lg bg-rose-50 px-2 py-2.5 text-left text-sm font-medium text-rose-700 hover:bg-rose-100 dark:bg-rose-950/50 dark:text-rose-300 dark:hover:bg-rose-950"
            >
              <ArrowRightIcon className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <span className="block">Sign out</span>
                <span className="block text-xs font-normal text-rose-500 dark:text-rose-400">
                  Keep local data
                </span>
              </span>
            </button>
          </>
        ) : (
          cloudEnabled() && (
            <>
              <Divider className="my-2" />
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setModal(true);
                }}
                className="flex w-full items-start gap-3 rounded-lg bg-blue-600 px-2 py-2.5 text-left text-sm font-medium text-white shadow-sm hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500"
              >
                <UserIcon className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  <span className="block">Sign in</span>
                  <span className="block text-xs font-normal text-blue-100 dark:text-blue-200">
                    Enable cloud sync
                  </span>
                </span>
              </button>
            </>
          )
        )}
      </Popover>
      {modal && <AuthModal onClose={() => setModal(false)} />}
    </>
  );
}
