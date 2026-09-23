import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { cloudEnabled } from "../../lib/cloud/firebase.js";
import { computeSummary } from "../../lib/cloud/profileSummary.js";
import {
  acceptInvite,
  rejectInvite,
  removeConnection,
  sendInvite,
  subscribeConnections,
  subscribeInvites,
  subscribeSent,
} from "../../lib/cloud/connections.js";
import { CheckIcon, FlameIcon, HashIcon, MoreIcon, TrophyIcon, UserIcon, ZapIcon } from "../../components/icons.jsx";
import { IconButton, Popover } from "../../components/primitives/index.js";

const card =
  "rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 dark:border-slate-700 dark:bg-slate-900";
const inputCls =
  "flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100";

const statusChip = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  accepted: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  rejected: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
};

function friendlyError(err, fallback) {
  if (err?.code === "permission-denied")
    return `Cloud rejected this — step: "${err?.message ?? "unknown"}". The published rules don't allow it yet. Open Firebase console → Firestore → Rules and confirm the published text contains "match /emails/" (and invites/sent/connections blocks), then Publish and retry.`;
  if (err?.code === "unavailable")
    return "Can't reach the cloud — check your connection and retry.";
  return err?.message || fallback;
}

const rankCls = {
  1: "bg-amber-400 text-white",
  2: "bg-slate-300 text-slate-800 dark:bg-slate-500 dark:text-white",
  3: "bg-orange-400 text-white dark:bg-orange-600",
};

const avatarRing = {
  1: "ring-2 ring-amber-400",
  2: "ring-2 ring-slate-300 dark:ring-slate-500",
  3: "ring-2 ring-orange-300 dark:ring-orange-500",
};

function Rank({ pos }) {
  if (rankCls[pos]) {
    return (
      <span
        className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${rankCls[pos]}`}
      >
        {pos}
      </span>
    );
  }
  return (
    <span className="text-center text-sm font-semibold tabular-nums text-slate-400 dark:text-slate-500">
      {pos}
    </span>
  );
}

function Avatar({ name, photoURL, className = "h-9 w-9", ring = "" }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-sm font-bold text-white ${ring} ${className}`}
    >
      {photoURL ? (
        <img src={photoURL} alt="" className="h-full w-full object-cover" />
      ) : (
        (name ?? "S").slice(0, 1).toUpperCase()
      )}
    </span>
  );
}

const rowGrid =
  "grid grid-cols-[2.25rem_1fr_4.5rem_3.75rem_1.75rem] items-center gap-3 px-2 md:grid-cols-[2.5rem_1fr_5.5rem_4.25rem_4.75rem_7.5rem_1.75rem] md:gap-4";
const headGrid =
  "grid grid-cols-[2.25rem_1fr_4.5rem_3.75rem_1.75rem] items-center gap-3 px-2 md:grid-cols-[2.5rem_1fr_5.5rem_4.25rem_4.75rem_7.5rem_1.75rem] md:gap-4";

const headCell =
  "flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500";
const headIcon = "h-3.5 w-3.5 shrink-0";

const menuItem =
  "block w-full rounded-lg px-2.5 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800";
const menuDanger =
  "block w-full rounded-lg px-2.5 py-1.5 text-left text-sm text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/60";

