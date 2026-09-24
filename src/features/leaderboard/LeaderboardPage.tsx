import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { User } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { cloudEnabled } from "../../lib/cloud/firebase.js";
import { computeSummary } from "../../lib/cloud/profileSummary.js";
import type { ProfileSummary } from "../../lib/cloud/profileSummary.js";
import { subscribeProfile } from "../../lib/cloud/follow.js";
import type { Profile } from "../../lib/cloud/follow.js";
import {
  acceptInvite,
  clearFinishedSentInvites,
  rejectInvite,
  removeConnection,
  sendInvite,
  subscribeConnections,
  subscribeInvites,
  subscribeSent,
  withdrawInvite,
} from "../../lib/cloud/connections.js";
import type { DirectoryEntry, Invite } from "../../lib/cloud/connections.js";
import { CheckIcon, FlameIcon, HashIcon, MoreIcon, TrophyIcon, UserIcon, ZapIcon } from "../../components/icons.jsx";
import { Button, Avatar, IconButton, Popover } from "../../components/primitives/index.js";
import { rankTier } from "../../lib/gamification/titles.ts";

const card =
  "rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 dark:border-slate-700 dark:bg-slate-900";
const inputCls =
  "flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100";

const statusChip: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  accepted: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  rejected: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
};

// Cloud docs are untrusted — coerce unknown fields to text at the boundary.
const asText = (v: unknown): string | undefined =>
  typeof v === "string" ? v : undefined;

export interface BoardEntry {
  uid: string;
  displayName?: string;
  photoURL?: string | null;
  summary: ProfileSummary | null;
  isMe: boolean;
}

function friendlyError(err: unknown, fallback: string): string {
  const code =
    typeof err === "object" && err !== null && "code" in err
      ? String((err as { code?: unknown }).code ?? "")
      : "";
  const message = err instanceof Error ? err.message : "";
  if (code === "permission-denied")
    return `Cloud rejected this — step: "${message || "unknown"}". The published rules don't allow it yet. Open Firebase console → Firestore → Rules and confirm the published text contains "match /emails/" (and invites/sent/connections blocks), then Publish and retry.`;
  if (code === "unavailable")
    return "Can't reach the cloud — check your connection and retry.";
  return message || fallback;
}

// Sort priority: points → solved → streak → rank title.
function compareBoard(a: BoardEntry, b: BoardEntry): number {
  const num = (
    s: ProfileSummary | null | undefined,
    k: "points" | "solved" | "streak"
  ): number => s?.[k] ?? -1;
  const keys = ["points", "solved", "streak"] as const;
  for (const k of keys) {
    const d = num(b.summary, k) - num(a.summary, k);
    if (d) return d;
  }
  return rankTier(b.summary?.rank ?? "") - rankTier(a.summary?.rank ?? "");
}

// Everything equal (points, solved, streak, rank) → full tie, same key.
function statsKey(s: ProfileSummary | null | undefined): string {
  return [
    s?.points ?? -1,
    s?.solved ?? -1,
    s?.streak ?? -1,
    rankTier(s?.rank ?? ""),
  ].join("|");
}

const avatarRing: Record<number, string> = {
  1: "ring-2 ring-amber-400",
  2: "ring-2 ring-slate-300 dark:ring-slate-500",
  3: "ring-2 ring-orange-300 dark:ring-orange-500",
};

// Lean table styling — tight cells so names breathe on small screens.
const thCls =
  "px-2 pb-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 md:px-3 dark:text-slate-500";
const tdCls = "px-2 py-2.5 align-middle md:px-3 md:py-3";
const boardCard =
  "rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-5 dark:border-slate-700 dark:bg-slate-900";

const headIcon = "h-3.5 w-3.5 shrink-0";

function Rank({ pos }: { pos: number }) {
  // Compact "#1" style — colored only for the podium spots.
  const tone =
    pos === 1
      ? "text-amber-500"
      : pos === 3
        ? "text-orange-500"
        : "text-slate-400 dark:text-slate-500";
  return (
    <span className={`text-sm font-bold tabular-nums ${tone}`}>#{pos}</span>
  );
}

const menuItem =
  "block w-full rounded-lg px-2.5 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800";
