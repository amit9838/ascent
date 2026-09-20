import { useEffect, useState } from "react";
import { TOPICS } from "../data/topics.js";
import { F } from "../lib/csv.js";
import {
  bestDay,
  currentStreak,
  dayCounts,
  dayKey,
  heatmapWeeks,
  monthKey,
  solvedThisWeek,
  weekRangeLabel,
} from "../lib/activity.js";
import {
  getMonthPlan,
  getWeeklyTarget,
  setWeeklyTarget,
  toggleMonthTopic,
} from "../lib/plans.js";
import { dailyTarget } from "../lib/rewards.js";
import {
  CalendarIcon,
  CheckIcon,
  FlameIcon,
  TargetIcon,
  ZapIcon,
} from "./icons.jsx";
import { ProgressBar } from "./ui.jsx";

const card =
  "rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900";

export function fmtDay(key /* YYYY-MM-DD, parsed without timezone shift */) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function Tile({ icon, label, value, sub, children }) {
  return (
    <div className={card}>
      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
        {icon}
        <p className="text-xs font-semibold uppercase tracking-wide">{label}</p>
      </div>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {sub && (
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{sub}</p>
      )}
      {children}
    </div>
  );
}

function motivation({ streak, week, target, solved, total }) {
  if (total > 0 && solved >= total) return "All problems solved. Legendary.";
  if (streak >= 7) return `${streak}-day streak — unstoppable. Keep shipping.`;
  if (week >= target) return "Weekly goal smashed. Bank the momentum.";
  if (solved === 0) return "Solve your first problem to light the spark.";
  return `${target - week} more to hit this week's goal of ${target}.`;
}

export function OverviewRow({ done, total, solved }) {
  const streak = currentStreak(done);
  const week = solvedThisWeek(done);
  const best = bestDay(done);
  const target = getWeeklyTarget();
  const pct = total > 0 ? Math.round((solved / total) * 100) : 0;

  return (
    <div className="mb-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          icon={<CheckIcon className="h-4 w-4" />}
          label="Total solved"
          value={total == null ? "…" : `${solved}/${total}`}
          sub={total ? `${pct}% complete` : null}
        >
          {total ? <ProgressBar done={solved} total={total} className="mt-2" /> : null}
        </Tile>
        <Tile
          icon={<FlameIcon className="h-4 w-4" />}
          label="Streak"
          value={`${streak}`}
          sub={streak === 1 ? "day in a row" : "days in a row"}
        />
        <Tile
          icon={<ZapIcon className="h-4 w-4" />}
          label="This week"
          value={`${week}`}
          sub={weekRangeLabel()}
        />
        <Tile
          icon={<CalendarIcon className="h-4 w-4" />}
          label="Best day"
          value={best ? `${best.count}` : "—"}
          sub={best ? `${fmtDay(best.day)} · ${best.count} solved` : "no dated solves yet"}
        />
      </div>
      <p className="mt-3 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
        <ZapIcon className="h-4 w-4 shrink-0 text-amber-500" />
        {motivation({ streak, week, target, solved, total: total ?? 0 })}
      </p>
    </div>
  );
}

export function WeeklyGoalCard({ done, total, solved }) {
  const [target, setTarget] = useState(getWeeklyTarget);
  const week = solvedThisWeek(done);
  const pct = target > 0 ? Math.min(100, Math.round((week / target) * 100)) : 0;
  const dt = dailyTarget(target);
  const todayCount = dayCounts(done)[dayKey()] ?? 0;

  const change = (d) => {
    const next = Math.min(100, Math.max(1, target + d));
    setTarget(next);
    setWeeklyTarget(next);
  };

  const remaining = Math.max(0, (total ?? 0) - solved);
  const weeksLeft = target > 0 ? Math.ceil(remaining / target) : null;
  const eta = new Date();
  if (weeksLeft != null) eta.setDate(eta.getDate() + weeksLeft * 7);

  const stepper =
    "rounded-md border border-slate-300 px-2 py-0.5 text-sm hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800";

  return (
    <section className={`${card} h-full`}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <TargetIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          Weekly goal
        </h2>
        <div className="flex items-center gap-1">
          <button onClick={() => change(-1)} className={stepper} aria-label="Decrease weekly goal">
            −
          </button>
          <span className="w-8 text-center font-bold">{target}</span>
          <button onClick={() => change(1)} className={stepper} aria-label="Increase weekly goal">
            +
          </button>
        </div>
      </div>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        {weekRangeLabel()} · questions per week
      </p>
      <p className="mt-3 text-3xl font-bold">
        {week}
        <span className="text-base font-normal text-slate-500 dark:text-slate-400">
          /{target}
        </span>
      </p>
      <ProgressBar done={week} total={target} className="mt-2" />
      <p className="mt-2 flex items-center gap-1.5 text-sm">
        {week >= target ? (
          <span className="flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400">
            <CheckIcon className="h-4 w-4" /> Goal smashed
          </span>
        ) : (
          <span className="text-slate-600 dark:text-slate-300">
            {target - week} more to go
          </span>
        )}
      </p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Today: {todayCount}/{dt}
        {todayCount >= dt
          ? " — daily target smashed"
          : ` — ${dt - todayCount} more to go today`}
      </p>
      {total > 0 && remaining > 0 && (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          At {target}/week → all {total} done in ~{weeksLeft}{" "}
          {weeksLeft === 1 ? "week" : "weeks"} (
          {eta.toLocaleDateString(undefined, { month: "short", year: "numeric" })}
          ).
        </p>
      )}
      {total > 0 && remaining === 0 && (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Everything is solved — raise the bar or start a new list.
        </p>
      )}
    </section>
  );
}

