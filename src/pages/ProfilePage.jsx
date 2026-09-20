import { useEffect, useState } from "react";
import { TOPICS } from "../data/topics.js";
import { loadTopicCsv, F } from "../lib/csv.js";
import { getWeeklyTarget } from "../lib/plans.js";
import {
  collectDaily,
  collectWeekly,
  refreshRewards,
} from "../lib/rewards.js";
import { OverviewRow, fmtDay } from "../components/dashboard.jsx";
import { CheckIcon, StarIcon, TrophyIcon } from "../components/icons.jsx";

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

export default function ProfilePage({ done }) {
  const [data, setData] = useState(null); // { slug: rows[] }
  const [rewards, setRewards] = useState(() =>
    refreshRewards(done, getWeeklyTarget())
  );

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

      <OverviewRow done={done} total={data ? total : null} solved={solved} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center gap-2">
            <StarIcon className="h-5 w-5 fill-amber-400 text-amber-400" />
            <h2 className="text-lg font-semibold">Daily stars</h2>
          </div>
          <p className="mt-1 text-3xl font-bold">{stars}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            collected for hitting the daily target
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center gap-2">
            <TrophyIcon className="h-5 w-5 fill-amber-400 text-amber-500" />
            <h2 className="text-lg font-semibold">Weekly trophies</h2>
          </div>
          <p className="mt-1 text-3xl font-bold">{trophies}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            collected for a perfect 7-day week
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-lg font-semibold">Star history</h2>
          {daily.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              No stars yet — hit your daily target to earn one.
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
              {daily.map(([day, st]) => (
                <li
                  key={day}
                  className="flex items-center justify-between gap-3 py-1.5"
                >
                  <span className="flex items-center gap-3">
                    <StarIcon
                      className={`h-5 w-5 ${
                        st === "collected"
                          ? "fill-amber-400 text-amber-400"
                          : "text-amber-400"
                      }`}
                    />
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
                      Collect
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-lg font-semibold">Trophy history</h2>
          {weekly.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              No trophies yet — hit the daily target 7 days in a row.
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
              {weekly.map(([wk, st]) => (
                <li
                  key={wk}
                  className="flex items-center justify-between gap-3 py-1.5"
                >
                  <span className="flex items-center gap-3">
                    <TrophyIcon
                      className={`h-5 w-5 ${
                        st === "collected"
                          ? "fill-amber-400 text-amber-500"
                          : "text-amber-500"
                      }`}
                    />
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
                      Collect
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
