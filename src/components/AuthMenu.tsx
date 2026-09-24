import { useState } from "react";
import type { FormEvent } from "react";
import type { User } from "firebase/auth";
import type { SyncStatus } from "../lib/cloud/sync/engine.ts";
import {
  authErrorMessage,
  requestPasswordReset,
  signInEmail,
  signInGoogle,
  signUpEmail,
  signOutUser,
} from "../lib/auth.js";
import { cloudEnabled } from "../lib/cloud/firebase.js";
import { syncErrorHint } from "../lib/cloud/sync.ts";
import {
  Avatar,
  Button,
  Divider,
  Field,
  Input,
  Modal,
  Popover,
} from "./primitives/index.js";

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

export default function AuthMenu({
  user,
  status,
}: {
  user: User | null;
  status: SyncStatus | null;
}) {
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState(false);

  if (!cloudEnabled()) return null;

  if (!user) {
    return (
      <>
        <Button onClick={() => setModal(true)}>Sign in</Button>
        {modal && <AuthModal onClose={() => setModal(false)} />}
      </>
    );
  }

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger={
        <button
          onClick={() => setOpen(!open)}
          className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-slate-300 bg-slate-100 text-sm font-bold text-slate-700 hover:ring-2 hover:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
          aria-label="Account"
        >
          <Avatar
            src={user.photoURL}
            name={user.displayName || user.email}
            className="h-full w-full text-sm"
          />
        </button>
      }
      panelClassName="w-56"
    >
      <p className="truncate font-medium">{user.displayName || "Signed in"}</p>
      <p className="truncate text-xs text-slate-500 dark:text-slate-400">
        {user.email}
      </p>
      <div className="mt-2 flex items-center gap-2 border-t border-slate-100 pt-2 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
        <span className={`h-2 w-2 shrink-0 rounded-full ${statusDot(status)}`} />
        {statusText(status)}
      </div>
      {status?.state === "error" && (
        <p className="mt-1 rounded-md bg-rose-50 p-2 text-[11px] leading-snug text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
          {syncErrorHint(status)}
        </p>
      )}
      <Button
        variant="secondary"
        size="sm"
        className="mt-2 w-full"
        onClick={async () => {
          setOpen(false);
          await signOutUser().catch(() => {});
        }}
      >
        Sign out (keep local data)
      </Button>
    </Popover>
  );
}