function cellColor(count, future) {
  if (future) return "bg-slate-100 dark:bg-slate-800 opacity-50";
  if (count <= 0) return "bg-slate-100 dark:bg-slate-800";
  if (count <= 2) return "bg-emerald-200 dark:bg-emerald-900";
  if (count <= 4) return "bg-emerald-400 dark:bg-emerald-700";
  return "bg-emerald-600 dark:bg-emerald-500";
}

export function ActivityHeatmap({ done }) {
  const cols = heatmapWeeks(done, 15);
  return (
    <section className={`${card} h-full`}>
      <h2 className="text-lg font-semibold">Activity</h2>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Solves per day · last 15 weeks
      </p>
      <div className="mt-3 grid grid-flow-col grid-rows-7 gap-1 overflow-x-auto pb-1">
        {cols.flatMap((days, w) =>
          days.map((d) => (
            <div
              key={`${w}-${d.key}`}
              title={`${d.label}: ${d.count} solved`}
              className={`h-3 w-3 rounded-[3px] ${cellColor(d.count, d.future)}`}
            />
          ))
        )}
      </div>
      <div className="mt-2 flex items-center justify-end gap-1 text-xs text-slate-500 dark:text-slate-400">
        Less
        <span className="h-3 w-3 rounded-[3px] bg-slate-100 dark:bg-slate-800" />
        <span className="h-3 w-3 rounded-[3px] bg-emerald-200 dark:bg-emerald-900" />
        <span className="h-3 w-3 rounded-[3px] bg-emerald-400 dark:bg-emerald-700" />
        <span className="h-3 w-3 rounded-[3px] bg-emerald-600 dark:bg-emerald-500" />
        More
      </div>
    </section>
  );
}

export function MonthlyPlanCard({ data, done }) {
  const [offset, setOffset] = useState(0);
  const base = new Date();
  const mDate = new Date(base.getFullYear(), base.getMonth() + offset, 1);
  const mKey = monthKey(mDate);
  const [planned, setPlanned] = useState(() => getMonthPlan(monthKey()));

  useEffect(() => {
    setPlanned(getMonthPlan(mKey));
  }, [mKey]);

  const toggle = (slug) => setPlanned(toggleMonthTopic(mKey, slug));
  const label = mDate.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  const stats = TOPICS.map((t) => {
    const rows = data?.[t.slug] ?? [];
    const s = rows.filter((r) => done[r[F.link]]).length;
    return { topic: t, total: rows.length, solved: s };
  });
  const plannedStats = stats.filter((s) => planned.includes(s.topic.slug));
  const complete = plannedStats.filter(
    (s) => s.total > 0 && s.solved >= s.total
  ).length;

  const navBtn =
    "rounded-md border border-slate-300 px-2 py-0.5 text-sm hover:bg-slate-100 disabled:opacity-40 dark:border-slate-600 dark:hover:bg-slate-800";

  return (
    <section className={`${card} mb-6`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <CalendarIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          Monthly plan
        </h2>
        <div className="flex items-center gap-2">
          <button
            disabled={offset <= -12}
            onClick={() => setOffset((o) => o - 1)}
            className={navBtn}
            aria-label="Previous month"
          >
            ‹ Prev
          </button>
          <span className="min-w-36 text-center text-sm font-medium">{label}</span>
          <button
            disabled={offset >= 12}
            onClick={() => setOffset((o) => o + 1)}
            className={navBtn}
            aria-label="Next month"
          >
            Next ›
          </button>
        </div>
      </div>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        {planned.length === 0
          ? `No topics planned for ${label} yet — tick the boxes to plan your month.`
          : `${complete} of ${planned.length} planned topics complete.`}
      </p>
      {!data ? (
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          Loading topics…
        </p>
      ) : (
        <div className="mt-3 grid gap-x-6 sm:grid-cols-2">
          {stats.map(({ topic, total, solved }) => (
            <label
              key={topic.slug}
              className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/60"
            >
              <input
                type="checkbox"
                checked={planned.includes(topic.slug)}
                onChange={() => toggle(topic.slug)}
                className="h-4 w-4 shrink-0 accent-emerald-600"
              />
              <span className="w-40 shrink-0 text-sm font-medium">{topic.name}</span>
              <span className="w-14 shrink-0 text-right text-xs text-slate-500 dark:text-slate-400">
                {solved}/{total}
              </span>
              <ProgressBar done={solved} total={total} className="hidden sm:block" />
            </label>
          ))}
        </div>
      )}
    </section>
  );
}
