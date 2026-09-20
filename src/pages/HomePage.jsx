import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { TOPICS } from "../data/topics.js";
import { loadTopicCsv, F } from "../lib/csv.js";
import { pickQuestionOfTheDay } from "../lib/qotd.js";
import { DifficultyBadge, ExternalLink } from "../components/ui.jsx";
import {
  ActivityHeatmap,
  OverviewRow,
  WeeklyGoalCard,
} from "../components/dashboard.jsx";
import { RewardsCard } from "../components/rewards.jsx";
import { CheckIcon, ZapIcon } from "../components/icons.jsx";

function QotdCard({ qotd, done, onToggle, dimmed }) {
  return (
    <section
      className={`mb-6 rounded-xl border border-amber-200 bg-amber-50 p-5 shadow-sm dark:border-amber-900 dark:bg-amber-950/50 ${
        dimmed ? "opacity-60" : ""
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
            <ZapIcon className="h-4 w-4" />
            Question of the day &middot; {qotd.dateLabel}
          </p>
          <h2 className="mt-1 text-xl font-bold">
            <ExternalLink href={qotd.row[F.link]}>{qotd.row[F.name]}</ExternalLink>
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            <Link
              to={`/topic/${qotd.topic.slug}`}
              className="text-blue-600 hover:underline"
            >
              {qotd.topic.name}
            </Link>
            {" · "}
            <DifficultyBadge level={qotd.row[F.difficulty]} />
            {qotd.row[F.accuracy] ? ` · ${qotd.row[F.accuracy]} accuracy` : ""}
          </p>
          {qotd.row[F.lc] && (
            <p className="mt-1 text-sm">
              <ExternalLink href={qotd.row[F.lcLink]}>{qotd.row[F.lc]}</ExternalLink>
            </p>
          )}
        </div>
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800">
          <input
            type="checkbox"
            checked={Boolean(done[qotd.id])}
            onChange={() => onToggle(qotd.id)}
            className="h-4 w-4 accent-emerald-600"
          />
          {done[qotd.id] ? (
            <span className="flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400">
              <CheckIcon className="h-4 w-4" /> Solved
            </span>
          ) : (
            "Mark done"
          )}
        </label>
      </div>
    </section>
  );
}

export default function HomePage({ done, onToggle }) {
  const [data, setData] = useState(null); // { slug: rows[] }
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      TOPICS.map((t) => loadTopicCsv(t.csv).then((rows) => [t.slug, rows]))
    )
      .then((entries) => {
        if (!cancelled) setData(Object.fromEntries(entries));
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const solvedIn = (rows) => rows.filter((r) => done[r[F.link]]).length;
  const total = data ? Object.values(data).reduce((a, rows) => a + rows.length, 0) : 0;
  const solved = data
    ? TOPICS.reduce((a, t) => a + solvedIn(data[t.slug] ?? []), 0)
    : 0;

  const qotd = useMemo(() => {
    if (!data) return null;
    const all = TOPICS.flatMap((t) =>
      (data[t.slug] ?? []).map((row) => ({ topic: t, row }))
    );
    return all.length ? pickQuestionOfTheDay(all) : null;
  }, [data]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Track your DSA grind across all topics.
        </p>
      </div>

      {qotd && !done[qotd.id] && (
        <QotdCard qotd={qotd} done={done} onToggle={onToggle} />
      )}

      <OverviewRow done={done} total={data ? total : null} solved={solved} />

      <RewardsCard done={done} />

      <div className="mb-6 grid gap-4 xl:grid-cols-5">
        <div className="xl:col-span-2">
          <WeeklyGoalCard done={done} total={data ? total : 0} solved={solved} />
        </div>
        <div className="xl:col-span-3">
          <ActivityHeatmap done={done} />
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          Failed to load question data: {error}
        </div>
      )}

      {qotd && done[qotd.id] && (
        <QotdCard qotd={qotd} done={done} onToggle={onToggle} dimmed />
      )}


    </div>
  );
}
