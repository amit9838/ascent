import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { TOPICS } from "../../data/topics.js";
import { loadProblemIndex } from "../../lib/data/problems.js";
import type { Problem, ProblemIndex } from "../../lib/data/problemRows.ts";
import { buildPointsMap, pointsOf } from "../../lib/gamification/points.ts";
import { loadIgnored, pickQuestionOfTheDay, saveIgnored } from "./qotd.js";
import type { QotdCache, QotdPick } from "./qotd.ts";
import { DifficultyBadge, ExternalLink } from "../../components/ui.jsx";
import {
  ActivityHeatmap,
  OverviewRow,
  WeeklyGoalCard,
} from "./dashboard.jsx";
import { RewardsCard } from "./rewards.jsx";
import { ArrowRightIcon, CheckIcon } from "../../components/icons.jsx";

const primaryBtn =
  "rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700";
const ghostBtn =
  "rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200";

function QotdCard({
  qotd,
  solves,
  onToggle,
  dimmed,
  ignored,
  onIgnore,
  onUnignore,
}: {
  qotd: QotdPick;
  solves: Record<string, string>;
  onToggle: (id: string) => void;
  dimmed?: boolean;
  ignored?: boolean;
  onIgnore: () => void;
  onUnignore: () => void;
}) {
  const solved = Boolean(solves[qotd.id]);
  const { problem } = qotd;
  return (
    <section
      className={`mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 ${
        dimmed ? "opacity-60" : ""
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Question of the day &middot; {qotd.dateLabel}
            {ignored && !solved && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium normal-case tracking-normal text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                Ignored
              </span>
            )}
          </p>
          <h2 className="mt-0.5 text-lg font-bold">
            <ExternalLink href={problem.url}>{problem.name}</ExternalLink>
          </h2>
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
            <Link
              to={`/topic/${qotd.topic.slug}`}
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              {qotd.topic.name}
            </Link>
            {" · "}
            <DifficultyBadge level={problem.difficulty} />
            {problem.accuracy ? ` · ${problem.accuracy} accuracy` : ""}
          </p>
          {problem.lcName && (
            <p className="mt-0.5 text-sm">
              <ExternalLink href={problem.lcUrl}>{problem.lcName}</ExternalLink>
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

export default function HomePage({
  solves,
  onToggle,
}: {
  solves: Record<string, string>;
  onToggle: (id: string) => void;
}) {
  const [index, setIndex] = useState<ProblemIndex | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadProblemIndex()
      .then((loaded) => {
        if (!cancelled) setIndex(loaded);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const problemsOf = (slug: string): Problem[] => index?.byTopic.get(slug) ?? [];
  const solvedIn = (problems: Problem[]): number =>
    problems.filter((p) => solves[p.id]).length;
  const total = index?.total ?? 0;
  const solved = index
    ? TOPICS.reduce((count, t) => count + solvedIn(problemsOf(t.slug)), 0)
    : 0;
  const pointsMap = useMemo(() => buildPointsMap(index ?? {}), [index]);
  const totalPoints = useMemo(
    () => Object.values(pointsMap).reduce((a, p) => a + p, 0),
    [pointsMap]
  );
  const solvedPoints = useMemo(
    () =>
      Object.entries(solves).reduce((sum, [problemId]) => sum + pointsOf(pointsMap, problemId), 0),
    [solves, pointsMap]
  );

  const [qotd, setQotd] = useState<QotdPick | null>(null);

  useEffect(() => {
    if (!index) return;
    let cancelled = false;
    const all = TOPICS.flatMap((t) =>
      problemsOf(t.slug).map((problem) => ({ topic: t, problem }))
    );
    if (!all.length) {
      setQotd(null);
      return;
    }
    pickQuestionOfTheDay(all).then((q) => {
      if (!cancelled) setQotd(q);
    });
    return () => {
      cancelled = true;
    };
  }, [index]);

  const [ignored, setIgnored] = useState<QotdCache | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadIgnored().then((v) => {
      if (!cancelled) setIgnored(v);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const isIgnored = Boolean(
    qotd && ignored && ignored.date === qotd.date && ignored.id === qotd.id
  );
  const ignore = async () => {
    if (!qotd) return;
    const entry = { date: qotd.date, id: qotd.id };
    await saveIgnored(entry);
    setIgnored(entry);
  };
  const unignore = async () => {
    await saveIgnored(null);
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

      {qotd && !solves[qotd.id] && !isIgnored && (
        <QotdCard
          qotd={qotd}
          solves={solves}
          onToggle={onToggle}
          ignored={false}
          onIgnore={ignore}
          onUnignore={unignore}
        />
      )}

      <OverviewRow solves={solves} points={pointsMap} total={index ? total : null} solved={solved} />

      <RewardsCard solves={solves} points={pointsMap} />

      <div className="mb-6 grid gap-4 xl:grid-cols-5">
        <div className="xl:col-span-2">
          <WeeklyGoalCard solves={solves} points={pointsMap} total={totalPoints} solved={solvedPoints} />
        </div>
        <div className="xl:col-span-3">
          <ActivityHeatmap solves={solves} points={pointsMap} />
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          Failed to load question data: {error}
        </div>
      )}

      {qotd && (solves[qotd.id] || isIgnored) && (
        <QotdCard
          qotd={qotd}
          solves={solves}
          onToggle={onToggle}
          dimmed
          ignored={isIgnored && !solves[qotd.id]}
          onIgnore={ignore}
          onUnignore={unignore}
        />
      )}


    </div>
  );
}
