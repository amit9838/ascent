// Reusable public-profile building blocks, modeled on industry-standard
// profile pages (GitHub/Strava/LeetCode): cover hero → stat strip →
// trophy case → rank path. Pure presentational — data shaping stays in
// the page.

import { CoinStack } from "./CoinStack.jsx";
import { currentRank, rankLadder } from "../lib/titles.js";
import {
  CheckIcon,
  FlameIcon,
  TrophyIcon,
  ZapIcon,
} from "./icons.jsx";

export const CARD =
  "rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900";

export function SectionHead({ title, sub, action }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {sub && (
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{sub}</p>
        )}
      </div>
      {action}
    </div>
  );
}

// Dark premium header: mesh-glow backdrop, ringed avatar, identity,
// CTA slot — with glassy icon stat tiles at the bottom.
export function ProfileHero({ profile, summary, subtitle, actions, badge }) {
  const s = summary;
  return (
    <section className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-xl shadow-slate-900/10">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(59,130,246,0.22),transparent_50%),radial-gradient(ellipse_at_bottom_right,rgba(139,92,246,0.18),transparent_45%)]" />
      <div className="relative p-5 sm:p-7">
        <div className="flex flex-wrap items-center gap-4 sm:gap-5">
          <div className="shrink-0 rounded-full bg-gradient-to-br from-blue-400 via-indigo-400 to-violet-400 p-[3px]">
            {profile.photoURL ? (
              <img
                src={profile.photoURL}
                alt=""
                className="h-20 w-20 rounded-full border-2 border-slate-900 bg-slate-800 object-cover sm:h-24 sm:w-24"
              />
            ) : (
              <span className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-slate-900 bg-gradient-to-br from-blue-500 to-indigo-600 text-3xl font-bold text-white sm:h-24 sm:w-24">
                {(profile.displayName ?? "S").slice(0, 1).toUpperCase()}
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-bold tracking-tight text-white sm:text-3xl">
                {profile.displayName ?? "Solver"}
              </h1>
              {badge}
            </div>
            <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
          </div>

          <div className="flex shrink-0 flex-col items-stretch gap-2">
            {actions}
          </div>
        </div>

        {s && <StatStrip summary={s} className="mt-6" />}
      </div>
    </section>
  );
}

// Glassy stat tiles with leading icons — no totals, no floating boxes.
export function StatStrip({ summary: s, className = "" }) {
  const items = [
    {
      icon: CheckIcon,
      label: "Solved",
      value: `${s.solved ?? 0}`,
      tone: "text-emerald-400 bg-emerald-500/15",
    },
    {
      icon: ZapIcon,
      label: "Points",
      value: `${s.points ?? 0}`,
      tone: "text-amber-400 bg-amber-500/15",
    },
    {
      icon: FlameIcon,
      label: "Streak",
      value: `${s.streak ?? 0}`,
      tone: "text-orange-400 bg-orange-500/15",
    },
    {
      icon: TrophyIcon,
      label: "Rank",
      value: `${s.rank ?? "—"}`,
      tone: "text-sky-400 bg-sky-500/15",
    },
  ];
  return (
    <div className={`grid grid-cols-2 gap-3 sm:grid-cols-4 ${className}`}>
      {items.map((it) => (
        <div
          key={it.label}
          className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3.5 py-3 backdrop-blur"
        >
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${it.tone}`}
          >
            <it.icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-lg font-bold tabular-nums leading-tight text-white">
              {it.value}
            </p>
            <p className="truncate text-[11px] font-medium uppercase tracking-wider text-slate-400">
              {it.label}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// Borderless coin display: stack + big count sitting directly on the
// section background (no card-within-card).
export function CoinCard({ coin, count, name, req, accent = "amber" }) {
  const amber = accent === "amber";
  return (
    <div className="flex items-center gap-5 py-1">
      <CoinStack coin={coin} count={count} />
      <div className="min-w-0">
        <p
          className={`text-xs font-semibold uppercase tracking-widest ${
            amber
              ? "text-amber-600 dark:text-amber-400"
              : "text-violet-600 dark:text-violet-400"
          }`}
        >
          {name}
        </p>
        <p className="mt-0.5 text-4xl font-black tracking-tight text-slate-900 dark:text-white">
          × {count}
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{req}</p>
      </div>
    </div>
  );
}

function rankReq(r, total) {
  if (r.solves === 1) return "Solve your first problem";
  if (r.solves >= total) return `Solve all ${total}`;
  return `Solve ${r.solves}`;
}

// Progress-to-next-rank bar + full ladder checklist.
export function RankPath({ solved, total }) {
  const { current, next } = currentRank(solved, total);
  const base = current?.solves ?? 0;
  const target = next?.solves ?? total;
  const pct =
    target > base
      ? Math.min(100, Math.round(((solved - base) / (target - base)) * 100))
      : 100;

  return (
    <section className={`${CARD} p-5 sm:p-6`}>
      <SectionHead
        title="Rank path"
        sub="From First Light to Crown Jewel."
        action={
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
            {current?.name ?? "Unranked"}
          </span>
        }
      />

      <div className="mt-4">
        <div className="flex items-baseline justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>
            {solved} solved
            {next && (
              <>
                {" · "}
                <span className="font-medium text-slate-700 dark:text-slate-200">
                  {Math.max(target - solved, 0)} to {next.name}
                </span>
              </>
            )}
          </span>
          <span className="tabular-nums">{pct}%</span>
        </div>
        <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <ul className="mt-4 grid gap-x-8 md:grid-cols-2">
        {rankLadder(total).map((r) => {
          const earned = solved >= r.solves;
          return (
            <li key={r.name} className="flex items-center justify-between gap-3 py-2">
              <span className="flex items-center gap-3">
                <TrophyIcon
                  className={`h-5 w-5 shrink-0 ${
                    earned ? "text-amber-500" : "text-slate-300 dark:text-slate-600"
                  }`}
                />
                <span>
                  <span
                    className={`block text-sm font-medium ${
                      earned ? "" : "text-slate-400 dark:text-slate-500"
                    }`}
                  >
                    {r.name}
                  </span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">
                    {rankReq(r, total)}
                  </span>
                </span>
              </span>
              {earned && (
                <CheckIcon className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// Small pill badge (rank title, states, …).
export function Pill({ children, tone = "slate", className = "" }) {
  const tones = {
    slate:
      "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    amber:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    emerald:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    blue: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
