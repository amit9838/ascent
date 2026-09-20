import {
  bestDay,
  currentStreak,
  dayCounts,
  dayKey,
  heatmapWeeks,
  solvedThisWeek,
  weekRangeLabel,
} from "../lib/activity.js";
import { getWeeklyTarget } from "../lib/plans.js";
import { dailyTarget } from "../lib/rewards.js";
import {
  CalendarIcon,
  CheckIcon,
  FlameIcon,
  TargetIcon,
  ZapIcon,
} from "./icons.jsx";
import { Link } from "react-router-dom";
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
  if (total > 0 && solved >= total) return "All problems solved. The crown is yours.";
  if (streak >= 7) return `${streak}-day streak — keep shining.`;
  if (week >= target) return "Weekly goal smashed. Bank the momentum.";
  if (solved === 0) return "Solve your first problem to light the spark.";
  return `${target - week} more to hit this week's goal of ${target}.`;
}

export function OverviewRow({ done, total, solved }) {
  const streak = currentStreak(done);
  const week = solvedThisWeek(done);
  const best = bestDay(done);
  const target = getWeeklyTarget();

  return (
    <div className="mb-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
  const target = getWeeklyTarget();
  const week = solvedThisWeek(done);
  const pct = target > 0 ? Math.min(100, Math.round((week / target) * 100)) : 0;
  const dt = dailyTarget(target);
  const todayCount = dayCounts(done)[dayKey()] ?? 0;

  const remaining = Math.max(0, (total ?? 0) - solved);
  const weeksLeft = target > 0 ? Math.ceil(remaining / target) : null;
  const eta = new Date();
  if (weeksLeft != null) eta.setDate(eta.getDate() + weeksLeft * 7);

  return (
    <section className={`${card} h-full`}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <TargetIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          Weekly goal
        </h2>
        <Link
          to="/profile"
          className="text-xs text-blue-600 hover:underline dark:text-blue-400"
        >
          Change in Profile
        </Link>
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


