import { useEffect, useMemo, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import { TOPICS } from "../../data/topics.ts";
import { loadProblemIndex } from "../../lib/data/problems.ts";
import type { Problem, ProblemIndex } from "../../lib/data/problemRows.ts";
import { buildPointsMap } from "../../lib/gamification/points.ts";
import { useWeeklyTarget } from "../../lib/entities/settings.ts";
import { dayKey, dayPoints } from "../../lib/gamification/activity.ts";
import { CROWN_DAYS, crownRunLength, perfectWeekCount } from "../../lib/gamification/crowns.ts";
import {
  collectCrown,
  collectDaily,
  dailyTarget,
  refreshRewards,
} from "../../lib/gamification/rewards.ts";
import type { RewardStatusView } from "../../lib/gamification/rewards.ts";
import {
  CONSISTENCY_TITLES,
  STREAK_TITLES,
  currentRank,
  maxStreak,
  rankLadder,
} from "../../lib/gamification/titles.ts";
import type { RankStep } from "../../lib/gamification/titles.ts";
import { CheckIcon, FlameIcon, StarIcon, TrophyIcon } from "../../components/icons.tsx";
import { ProgressBar } from "../../components/ui.tsx";
import { CoinStack } from "../../components/CoinStack.tsx";
import { GoldCoin, SapphireCoin } from "../../components/coins.tsx";

function fmtFull(key: string /* YYYY-MM-DD, parsed without timezone shift */): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function fmtRun(startKey: string): string {
  const [y, m, d] = startKey.split("-").map(Number);
  const f = (dt: Date): string =>
    dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${f(new Date(y, m - 1, d))} – ${f(new Date(y, m - 1, d + CROWN_DAYS - 1))}`;
}

const ACCENTS = {
  amber: {
    surface: "from-amber-50 dark:from-amber-400/[0.08]",
    badge:
      "bg-amber-50 text-amber-800 ring-amber-600/20 dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/25",
    fill: "bg-amber-500 dark:bg-amber-400",
  },
  violet: {
    surface: "from-violet-50 dark:from-violet-400/[0.08]",
    badge:
      "bg-violet-50 text-violet-800 ring-violet-600/20 dark:bg-violet-400/10 dark:text-violet-300 dark:ring-violet-400/25",
    fill: "bg-violet-500 dark:bg-violet-400",
  },
} as const;

// Collection summary for one coin type: stack, collected count, an
// unclaimed badge, and a meter toward the next coin. `segments` draws the
// meter as discrete steps (days in a run) instead of a continuous bar.
function RewardCard({
  coin,
  accent,
  name,
  collected,
  pending,
  meterLabel,
  done,
  total,
  unit,
  segments = false,
}: {
  coin: ComponentType<{ className?: string }>;
  accent: keyof typeof ACCENTS;
  name: string;
  collected: number;
  pending: number;
  meterLabel: string;
  done: number;
  total: number;
  unit: string;
  segments?: boolean;
}) {
  const a = ACCENTS[accent];
  const track = "h-1.5 rounded-full bg-slate-200/80 dark:bg-slate-700/80";
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white bg-gradient-to-br ${a.surface} via-white via-40% to-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:via-slate-900 dark:to-slate-900`}
    >
      <div className="flex items-center gap-5">
        <CoinStack coin={coin} count={collected} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-sm font-medium text-slate-600 dark:text-slate-300">{name}</h2>
            {pending > 0 && (
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${a.badge}`}
              >
                {pending} to claim
              </span>
            )}
          </div>
          <p className="mt-1 flex items-baseline gap-1.5">
            <span className="text-3xl font-semibold tabular-nums tracking-tight text-slate-900 dark:text-white">
              {collected}
            </span>
            <span className="text-sm text-slate-500 dark:text-slate-400">collected</span>
          </p>
          <div className="mt-4" aria-hidden="true">
            {segments ? (
              <div className="flex gap-1">
                {Array.from({ length: total }, (_, i) => (
                  <div key={i} className={`flex-1 ${track} ${i < done ? a.fill : ""}`} />
                ))}
              </div>
            ) : (
              <div className={`overflow-hidden ${track}`}>
                <div
                  className={`h-full rounded-full transition-all duration-500 ${a.fill}`}
                  style={{ width: `${Math.min(100, Math.round((done / Math.max(1, total)) * 100))}%` }}
                />
              </div>
            )}
          </div>
          <p className="mt-1.5 flex justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>{meterLabel}</span>
            <span className="tabular-nums">
              {Math.min(done, total)} / {total} {unit}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

const stepper =
  "rounded-md border border-slate-300 px-2 py-0.5 text-sm hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800";

function ShelfRow({
  icon,
  color,
  name,
  req,
  earned,
}: {
  icon: ReactNode;
  color: string;
  name: ReactNode;
  req: ReactNode;
  earned: boolean;
}) {
  return (
    <li className="flex items-center justify-between gap-3 py-1.5">
      <span className="flex items-center gap-3">
        <span className={earned ? color : "text-slate-300 dark:text-slate-600"}>
          {icon}
        </span>
        <span>
          <span
            className={`block text-sm font-medium ${earned ? "" : "text-slate-400 dark:text-slate-500"}`}
          >
            {name}
          </span>
          <span className="block text-xs text-slate-500 dark:text-slate-400">
            {req}
          </span>
        </span>
      </span>
      {earned && (
        <CheckIcon className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
      )}
    </li>
  );
}

function rankReq(r: RankStep, total: number): string {
  if (r.solves === 1) return "Solve your first problem";
  if (r.solves >= total) return `Solve all ${total}`;
  return `Solve ${r.solves}`;
}

function TrophyShelf({
  solves,
  solved,
  total,
  perfectWeeks,
}: {
  solves: Record<string, string>;
  solved: number;
  total: number;
  perfectWeeks: number;
}) {
  const best = maxStreak(solves);
  return (
    <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <h2 className="text-lg font-semibold">Treasure Hall</h2>
      <div className="mt-4 grid gap-6 md:grid-cols-3">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Rank
          </h3>
          <ul className="mt-1 divide-y divide-slate-100 dark:divide-slate-800">
            {rankLadder(total).map((r) => (
              <ShelfRow
                key={r.name}
                icon={<TrophyIcon className="h-5 w-5" />}
                color="text-amber-500"
                name={r.name}
                req={rankReq(r, total)}
                earned={solved >= r.solves}
              />
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Streak
          </h3>
          <ul className="mt-1 divide-y divide-slate-100 dark:divide-slate-800">
              {STREAK_TITLES.map((t) => (
                <ShelfRow
                  key={t.name}
                  icon={<FlameIcon className="h-5 w-5" />}
                  color="text-orange-500"
                  name={t.name}
                  req={`${t.days ?? 0}-day streak`}
                  earned={(best ?? 0) >= (t.days ?? 0)}
                />
              ))}
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Consistency
          </h3>
          <ul className="mt-1 divide-y divide-slate-100 dark:divide-slate-800">
              {CONSISTENCY_TITLES.map((t) => (
                <ShelfRow
                  key={t.name}
                  icon={<StarIcon className="h-5 w-5" />}
                  color="text-violet-500"
                  name={t.name}
                  req={`${t.weeks ?? 0} perfect ${t.weeks === 1 ? "week" : "weeks"}`}
                  earned={perfectWeeks >= (t.weeks ?? 0)}
                />
              ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

export default function ProgressPage({ solves }: { solves: Record<string, string> }) {
  const [index, setIndex] = useState<ProblemIndex | null>(null);
  const pointsMap = useMemo(() => buildPointsMap(index ?? {}), [index]);
  const [rewards, setRewards] = useState<RewardStatusView>({ daily: {}, crowns: {} });
  const [target, setTarget] = useWeeklyTarget();

  useEffect(() => {
    let cancelled = false;
    refreshRewards(solves, pointsMap, target).then((s) => {
      if (!cancelled) setRewards(s);
    });
    return () => {
      cancelled = true;
    };
  }, [index, solves, pointsMap, target]);
  const changeTarget = async (d: number): Promise<void> => {
    const next = Math.min(100, Math.max(1, target + d));
    await setTarget(next);
  };
  const claimDaily = async (day: string): Promise<void> => {
    setRewards(await collectDaily(day));
  };
  const claimCrown = async (start: string): Promise<void> => {
    setRewards(await collectCrown(start));
  };

  useEffect(() => {
    let cancelled = false;
    loadProblemIndex()
      .then((loaded) => {
        if (!cancelled) setIndex(loaded);
      })
      .catch(() => {
        if (!cancelled) setIndex(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const problemsOf = (slug: string): Problem[] => index?.byTopic.get(slug) ?? [];
  const solvedIn = (problems: Problem[]): number =>
    problems.filter((p) => solves[p.id]).length;
  const total = index?.total ?? 0;
  const solved = index
    ? TOPICS.reduce((count, t) => count + solvedIn(problemsOf(t.slug)), 0)
    : 0;

  const daily = Object.entries(rewards.daily).sort((a, b) =>
    a[0] < b[0] ? 1 : -1
  );
  const crowns = Object.entries(rewards.crowns).sort((a, b) =>
    a[0] < b[0] ? 1 : -1
  );
  const stars = daily.filter(([, s]) => s === "collected").length;
  const trophies = crowns.filter(([, s]) => s === "collected").length;
  const todayPoints = dayPoints(solves, pointsMap)[dayKey()] ?? 0;
  const runDays = crownRunLength(Object.keys(rewards.daily), Object.keys(rewards.crowns));
  const rank = index ? currentRank(solved, total) : { current: null, next: null };
  const mix: Record<string, number> = { easy: 0, medium: 0, hard: 0 };
  if (index) {
    for (const problem of index.byId.values()) {
      if (solves[problem.id]) {
        if (problem.difficulty in mix) mix[problem.difficulty]++;
      }
    }
  }
  const mastery = TOPICS.map((t) => {
    const problems = problemsOf(t.slug);
    const s = problems.filter((p) => solves[p.id]).length;
    return { topic: t, solved: s, total: problems.length };
  }).sort(
    (a, b) =>
      b.solved / Math.max(1, b.total) - a.solved / Math.max(1, a.total)
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Progress</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Your progress and reward collection.
        </p>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <RewardCard
          coin={GoldCoin}
          accent="amber"
          name="Daybreak Stars"
          collected={stars}
          pending={daily.length - stars}
          meterLabel="Today's target"
          done={todayPoints}
          total={dailyTarget(target)}
          unit="pts"
        />
        <RewardCard
          coin={SapphireCoin}
          accent="violet"
          name="Sapphire Crowns"
          collected={trophies}
          pending={crowns.length - trophies}
          meterLabel="Star days in a row"
          done={runDays}
          total={CROWN_DAYS}
          unit="days"
          segments
        />
      </div>

      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <span className="shrink-0 rounded-lg bg-amber-100 p-2 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
              <TrophyIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                <p className="truncate text-sm font-bold">
                  {rank.current ? rank.current.name : "Unranked"}
                  <span className="ml-2 text-xs font-normal text-slate-500 dark:text-slate-400">
                    {rank.next
                      ? `${rank.next.solves - solved} more to ${rank.next.name}`
                      : "The crown is yours."}
                  </span>
                </p>
                <p className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
                  {solved}/{total}
                </p>
              </div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-600 transition-all duration-500"
                  style={{
                    width: rank.next
                      ? `${Math.min(100, Math.round((solved / rank.next.solves) * 100))}%`
                      : "100%",
                  }}
                />
              </div>

            </div>
          </div>
        </section>
      

      {index ? (
        <TrophyShelf
          solves={solves}
          solved={solved}
          total={total}
          perfectWeeks={perfectWeekCount(Object.keys(rewards.daily))}
        />
      ) : null}

      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Topic mastery</h2>
          {solved > 0 && (
            <div
              className="flex items-center gap-2"
              title={`Solved mix: ${mix.easy} easy · ${mix.medium} medium · ${mix.hard} hard`}
            >
              <div className="flex h-1.5 w-36 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div
                  className="h-full bg-emerald-500"
                  style={{ width: `${(mix.easy / solved) * 100}%` }}
                />
                <div
                  className="h-full bg-amber-500"
                  style={{ width: `${(mix.medium / solved) * 100}%` }}
                />
                <div
                  className="h-full bg-rose-500"
                  style={{ width: `${(mix.hard / solved) * 100}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {mix.easy}e · {mix.medium}m · {mix.hard}h
              </p>
            </div>
          )}
        </div>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Solved per topic, best first.
        </p>
        {!index ? (
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
            Loading topics…
          </p>
        ) : (
          <ul className="mt-3 grid gap-x-6 md:grid-cols-2">
            {mastery.map(({ topic, solved: s, total: n }) => {
              const Icon = topic.icon;
              return (
                <li key={topic.slug} className="flex items-center gap-3 py-1.5">
                  <span className={`shrink-0 rounded-lg p-1.5 ${topic.chip}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span
                    className="w-32 shrink-0 truncate text-sm font-medium"
                    title={topic.name}
                  >
                    {topic.name}
                  </span>
                  <ProgressBar done={s} total={n} className="hidden sm:block" />
                  <span className="ml-auto text-xs text-slate-500 dark:text-slate-400">
                    {s}/{n}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2 my-4">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-lg font-semibold">Daybreak Stars</h2>
          {daily.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              No Daybreak Stars yet — hit your daily target to earn one.
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
              {daily.map(([day, st]) => (
                <li
                  key={day}
                  className="flex items-center justify-between gap-3 py-1.5"
                >
                  <span className="flex items-center gap-3">
                    <StarIcon className="h-5 w-5 shrink-0 text-slate-400" />
                    <span className="text-sm font-medium">{fmtFull(day)}</span>
                  </span>
                  {st === "collected" ? (
                    <span className="flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">
                      <CheckIcon className="h-3.5 w-3.5" /> Collected
                    </span>
                  ) : (
                    <button
                      onClick={() => claimDaily(day)}
                      className="rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                    >
                      Claim
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5  shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-lg font-semibold">Sapphire Crowns</h2>
          {crowns.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              No Sapphire Crowns yet — hit the daily target {CROWN_DAYS} days in a row.
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
              {crowns.map(([start, st]) => (
                <li
                  key={start}
                  className="flex items-center justify-between gap-3 py-1.5"
                >
                  <span className="flex items-center gap-3">
                    <TrophyIcon className="h-5 w-5 shrink-0 text-slate-400" />
                    <span className="text-sm font-medium">{fmtRun(start)}</span>
                  </span>
                  {st === "collected" ? (
                    <span className="flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">
                      <CheckIcon className="h-3.5 w-3.5" /> Collected
                    </span>
                  ) : (
                    <button
                      onClick={() => claimCrown(start)}
                      className="rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                    >
                      Claim
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="mb-2 flex items-center gap-1 mx-4">
        {/* <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" /> */}
        <span className="text-xs font-semibold uppercase tracking-wide  text-slate-500 dark:text-slate-400">
          Targets 
        </span>
        <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
      </div>

      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-lg font-semibold">Weekly goal</h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Set from here — the daily target is split evenly across the week.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <button onClick={() => changeTarget(-1)} className={stepper} aria-label="Decrease weekly goal">
            −
          </button>
          <span className="min-w-24 text-center text-2xl font-bold">
            {target}
            <span className="text-sm font-normal text-slate-500 dark:text-slate-400">
              /week
            </span>
          </span>
          <button onClick={() => changeTarget(1)} className={stepper} aria-label="Increase weekly goal">
            +
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          Daily target: {dailyTarget(target)}/day
        </p>
      </section>
    </div>
  );
}