// Three-dot row menu: visit profile, copy link, remove from board.
function RowMenu({ entry, isMe, busy, onVisit, onRemove }) {
  const [open, setOpen] = useState(false);

  const stop = (e) => e.stopPropagation();

  const copyLink = async (e) => {
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

function BoardRow({ pos, entry, isMe, busy, onRemove, onOpen }) {
  const s = entry.summary;
  return (
    <li
      onClick={() => onOpen?.(entry)}
      className={`${rowGrid} group cursor-pointer rounded-lg py-3.5 transition-colors ${
        isMe
          ? "bg-blue-50/70 dark:bg-blue-950/30"
          : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
      }`}
    >
      <Rank pos={pos} />
      <span className="flex min-w-0 items-center gap-2.5">
        <Avatar
          name={entry.displayName}
          photoURL={entry.photoURL}
          ring={avatarRing[pos] ?? ""}
        />
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
            {entry.displayName ?? "Solver"}
          </span>
          {isMe && (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
              you
            </span>
          )}
        </span>
      </span>
      <span className="text-center font-bold tabular-nums text-slate-900 dark:text-white">
        {s ? s.points ?? 0 : "—"}
      </span>
      <span className="text-center tabular-nums text-slate-600 dark:text-slate-300">
        {s ? s.solved ?? 0 : "—"}
      </span>
      <span className="hidden text-center tabular-nums text-slate-600 md:block dark:text-slate-300">
        {s ? s.streak ?? 0 : "—"}
      </span>
      <span className="hidden max-w-full truncate text-right md:block">
        {s ? (
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {s.rank ?? "Unranked"}
          </span>
        ) : (
          <span className="text-[11px] italic text-slate-400">no data yet</span>
        )}
      </span>
      <span className="flex justify-end" onClick={(e) => e.stopPropagation()}>
        <RowMenu
          entry={entry}
          isMe={isMe}
          busy={busy}
          onVisit={() => onOpen?.(entry)}
          onRemove={onRemove}
        />
      </span>
    </li>
  );
}

export default function LeaderboardPage({ user }) {
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState(null); // my summary (computed locally)
  const [rows, setRows] = useState([]); // connections (live)
  const [invites, setInvites] = useState([]); // received (live)
  const [sent, setSent] = useState([]); // sent (live)
  const [email, setEmail] = useState("");
  const [inviteMsg, setInviteMsg] = useState(null); // { ok, text }
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  // Row click → public profile (only shows data if they share publicly).
  const openProfile = (b) => {
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
  useEffect(() => {
    if (!user) return;
    setReady(false);
    const onErr = (err) => console.warn("[leaderboard] listener failed", err);
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
        setInvites(
          [...r].sort((a, b) => ((a.createdAt ?? "") < (b.createdAt ?? "") ? 1 : -1))
        )
      , onErr),
      subscribeSent(user.uid, (r) =>
        setSent(
          [...r].sort((a, b) => ((a.createdAt ?? "") < (b.createdAt ?? "") ? 1 : -1))
        )
      , onErr),
    ];
    return () => unsubs.forEach((u) => u());
  }, [user?.uid]);

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

  const board = [
    {
      uid: user.uid,
      displayName: "You",
      photoURL: user.photoURL,
      summary: me,
      isMe: true,
    },
    ...rows.map((r) => ({ ...r, isMe: false })),
  ].sort((a, b) => {
    const ap = a.summary?.points ?? -1;
    const bp = b.summary?.points ?? -1;
    if (bp !== ap) return bp - ap;
    return (b.summary?.solved ?? -1) - (a.summary?.solved ?? -1);
  });
  const myPos = board.findIndex((b) => b.isMe) + 1;

  const invite = async (e) => {
    e.preventDefault();
    if (busy || !email.trim()) return;
    setBusy(true);
    setInviteMsg(null);
    try {
      await sendInvite(user.uid, email);
      setInviteMsg({ ok: true, text: `Invite sent to ${email.trim()}.` });
      setEmail("");
    } catch (err) {
      console.warn("[leaderboard] invite failed", err);
      setInviteMsg({ ok: false, text: friendlyError(err, "Could not send invite.") });
    } finally {
      setBusy(false);
    }
  };

  const act = async (fn) => {
    setBusy(true);
    try {
      await fn();
      await computeMe();
    } catch (err) {
      console.warn("[leaderboard] action failed", err);
      setInviteMsg({ ok: false, text: friendlyError(err, "Action failed — retry.") });
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
          <div className="mt-4">
            <div
              className={`${headGrid} mt-5 border-b border-slate-200 pb-3 dark:border-slate-700`}
            >
              <span className={`${headCell} justify-center`}>
                <HashIcon className={headIcon} />
              </span>
              <span className={headCell}>
                <UserIcon className={headIcon} />
                Player
              </span>
              <span className={`${headCell} justify-end`}>
                <ZapIcon className={`${headIcon} text-amber-500`} />
                Points
              </span>
              <span className={`${headCell} justify-end`}>
                <CheckIcon className={`${headIcon} text-emerald-500`} />
                Solved
              </span>
              <span className={`${headCell} hidden justify-end md:flex`}>
                <FlameIcon className={`${headIcon} text-orange-500`} />
                Streak
              </span>
              <span className={`${headCell} hidden justify-end md:flex`}>
                <TrophyIcon className={`${headIcon} text-amber-500`} />
                Rank
              </span>
              <span aria-hidden="true" />
            </div>
            <ul className="mt-1">
              {board.map((b, i) => (
                <BoardRow
                  key={b.uid ?? i}
                  pos={i + 1}
                  entry={b}
                  isMe={b.isMe}
                  busy={busy}
                  onOpen={openProfile}
                  onRemove={
                    b.isMe
                      ? undefined
                      : () => act(() => removeConnection(user.uid, b.uid))
                  }
                />
              ))}
            </ul>
            <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-400 dark:border-slate-800 dark:text-slate-500">
              Ranked by points · tie-break on solved · stats refresh
              automatically whenever anyone solves a problem.
            </p>
          </div>
        )}
      </section>

      {invites.length > 0 && (
        <section className={`${card} mb-6`}>
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
                  <Avatar name={inv.displayName} photoURL={inv.photoURL} />
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
                    onClick={() => act(() => acceptInvite(user.uid, inv))}
                    disabled={busy}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <CheckIcon className="h-4 w-4" /> Accept
                  </button>
                  <button
                    onClick={() => act(() => rejectInvite(user.uid, inv))}
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
          <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
            {sent.map((s) => (
              <li
                key={s.uid}
                className="flex items-center justify-between gap-3 py-2 text-sm"
              >
                <span className="truncate text-slate-600 dark:text-slate-300">
                  {s.email ?? s.displayName ?? s.uid}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                    statusChip[s.status] ?? statusChip.pending
                  }`}
                >
                  {s.status ?? "pending"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
