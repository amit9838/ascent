import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { cloudEnabled } from "../../lib/cloud/firebase.js";
import { getProfile } from "../../lib/cloud/follow.js";
import {
  getSentStatus,
  isConnected,
  sendInviteToUid,
} from "../../lib/cloud/connections.js";
import { useAuth } from "../../lib/auth.js";
import { AuthModal } from "../../components/AuthMenu.jsx";
import {
  CARD,
  CoinCard,
  Pill,
  ProfileHero,
  RankPath,
  SectionHead,
} from "./components/index.js";
import { GoldCoin, SapphireCoin } from "../../components/coins.jsx";
import { BackIcon, CheckIcon, UserIcon } from "../../components/icons.jsx";

export default function PublicProfilePage() {
  const { uid } = useParams();
  const { user } = useAuth();
  const [profile, setProfile] = useState(null); // null=loading, false=unavailable
  const [relation, setRelation] = useState("loading"); // self|signedout|connected|pending|none
  const [busy, setBusy] = useState(false);
  const [inviteMsg, setInviteMsg] = useState(null);
  const [modal, setModal] = useState(false);

  useEffect(() => {
    if (!cloudEnabled() || !uid) return;
    let cancelled = false;
    setProfile(null);
    getProfile(uid)
      .then((p) => !cancelled && setProfile(p ?? false))
      .catch(() => !cancelled && setProfile(false));
    return () => {
      cancelled = true;
    };
  }, [uid, user?.uid]);

  useEffect(() => {
    if (!uid) return;
    if (!user) {
      setRelation("signedout");
      return;
    }
    if (user.uid === uid) {
      setRelation("self");
      return;
    }
    let cancelled = false;
    Promise.all([isConnected(user.uid, uid), getSentStatus(user.uid, uid)])
      .then(([conn, sent]) => {
        if (cancelled) return;
        if (conn) setRelation("connected");
        else if (sent === "pending") setRelation("pending");
        else setRelation("none");
      })
      .catch(() => !cancelled && setRelation("none"));
    return () => {
      cancelled = true;
    };
  }, [uid, user]);

  const isSelf = user?.uid === uid;

  const back = (
    <Link
      to="/leaderboard"
      className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 z-[0]"
    >
      <BackIcon className="h-4 w-4" /> Leaderboard
    </Link>
  );

  if (!cloudEnabled()) {
    return (
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Cloud features are not configured on this deployment.
        </p>
      </div>
    );
  }

  if (profile === null) {
    return (
      <div className="space-y-4">
        {back}
        <div className={`${CARD} h-64 animate-pulse`} />
      </div>
    );
  }

  // Not shared and not the owner's own page: message only, no data.
  if (!profile || (!profile.shareEnabled && !isSelf)) {
    return (
      <div>
        {back}
        <div className={`${CARD} mt-3 p-6 text-center sm:p-10`}>
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
            <UserIcon className="h-6 w-6 text-slate-400" />
          </span>
          <h1 className="mt-4 text-xl font-bold tracking-tight">Profile is private</h1>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-slate-500 dark:text-slate-400">
            This user hasn&apos;t shared their stats publicly. Nothing to show here —
            only they can see their progress.
          </p>
        </div>
      </div>
    );
  }

  const s = profile.summary ?? {};

  const invite = async () => {
    setBusy(true);
    setInviteMsg(null);
    try {
      await sendInviteToUid(user.uid, uid);
      setRelation("pending");
    } catch (err) {
      setInviteMsg(err?.message || "Could not send invite.");
    } finally {
      setBusy(false);
    }
  };

  const subtitle = isSelf
    ? profile.shareEnabled
      ? "Your public stats — anyone with the link can see this"
      : "Your profile — public sharing is off (enable it in Settings)"
    : `Public stats · updated ${
        s.updatedAt ? new Date(s.updatedAt).toLocaleDateString() : "—"
      }`;

  const badge =
    s.rank && s.rank !== "Unranked" ? (
      <Pill tone="amber">
        {s.rank}
      </Pill>
    ) : null;

  const actions = (
    <>
      {isSelf ? (
        <Pill className="justify-center">This is you</Pill>
      ) : relation === "loading" ? null : relation === "connected" ? (
        <Pill tone="emerald" className="justify-center">
          <CheckIcon className="h-3.5 w-3.5" /> Connected
        </Pill>
      ) : relation === "pending" ? (
        <Pill tone="amber" className="justify-center">
          Invite pending
        </Pill>
      ) : relation === "signedout" ? (
        <button
          onClick={() => setModal(true)}
          className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-white/25 dark:text-white dark:hover:bg-white/10"
        >
          <UserIcon className="h-4 w-4" /> Sign in to invite
        </button>
      ) : (
        <button
          onClick={invite}
          disabled={busy}
          className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
        >
          <UserIcon className="h-4 w-4" />
          {busy ? "Sending…" : "Invite to leaderboard"}
        </button>
      )}
      {inviteMsg && (
        <p className="max-w-48 text-xs text-rose-600 dark:text-rose-400">{inviteMsg}</p>
      )}
    </>
  );

  return (
    <div className="space-y-6">
      {back}

      <ProfileHero
        profile={profile}
        summary={s}
        subtitle={subtitle}
        badge={badge}
        actions={actions}
      />

      {(s.stars ?? 0) > 0 || (s.crowns ?? 0) > 0 ? (
        <section className={`${CARD} p-5 sm:p-6`}>
          <SectionHead
            title="Trophy case"
            sub="Coins earned by hitting daily targets and perfect weeks."
          />
          <div className="mt-4 grid gap-4 sm:grid-cols-2 sm:divide-x sm:divide-slate-200 sm:gap-8 dark:divide-slate-700">
            {(s.stars ?? 0) > 0 && (
              <CoinCard
                coin={GoldCoin}
                count={s.stars}
                name="Daybreak Stars"
                req="earned by hitting the daily target"
              />
            )}
            {(s.crowns ?? 0) > 0 && (
              <CoinCard
                accent="violet"
                coin={SapphireCoin}
                count={s.crowns}
                name="Sapphire Crowns"
                req="earned with perfect 7-day weeks"
              />
            )}
          </div>
        </section>
      ) : null}

      {(s.solved ?? 0) > 0 ? (
        <RankPath solved={s.solved} total={s.total ?? 0} />
      ) : null}

      <p className="pb-2 text-center text-xs text-slate-400 dark:text-slate-500">
        Shared: solved, points, streak, rank and coins — never notes or full history.
      </p>

      {modal && <AuthModal onClose={() => setModal(false)} />}
    </div>
  );
}
