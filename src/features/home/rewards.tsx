import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { dayKey, dayPoints, weekStart } from "../../lib/gamification/activity.ts";
import {
  collectDaily,
  collectWeekly,
  dailyTarget,
  refreshRewards,
} from "../../lib/gamification/rewards.ts";
import type { RewardStatusView } from "../../lib/gamification/rewards.ts";
import { useWeeklyTarget } from "../../lib/entities/settings.ts";
import { CheckIcon, GiftIcon , ArrowRightIcon} from "../../components/icons.jsx";
import { GoldCoin, SapphireCoin } from "../../components/coins.jsx";


const primaryBtn =
  "rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white";

const card =
  "rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900";
export function RewardsCard({
  solves,
  points,
}: {
  solves: Record<string, string>;
  points: Record<string, number>;
}) {
  const [target] = useWeeklyTarget();
  const dt = dailyTarget(target);
  const [rewards, setRewards] = useState<RewardStatusView>({ daily: {}, weekly: {} });

  useEffect(() => {
    let cancelled = false;
    refreshRewards(solves, points, target).then((s) => {
      if (!cancelled) setRewards(s);
    });
    return () => {
      cancelled = true;
    };
  }, [solves, points, target]);

  const claimDaily = async (day: string): Promise<void> => {
    setRewards(await collectDaily(day));
  };

  const claimWeekly = async (wk: string): Promise<void> => {
    setRewards(await collectWeekly(wk));
  };

  const todayK = dayKey();
  const counts = dayPoints(solves, points);
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
      points: c,
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
          to="/progress"
          className="text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          <span className="flex items-center">
            View Progress &nbsp;<ArrowRightIcon className="h-4 w-4" />
          </span>
        </Link>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-800/60">
          <div className="flex items-center gap-3">
            <GoldCoin
            className={`h-11 w-11 shrink-0 drop-shadow-md ${todayStatus ? "" : "grayscale opacity-50"}`}
          />
            <div className="min-w-0">
              <p className="text-sm font-semibold">Daybreak Star</p>
              <p className="text-2xl font-bold leading-tight">
                {todayCount}
                <span className="text-sm font-normal text-slate-500 dark:text-slate-400">
                  /{dt} pts
                </span>
              </p>
            </div>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-400 via-yellow-200 to-amber-400 transition-all duration-500"
              style={{ width: `${Math.min(100, Math.round((todayCount / dt) * 100))}%` }}
            />
          </div>
          <div className="mt-2 min-h-7 text-sm">
            {todayStatus === "collected" ? (
              <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                <CheckIcon className="h-4 w-4" /> Collected
              </span>
            ) : todayStatus === "earned" ? (
              <button onClick={() => claimDaily(todayK)} className={primaryBtn}>
                Claim
              </button>
            ) : (
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {dt - todayCount} more to go
              </span>
            )}
          </div>
        </div>

        <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-800/60">
          <div className="flex items-center gap-3">
            <SapphireCoin
            className={`h-11 w-11 shrink-0 drop-shadow-md ${weekStatus ? "" : "grayscale opacity-50"}`}
          />
            <div className="min-w-0">
              <p className="text-sm font-semibold">Sapphire Crown</p>
              <p className="text-2xl font-bold leading-tight">
                {hitDays}
                <span className="text-sm font-normal text-slate-500 dark:text-slate-400">
                  /7 days
                </span>
              </p>
            </div>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-600 via-purple-300 to-violet-600 transition-all duration-500"
              style={{ width: `${Math.round((hitDays / 7) * 100)}%` }}
            />
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            {days.map((d) => (
              <div
                key={d.key}
                title={`${d.full}: ${d.points} pts`}
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${
                  d.earned
                    ? "bg-emerald-500 text-white"
                    : d.future
                      ? "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
                      : "bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-300"
                } ${d.isToday ? "ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-slate-900" : ""}`}
              >
                {d.earned ? <CheckIcon className="h-3 w-3" /> : d.initial}
              </div>
            ))}
          </div>
          <div className="mt-2 min-h-7 text-sm">
            {weekStatus === "collected" ? (
              <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                <CheckIcon className="h-4 w-4" /> Collected
              </span>
            ) : weekStatus === "earned" ? (
              <button onClick={() => claimWeekly(weekKey)} className={primaryBtn}>
                Claim
              </button>
            ) : (
              <span className="text-sm text-slate-500 dark:text-slate-400">Win all 7 days</span>
            )}
          </div>
        </div>
      </div>
      <p className="mt-2 flex flex-wrap items-center justify-start gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-emerald-500" /> 1 pt · Easy
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-amber-500" /> 2 pts · Medium
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-rose-500" /> 3 pts · Hard
        </span>
      </p>
    </section>
  );
}
