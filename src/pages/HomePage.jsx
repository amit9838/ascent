import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { TOPICS } from "../data/topics.js";
import { loadTopicCsv, F } from "../lib/csv.js";
import { buildPointsMap, pointsOf } from "../lib/points.js";
import { loadIgnored, pickQuestionOfTheDay, saveIgnored } from "../lib/qotd.js";
import { DifficultyBadge, ExternalLink } from "../components/ui.jsx";
import {
  ActivityHeatmap,
  OverviewRow,
  WeeklyGoalCard,
} from "../components/dashboard.jsx";
import { RewardsCard } from "../components/rewards.jsx";
import { ArrowRightIcon, CheckIcon, ZapIcon } from "../components/icons.jsx";

const primaryBtn =
  "rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700";
const ghostBtn =
  "rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200";

function QotdCard({ qotd, done, onToggle, dimmed, ignored, onIgnore, onUnignore }) {
  const solved = Boolean(done[qotd.id]);
  return (
    <section
      className={`mb-6 rounded-xl border border-slate-200 border-l-4 border-l-emerald-500 bg-white p-4 shadow-sm dark:border-slate-700 dark:border-l-emerald-500 dark:bg-slate-900 ${
        dimmed ? "opacity-60" : ""
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <ZapIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            Question of the day &middot; {qotd.dateLabel}
            {ignored && !solved && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium normal-case tracking-normal text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                Ignored
              </span>
            )}
          </p>
          <h2 className="mt-0.5 text-lg font-bold">
            <ExternalLink href={qotd.row[F.link]}>{qotd.row[F.name]}</ExternalLink>
          </h2>
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
            <Link
              to={`/topic/${qotd.topic.slug}`}
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              {qotd.topic.name}
            </Link>
            {" · "}
            <DifficultyBadge level={qotd.row[F.difficulty]} />
            {qotd.row[F.accuracy] ? ` · ${qotd.row[F.accuracy]} accuracy` : ""}
          </p>
          {qotd.row[F.lc] && (
            <p className="mt-0.5 text-sm">
              <ExternalLink href={qotd.row[F.lcLink]}>{qotd.row[F.lc]}</ExternalLink>
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {solved ? (
            <>
              <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                <CheckIcon className="h-4 w-4" /> Solved
              </span>
              <button onClick={() => onToggle(qotd.id)} className={ghostBtn}>
                Undo
              </button>
            </>
          ) : (
            <>
              <button onClick={() => onToggle(qotd.id)} className={primaryBtn}>
                Mark done
              </button>
              {ignored ? (
                <button onClick={onUnignore} className={ghostBtn}>
                  Unignore
                </button>
              ) : (
                <button onClick={onIgnore} className={ghostBtn}>
                  Ignore
                </button>
              )}
            </>
          )}
        </div>
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
  const pointsMap = useMemo(() => buildPointsMap(data), [data]);
  const totalPoints = useMemo(
    () => Object.values(pointsMap).reduce((a, p) => a + p, 0),
    [pointsMap]
  );
  const solvedPoints = useMemo(
    () =>
      Object.entries(done).reduce((a, [url]) => a + pointsOf(pointsMap, url), 0),
    [done, pointsMap]
  );

  const qotd = useMemo(() => {
    if (!data) return null;
    const all = TOPICS.flatMap((t) =>
      (data[t.slug] ?? []).map((row) => ({ topic: t, row }))
    );
    return all.length ? pickQuestionOfTheDay(all) : null;
  }, [data]);

  const [ignored, setIgnored] = useState(loadIgnored);
  const isIgnored = Boolean(
    qotd && ignored && ignored.date === qotd.date && ignored.id === qotd.id
  );
  const ignore = () => {
    if (!qotd) return;
    const entry = { date: qotd.date, id: qotd.id };
    saveIgnored(entry);
    setIgnored(entry);
  };
  const unignore = () => {
    saveIgnored(null);
    setIgnored(null);
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Track your DSA grind across all topics.
          </p>
        </div>
        <Link
          to={"/topics"}
          className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
        >
          Practice now <ArrowRightIcon className="h-4 w-4" />
        </Link>
      </div>

      {qotd && !done[qotd.id] && !isIgnored && (
        <QotdCard
          qotd={qotd}
          done={done}
          onToggle={onToggle}
          ignored={false}
          onIgnore={ignore}
          onUnignore={unignore}
        />
      )}

      <OverviewRow done={done} points={pointsMap} total={data ? total : null} solved={solved} />

      <RewardsCard done={done} points={pointsMap} />

      <div className="mb-6 grid gap-4 xl:grid-cols-5">
        <div className="xl:col-span-2">
          <WeeklyGoalCard done={done} points={pointsMap} total={totalPoints} solved={solvedPoints} />
        </div>
        <div className="xl:col-span-3">
          <ActivityHeatmap done={done} points={pointsMap} />
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          Failed to load question data: {error}
        </div>
      )}

      {qotd && (done[qotd.id] || isIgnored) && (
        <QotdCard
          qotd={qotd}
          done={done}
          onToggle={onToggle}
          dimmed
          ignored={isIgnored && !done[qotd.id]}
          onIgnore={ignore}
          onUnignore={unignore}
        />
      )}


    </div>
  );
}
