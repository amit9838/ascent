import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { dayCounts, dayKey, weekStart } from "../lib/activity.js";
import {
  collectDaily,
  collectWeekly,
  dailyTarget,
  refreshRewards,
} from "../lib/rewards.js";
import { getWeeklyTarget } from "../lib/plans.js";
import {
  CheckIcon,
  GiftIcon,
  StarIcon,
  TrophyIcon,
} from "./icons.jsx";
import { ProgressBar } from "./ui.jsx";

const card =
  "rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900";
const primaryBtn =
  "rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white";

export function RewardsCard({ done }) {
  const target = getWeeklyTarget();
  const dt = dailyTarget(target);
  const [rewards, setRewards] = useState(() => refreshRewards(done, target));

  useEffect(() => {
    setRewards(refreshRewards(done, target));
  }, [done, target]);

  const todayK = dayKey();
  const counts = dayCounts(done);
  const todayCount = counts[todayK] ?? 0;
  const todayStatus = rewards.daily[todayK]; // earned | collected | undefined

  const monday = weekStart();
  const weekKey = dayKey(monday);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    const k = dayKey(d);
    const c = counts[k] ?? 0;
    days.push({
      key: k,
      initial: d.toLocaleDateString(undefined, { weekday: "narrow" }),
      full: d.toLocaleDateString(undefined, {
        weekday: "long",
        month: "short",
        day: "numeric",
      }),
      count: c,
      earned: c >= dt && k <= todayK,
      future: k > todayK,
      isToday: k === todayK,
    });
  }
  const hitDays = days.filter((d) => d.earned).length;
  const weekStatus = rewards.weekly[weekKey];

  return (
    <section className={`${card} mb-6`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <GiftIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          Rewards
        </h2>
        <Link
          to="/profile"
          className="text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          View collection
        </Link>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
        <div className="flex items-center gap-3">
          <StarIcon
            className={`h-8 w-8 ${
              todayStatus === "collected"
                ? "fill-amber-400 text-amber-400"
                : todayStatus === "earned"
                  ? "text-amber-400"
                  : "text-slate-300 dark:text-slate-600"
            }`}
          />
          <div>
            <p className="text-sm font-semibold">Today's star</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {todayCount}/{dt} solved today
            </p>
          </div>
        </div>
        {todayStatus === "collected" ? (
          <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400">
            <CheckIcon className="h-4 w-4" /> Collected
          </span>
        ) : todayStatus === "earned" ? (
          <button onClick={() => setRewards(collectDaily(todayK))} className={primaryBtn}>
            Collect star
          </button>
        ) : (
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {dt - todayCount} more to go
          </span>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        {days.map((d) => (
          <div
            key={d.key}
            title={`${d.full}: ${d.count} solved`}
            className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
              d.earned
                ? "bg-emerald-500 text-white"
                : d.future
                  ? "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
                  : "bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-300"
            } ${d.isToday ? "ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-slate-900" : ""}`}
          >
            {d.earned ? <CheckIcon className="h-4 w-4" /> : d.initial}
          </div>
        ))}
        <span className="ml-1 text-xs text-slate-500 dark:text-slate-400">
          {hitDays}/7 days
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
        <div className="flex items-center gap-3">
          <TrophyIcon
            className={`h-8 w-8 ${
              weekStatus === "collected"
                ? "fill-amber-400 text-amber-500"
                : weekStatus === "earned"
                  ? "text-amber-500"
                  : "text-slate-300 dark:text-slate-600"
            }`}
          />
          <div>
            <p className="text-sm font-semibold">Weekly trophy</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Hit the daily target all 7 days
            </p>
          </div>
        </div>
        {weekStatus === "collected" ? (
          <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400">
            <CheckIcon className="h-4 w-4" /> Collected
          </span>
        ) : weekStatus === "earned" ? (
          <button onClick={() => setRewards(collectWeekly(weekKey))} className={primaryBtn}>
            Collect trophy
          </button>
        ) : (
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {hitDays}/7 days
          </span>
        )}
      </div>

      <div className="mt-3">
        <ProgressBar done={todayCount} total={dt} />
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Daily target: {dt}/day (from {target}/week)
        </p>
      </div>
    </section>
  );
}
