import { currentRank, rankLadder } from "../../../lib/gamification/titles.js";
import { CheckIcon, TrophyIcon } from "../../../components/icons.jsx";
import { CARD } from "./card.js";
import { SectionHead } from "./SectionHead.jsx";

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
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
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
