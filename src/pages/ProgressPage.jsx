import { useEffect, useMemo, useState } from "react";
import { TOPICS } from "../data/topics.js";
import { loadTopicCsv, F } from "../lib/csv.js";
import { buildPointsMap } from "../lib/points.js";
import { getWeeklyTarget, setWeeklyTarget } from "../lib/plans.js";
import {
  collectDaily,
  collectWeekly,
  dailyTarget,
  refreshRewards,
} from "../lib/rewards.js";
import {
  CONSISTENCY_TITLES,
  STREAK_TITLES,
  currentRank,
  maxStreak,
  rankLadder,
} from "../lib/titles.js";
import { CheckIcon, FlameIcon, StarIcon, TrophyIcon } from "../components/icons.jsx";
import { ProgressBar } from "../components/ui.jsx";
import { CoinStack } from "../components/CoinStack.jsx";
import { GoldCoin, SapphireCoin } from "../components/coins.jsx";

function fmtFull(key /* YYYY-MM-DD, parsed without timezone shift */) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function fmtWeek(mondayKey) {
  const [y, m, d] = mondayKey.split("-").map(Number);
  const f = (dt) =>
    dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${f(new Date(y, m - 1, d))} – ${f(new Date(y, m - 1, d + 6))}`;
}

const stepper =
  "rounded-md border border-slate-300 px-2 py-0.5 text-sm hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800";

function ShelfRow({ icon, color, name, req, earned }) {
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

function rankReq(r, total) {
  if (r.solves === 1) return "Solve your first problem";
  if (r.solves >= total) return `Solve all ${total}`;
  return `Solve ${r.solves}`;
}

function TrophyShelf({ done, solved, total, perfectWeeks }) {
  const best = maxStreak(done);
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
                req={`${t.days}-day streak`}
                earned={best >= t.days}
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
                req={`${t.weeks} perfect ${t.weeks === 1 ? "week" : "weeks"}`}
                earned={perfectWeeks >= t.weeks}
              />
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

export default function ProgressPage({ done }) {
  const [data, setData] = useState(null); // { slug: rows[] }
  const pointsMap = useMemo(() => buildPointsMap(data), [data]);
  const [rewards, setRewards] = useState(() =>
    refreshRewards(done, pointsMap, getWeeklyTarget())
  );
  const [target, setTarget] = useState(getWeeklyTarget);

  useEffect(() => {
    setRewards(refreshRewards(done, pointsMap, getWeeklyTarget()));
  }, [data, done, pointsMap, target]);
  const changeTarget = (d) => {
    const next = Math.min(100, Math.max(1, target + d));
    setTarget(next);
    setWeeklyTarget(next);
  };

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      TOPICS.map((t) => loadTopicCsv(t.csv).then((rows) => [t.slug, rows]))
    )
      .then((entries) => {
        if (!cancelled) setData(Object.fromEntries(entries));
      })
      .catch(() => {
        if (!cancelled) setData({});
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const solvedIn = (rows) => rows.filter((r) => done[r[F.link]]).length;
  const total = data
    ? Object.values(data).reduce((a, rows) => a + rows.length, 0)
    : 0;
  const solved = data
    ? TOPICS.reduce((a, t) => a + solvedIn(data[t.slug] ?? []), 0)
    : 0;

  const daily = Object.entries(rewards.daily).sort((a, b) =>
    a[0] < b[0] ? 1 : -1
  );
  const weekly = Object.entries(rewards.weekly).sort((a, b) =>
    a[0] < b[0] ? 1 : -1
  );
  const stars = daily.filter(([, s]) => s === "collected").length;
  const trophies = weekly.filter(([, s]) => s === "collected").length;
  const rank = data ? currentRank(solved, total) : { current: null, next: null };
  const mix = { easy: 0, medium: 0, hard: 0 };
  if (data) {
    for (const rows of Object.values(data)) {
      for (const r of rows) {
        if (done[r[F.link]]) {
          const d = (r[F.difficulty] || "").toLowerCase();
          if (d === "easy" || d === "medium" || d === "hard") mix[d]++;
        }
      }
    }
  }
  const mastery = TOPICS.map((t) => {
    const rows = data?.[t.slug] ?? [];
    const s = rows.filter((r) => done[r[F.link]]).length;
    return { topic: t, solved: s, total: rows.length };
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

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <div className="relative flex items-center gap-5 overflow-hidden rounded-xl border border-amber-200/40 bg-gradient-to-br from-amber-50 via-white to-orange-100/60 p-5 shadow-sm dark:border-amber-900/30 dark:from-amber-950/50 dark:via-slate-900 dark:to-slate-900">
          <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-amber-300/40 blur-2xl dark:bg-amber-500/10" />
          <CoinStack coin={GoldCoin} count={stars} />
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-700 dark:text-amber-400">
              Daybreak Stars
            </p>
            <p className="mt-0.5 text-4xl font-black tracking-tight text-slate-900 dark:text-white">
              × {stars}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              claimed by hitting the daily target
            </p>
          </div>
        </div>
        <div className="relative flex items-center gap-5 overflow-hidden rounded-xl border border-violet-200/40 bg-gradient-to-br from-violet-50 via-white to-purple-100/60 p-5 shadow-sm dark:border-violet-900/30 dark:from-violet-950/50 dark:via-slate-900 dark:to-slate-900">
          <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-violet-300/40 blur-2xl dark:bg-violet-500/10" />
          <CoinStack coin={SapphireCoin} count={trophies} />
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-widest text-violet-700 dark:text-violet-400">
              Sapphire Crowns
            </p>
            <p className="mt-0.5 text-4xl font-black tracking-tight text-slate-900 dark:text-white">
              × {trophies}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              claimed with perfect 7-day weeks
            </p>
          </div>
        </div>
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
      

      {data ? (
        <TrophyShelf
          done={done}
          solved={solved}
          total={total}
          perfectWeeks={Object.keys(rewards.weekly).length}
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
        {!data ? (
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
                      onClick={() => setRewards(collectDaily(day))}
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
          {weekly.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              No Sapphire Crowns yet — hit the daily target 7 days in a row.
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
              {weekly.map(([wk, st]) => (
                <li
                  key={wk}
                  className="flex items-center justify-between gap-3 py-1.5"
                >
                  <span className="flex items-center gap-3">
                    <TrophyIcon className="h-5 w-5 shrink-0 text-slate-400" />
                    <span className="text-sm font-medium">{fmtWeek(wk)}</span>
                  </span>
                  {st === "collected" ? (
                    <span className="flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">
                      <CheckIcon className="h-3.5 w-3.5" /> Collected
                    </span>
                  ) : (
                    <button
                      onClick={() => setRewards(collectWeekly(wk))}
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