const menuDanger =
  "block w-full rounded-lg px-2.5 py-1.5 text-left text-sm text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/60";

// Three-dot row menu: visit profile, copy link, remove from board.
function RowMenu({
  entry,
  isMe,
  busy,
  onVisit,
  onRemove,
}: {
  entry: BoardEntry;
  isMe: boolean;
  busy: boolean;
  onVisit: () => void;
  onRemove?: () => void;
}) {
  const [open, setOpen] = useState(false);

  const stop = (e: { stopPropagation: () => void }): void => e.stopPropagation();

  const copyLink = async (e: { stopPropagation: () => void }): Promise<void> => {
    stop(e);
    setOpen(false);
    const url = `${window.location.origin}${window.location.pathname}#/u/${entry.uid}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // clipboard unavailable (http / permissions) — silently ignore
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      panelClassName="w-44"
      trigger={
        <IconButton
          aria-label={`Actions for ${entry.displayName ?? "player"}`}
          onClick={(e) => {
            stop(e);
            setOpen((v) => !v);
          }}
          className="text-slate-400 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
        >
          <MoreIcon className="h-4 w-4" />
        </IconButton>
      }
    >
      <button
        type="button"
        className={menuItem}
        onClick={(e) => {
          stop(e);
          setOpen(false);
          onVisit();
        }}
      >
        Visit profile
      </button>
      <button type="button" className={menuItem} onClick={copyLink}>
        Copy profile link
      </button>
      {!isMe && onRemove && (
        <button
          type="button"
          className={menuDanger}
          disabled={busy}
          onClick={(e) => {
            stop(e);
            setOpen(false);
            onRemove();
          }}
        >
          Remove from board
        </button>
      )}
    </Popover>
  );
}

function BoardRow({
  pos,
  members,
  busy,
  onRemoveMember,
  onOpen,
}: {
  pos: number;
  members: BoardEntry[];
  busy: boolean;
  onRemoveMember?: (m: BoardEntry) => (() => void) | undefined;
  onOpen?: (entry: BoardEntry) => void;
}) {
  const tied = members.length > 1;
  const primary = members[0];
  const s = primary.summary;
  const isMe = members.some((m) => m.isMe);
  const name = tied
    ? members.map((m) => m.displayName ?? "Solver").join(" & ")
    : (primary.displayName ?? "Solver");
  const ring =
    avatarRing[pos] ??
    (tied ? "ring-2 ring-white dark:ring-slate-900" : "");

  return (
    <tr
      onClick={tied ? undefined : () => onOpen?.(primary)}
      className={`group transition-colors ${
        tied ? "" : "cursor-pointer"
      } ${
        isMe
          ? "bg-blue-50/70 dark:bg-blue-950/30"
          : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
      }`}
    >
      <td className={`${tdCls} w-8 text-center`}>
        <Rank pos={pos} />
      </td>
      <td className={tdCls}>
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="flex shrink-0 items-center">
            {members.map((m, i) => (
              <Avatar
                key={m.uid}
                src={m.photoURL}
                name={m.displayName}
                className={`h-6 w-6 text-[10px] md:h-7 md:w-7 md:text-xs ${ring} ${
                  i > 0 ? "-ml-2.5" : ""
                }`}
              />
            ))}
          </span>
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
              {name}
            </span>
            {isMe && (
              <span className="shrink-0 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                You
              </span>
            )}
          </span>
        </span>
      </td>
      <td className={`${tdCls} w-12 text-right font-bold tabular-nums text-slate-900 md:w-24 dark:text-white`}>
        {s ? s.points ?? 0 : "—"}
      </td>
      <td className={`${tdCls} w-10 text-right tabular-nums text-slate-600 md:w-24 dark:text-slate-300`}>
        {s ? s.solved ?? 0 : "—"}
      </td>
      <td className={`${tdCls} hidden w-12 text-right tabular-nums text-slate-600 md:table-cell md:w-24 dark:text-slate-300`}>
        {s ? s.streak ?? 0 : "—"}
      </td>
      <td className={`${tdCls} hidden w-16 text-right md:table-cell md:w-24`}>
        {s ? (
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {s.rank ?? "Unranked"}
          </span>
        ) : (
          <span className="text-[11px] italic text-slate-400">no data yet</span>
        )}
      </td>
      <td
        className={`${tdCls} text-right ${tied ? "w-16" : "w-7"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="flex items-center justify-end gap-0.5">
          {members.map((m) => (
            <RowMenu
              key={m.uid}
              entry={m}
              isMe={m.isMe}
              busy={busy}
              onVisit={() => onOpen?.(m)}
              onRemove={onRemoveMember?.(m)}
            />
          ))}
        </span>
      </td>
    </tr>
  );
}

export default function LeaderboardPage({ user }: { user: User | null }) {
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<ProfileSummary | null>(null); // my summary (computed locally)
  const [rows, setRows] = useState<DirectoryEntry[]>([]); // connections: identity only (live)
  const [peerProfiles, setPeerProfiles] = useState<Record<string, Profile | null>>({}); // uid -> public profile (live)
  const profileUnsubs = useRef<Record<string, () => void>>({});
  const [invites, setInvites] = useState<Invite[]>([]); // received (live)
  const [sent, setSent] = useState<Invite[]>([]); // sent (live)
  const [email, setEmail] = useState("");
  const [inviteMsg, setInviteMsg] = useState<{ ok: boolean; text: string } | null>(null); // { ok, text }
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  // Row click → public profile (only shows data if they share publicly).
  const openProfile = (b: BoardEntry): void => {
    if (!b?.uid) return;
    navigate(`/u/${b.uid}`);
  };

  // My own stats come from local data.
  const computeMe = useCallback(async () => {
    setMe(await computeSummary().catch(() => null));
  }, []);

  useEffect(() => {
    computeMe();
  }, [computeMe]);

  // Connections, invites and sent-invites update live — no reload needed.
  // Stats come from each peer's public profile (one live subscription per
  // peer), never from stamped copies — boards refresh as anyone solves.
  useEffect(() => {
    if (!user) return;
    setReady(false);
    const onErr = (err: unknown): void =>
      console.warn("[leaderboard] listener failed", err);
    const toInvite = (r: DirectoryEntry): Invite => ({
      uid: r.uid,
      displayName: asText(r.displayName),
      photoURL: asText(r.photoURL),
      email: asText(r.email),
      status: asText(r.status),
      createdAt: asText(r.createdAt),
    });
    const newestFirst = (a: Invite, b: Invite): number =>
      (a.createdAt ?? "") < (b.createdAt ?? "") ? 1 : -1;
    const unsubs = [
      subscribeConnections(
        user.uid,
        (r) => {
          setRows(r);
          setReady(true);
        },
        onErr
      ),
      subscribeInvites(user.uid, (r) =>
        setInvites(r.map(toInvite).sort(newestFirst))
      , onErr),
      subscribeSent(user.uid, (r) =>
        setSent(r.map(toInvite).sort(newestFirst))
      , onErr),
    ];
    return () => unsubs.forEach((u) => u());
  }, [user?.uid]);

  useEffect(() => {
    const wanted = new Set(rows.map((r) => r.uid));
    for (const [uid, unsub] of Object.entries(profileUnsubs.current)) {
      if (!wanted.has(uid)) {
        unsub();
        delete profileUnsubs.current[uid];
        setPeerProfiles((prev) => {
          if (!(uid in prev)) return prev;
          const next = { ...prev };
          delete next[uid];
          return next;
        });
      }
    }
    for (const uid of wanted) {
      if (profileUnsubs.current[uid]) continue;
      profileUnsubs.current[uid] = subscribeProfile(
        uid,
        (profile) =>
          setPeerProfiles((prev) => ({ ...prev, [uid]: profile })),
        (err) => console.warn("[leaderboard] profile listener failed", err)
      );
    }
  }, [rows]);

  useEffect(
    () => () => {
      Object.values(profileUnsubs.current).forEach((unsub) => unsub());
      profileUnsubs.current = {};
    },
    []
  );

  if (!cloudEnabled()) {
    return (
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Leaderboard</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Cloud features are not configured on this deployment.
        </p>
      </div>
    );
  }

  if (!user) {
    return (
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Leaderboard</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          The leaderboard compares you with friends you invite. Sign in from
          the top-right corner to unlock it.
        </p>
      </div>
    );
  }

  if (!ready) {
    return (
      <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
        Loading leaderboard…
      </p>
    );
  }

  // Narrowed once here (const) so every closure below sees a non-null uid.
  const uid = user.uid;

  const board: BoardEntry[] = [
    {
      uid,
      displayName: user.displayName || user.email?.split("@")[0] || "You",
      photoURL: user.photoURL,
      summary: me,
      isMe: true,
    },
    ...rows.map((r): BoardEntry => {
      const profile = peerProfiles[r.uid];
      return {
        uid: r.uid,
        displayName: asText(profile?.displayName) ?? asText(r.displayName),
        photoURL: asText(profile?.photoURL) ?? asText(r.photoURL),
        summary: profile?.shareEnabled
          ? ((profile.summary as ProfileSummary | null) ?? null)
          : null,
        isMe: false,
      };
    }),
  ].sort(compareBoard);

  // Full ties share one overlapped row ("A & B") with the same position.
  // Competition ranking: a 2-wide tie at #2 pushes the next group to #4.
  const groups: Array<{ key: string; members: BoardEntry[]; pos: number }> = [];
  let seen = 0;
  for (const b of board) {
    const key = statsKey(b.summary);
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.members.push(b);
    } else {
      groups.push({ key, members: [b], pos: seen + 1 });
    }
    seen += 1;
  }
  const hasTies = groups.some((g) => g.members.length > 1);

  const myGroup = groups.find((g) => g.members.some((m) => m.isMe));
  const myPos = myGroup?.pos ?? 0;

  const invite = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (busy || !email.trim()) return;
    setBusy(true);
    setInviteMsg(null);
    try {
      await sendInvite(uid, email);
      setInviteMsg({ ok: true, text: `Invite sent to ${email.trim()}.` });
      setEmail("");
    } catch (err: unknown) {
      console.warn("[leaderboard] invite failed", err);
      setInviteMsg({ ok: false, text: friendlyError(err, "Could not send invite.") });
    } finally {
      setBusy(false);
    }
  };

  const act = async (fn: () => void | Promise<void>): Promise<void> => {
    setBusy(true);
    try {
      await fn();
      await computeMe();
    } catch (err: unknown) {
      console.warn("[leaderboard] action failed", err);
      setInviteMsg({ ok: false, text: friendlyError(err, "Action failed — retry.") });
    } finally {
      setBusy(false);
    }
  };

  const clearFinished = async (): Promise<void> => {
    setBusy(true);
    setInviteMsg(null);
    try {
      const n = await clearFinishedSentInvites(uid);
      await computeMe();
      setInviteMsg({
        ok: true,
        text: n
          ? `Cleared ${n} finished invite${n === 1 ? "" : "s"} — pending ones kept.`
          : "No finished invites to clear.",
      });
    } catch (err: unknown) {
      console.warn("[leaderboard] clear history failed", err);
      setInviteMsg({ ok: false, text: friendlyError(err, "Could not clear history.") });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Leaderboard</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {rows.length
            ? `You're #${myPos} of ${board.length} — updates live as anyone solves a problem.`
            : "Invite friends by email — once they accept, you'll all appear here, ranked by points."}
        </p>
      </div>

      <section className={`${card} mb-6`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <TrophyIcon className="h-5 w-5 text-amber-500" />
            The board
          </h2>
          {board.length > 1 && (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              {board.length} players · live
            </span>
          )}
        </div>

        {board.length <= 1 ? (
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Nobody here yet — invite a friend below and the race begins.
          </p>
        ) : (
          <div className="mt-3">
            <table className="w-full table-fixed">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className={`${thCls} w-8 text-center`}>
                    <HashIcon className={`mx-auto ${headIcon}`} />
                  </th>
                  <th className={`${thCls} text-left`}>
                    <span className="flex items-center gap-2">
                      <UserIcon className={headIcon} />
                      <span className="sr-only md:not-sr-only md:inline">
                        Player
                      </span>
                    </span>
                  </th>
                  <th className={`${thCls} w-12 text-right md:w-24`}>
                    <span className="flex items-center justify-end gap-1.5">
                      <ZapIcon className={`${headIcon} text-amber-500`} />
                      <span className="sr-only md:not-sr-only md:inline">
                        Points
                      </span>
                    </span>
                  </th>
                  <th className={`${thCls} w-10 text-right md:w-24`}>
                    <span className="flex items-center justify-end gap-1.5">
                      <CheckIcon className={`${headIcon} text-emerald-500`} />
                      <span className="sr-only md:not-sr-only md:inline">
                        Solved
                      </span>
                    </span>
                  </th>
                  <th className={`${thCls} hidden w-12 text-right md:table-cell md:w-24`}>
                    <span className="flex items-center justify-end gap-1.5">
                      <FlameIcon className={`${headIcon} text-orange-500`} />
                      <span className="sr-only md:not-sr-only md:inline">
                        Streak
                      </span>
                    </span>
                  </th>
                  <th className={`${thCls} hidden w-16 text-right md:table-cell md:w-24`}>
                    <span className="flex items-center justify-end gap-1.5">
                      <TrophyIcon className={`${headIcon} text-amber-500`} />
                      <span className="sr-only md:not-sr-only md:inline">
                        Rank
                      </span>
                    </span>
                  </th>
                  <th className={`${thCls} ${hasTies ? "w-16" : "w-7"}`}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <BoardRow
                    key={g.members.map((m) => m.uid).join("+")}
                    pos={g.pos}
                    members={g.members}
                    busy={busy}
                    onOpen={openProfile}
                    onRemoveMember={(m) =>
                      m.isMe
                        ? undefined
                        : () => act(() => removeConnection(uid, m.uid))
                    }
                  />
                ))}
              </tbody>
            </table>
            <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-400 dark:border-slate-800 dark:text-slate-500">
              Ranked by points · tie-break on solved · stats refresh
              automatically whenever anyone solves a problem.
            </p>
          </div>
        )}
      </section>

      {invites.length > 0 && (
      <section className={`${boardCard} mb-6`}>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <UserIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            Connection requests
          </h2>
          <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
            {invites.map((inv) => (
              <li
                key={inv.uid}
                className="flex items-center justify-between gap-3 py-2.5"
              >
                <span className="flex items-center gap-3">
                  <Avatar src={inv.photoURL} name={inv.displayName} className="h-9 w-9 text-sm" />
                  <span>
                    <span className="block text-sm font-medium">
                      {inv.displayName ?? "Solver"}
                    </span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">
                      wants to compare leaderboards with you
                    </span>
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => act(() => acceptInvite(uid, inv))}
                    disabled={busy}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <CheckIcon className="h-4 w-4" /> Accept
                  </button>
                  <button
                    onClick={() => act(() => rejectInvite(uid, inv))}
                    disabled={busy}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Reject
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={card}>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <UserIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          Invite friends
        </h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          They need an account (signed in at least once). They'll get a
          request to accept or reject.
        </p>
        <form onSubmit={invite} className="mt-3 flex flex-wrap gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="friend@example.com"
            className={inputCls}
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
          >
            {busy ? "…" : "Invite"}
          </button>
        </form>
        {inviteMsg && (
          <p
            className={`mt-3 text-sm ${
              inviteMsg.ok
                ? "text-emerald-700 dark:text-emerald-400"
                : "text-rose-700 dark:text-rose-400"
            }`}
          >
            {inviteMsg.text}
          </p>
        )}
        {sent.length > 0 && (
          <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Sent invites
              </h3>
              {sent.some((s) => s.status === "accepted" || s.status === "rejected") && (
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={clearFinished}
                  disabled={busy}
                >
                  Clear finished
                </Button>
              )}
            </div>
            <ul className="mt-1 divide-y divide-slate-100 dark:divide-slate-800">
              {sent.map((s) => {
                const pending = s.status === "pending" || !s.status;
                return (
                  <li
                    key={s.uid}
                    className="flex items-center justify-between gap-3 py-2 text-sm"
                  >
                    <span className="truncate text-slate-600 dark:text-slate-300">
                      {s.email ?? s.displayName ?? s.uid}
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                          statusChip[s.status ?? "pending"] ?? statusChip.pending
                        }`}
                      >
                        {s.status ?? "pending"}
                      </span>
                      {pending && (
                        <Button
                          variant="danger"
                          size="xs"
                          disabled={busy}
                          onClick={() => act(() => withdrawInvite(uid, s.uid))}
                        >
                          Withdraw
                        </Button>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
