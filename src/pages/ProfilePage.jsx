import { useEffect, useState } from "react";
import { TOPICS } from "../data/topics.js";
import { loadTopicCsv, F } from "../lib/csv.js";
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
import { OverviewRow, fmtDay } from "../components/dashboard.jsx";
import { CheckIcon, FlameIcon, StarIcon, TrophyIcon } from "../components/icons.jsx";
import { ProgressBar } from "../components/ui.jsx";
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

const collectBtn =
  "shrink-0 rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white";
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

function RankBanner({ solved, total }) {
  const { current, next } = currentRank(solved, total);
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 shadow-sm dark:border-amber-900 dark:bg-amber-950/50">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
        Current rank
      </p>
      <p className="mt-1 text-2xl font-bold">{current ? current.name : "Unranked"}</p>
      {next && (
        <>
          <ProgressBar done={solved} total={next.solves} className="mt-2" />
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {next.solves - solved} more to {next.name}
          </p>
        </>
      )}
      {!next && (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Max rank achieved. The crown is yours.
        </p>
      )}
    </div>
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
      <div className="mt-3">
        <RankBanner solved={solved} total={total} />
      </div>
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

export default function ProfilePage({ done }) {
  const [data, setData] = useState(null); // { slug: rows[] }
  const [rewards, setRewards] = useState(() =>
    refreshRewards(done, getWeeklyTarget())
  );
  const [target, setTarget] = useState(getWeeklyTarget);
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

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Your progress and reward collection.
        </p>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <div className="flex items-center gap-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <GoldCoin className="h-20 w-20 shrink-0 drop-shadow-lg" />
          <div>
            <p className="text-3xl font-bold">× {stars}</p>
            <p className="mt-1 text-sm font-medium">Daybreak Stars</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              claimed by hitting the daily target
            </p>
          </div>
        </div>
        <div className="flex items-center gap-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <SapphireCoin className="h-20 w-20 shrink-0 drop-shadow-lg" />
          <div>
            <p className="text-3xl font-bold">× {trophies}</p>
            <p className="mt-1 text-sm font-medium">Sapphire Crowns</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              claimed with perfect 7-day weeks
            </p>
          </div>
        </div>
      </div>

      <OverviewRow done={done} total={data ? total : null} solved={solved} />

      {data ? (
        <TrophyShelf
          done={done}
          solved={solved}
          total={total}
          perfectWeeks={Object.keys(rewards.weekly).length}
        />
      ) : null}

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
                      className={collectBtn}
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
                      className={collectBtn}
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
