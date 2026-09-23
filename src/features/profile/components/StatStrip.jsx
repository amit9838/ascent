import {
  CheckIcon,
  FlameIcon,
  TrophyIcon,
  ZapIcon,
} from "../../../components/icons.jsx";

// Icon + value stat tiles — no totals, no floating boxes.
export function StatStrip({ summary: s, className = "" }) {
  const items = [
    {
      icon: CheckIcon,
      label: "Solved",
      value: `${s.solved ?? 0}`,
      tone: "text-emerald-600 bg-emerald-500/15 dark:text-emerald-400",
    },
    {
      icon: ZapIcon,
      label: "Points",
      value: `${s.points ?? 0}`,
      tone: "text-amber-600 bg-amber-500/15 dark:text-amber-400",
    },
    {
      icon: FlameIcon,
      label: "Streak",
      value: `${s.streak ?? 0}`,
      tone: "text-orange-600 bg-orange-500/15 dark:text-orange-400",
    },
    {
      icon: TrophyIcon,
      label: "Rank",
      value: `${s.rank ?? "—"}`,
      tone: "text-amber-500 bg-amber-500/15",
    },
  ];
  return (
    <div className={`grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4 sm:gap-x-6 ${className}`}>
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-2.5 min-w-0">
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${it.tone}`}
          >
            <it.icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-base font-bold tabular-nums leading-tight text-slate-900 dark:text-white sm:text-lg">
              {it.value}
            </p>
            <p className="truncate text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {it.label}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
