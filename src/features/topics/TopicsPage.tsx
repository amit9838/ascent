import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { TOPICS, workatTopicUrl } from "../../data/topics.ts";
import { loadProblemIndex } from "../../lib/data/problems.ts";
import type { Problem, ProblemIndex } from "../../lib/data/problemRows.ts";
import { DifficultyBar, ProgressBar } from "../../components/ui.tsx";
import type { DifficultyMix } from "../../components/ui.tsx";
import {
  ArrowRightIcon,
  ExternalIcon,
  GridIcon,
  ListIcon,
} from "../../components/icons.tsx";
import { useTopicsView } from "../../lib/entities/prefs.ts";
import { useSeo } from "../../lib/seo.ts";

export default function TopicsPage({ solves }: { solves: Record<string, string> }) {
  const [index, setIndex] = useState<ProblemIndex | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { view, setView } = useTopicsView();
  useSeo({
    title: "Topics — Ascent",
    description:
      "Browse every DSA topic on Ascent — arrays, graphs, dynamic programming, trees and more — with solved counts, difficulty mix and progress.",
  });

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

  const viewBtn = (active: boolean) =>
    `rounded-md p-1.5 transition ${
      active
        ? "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100"
        : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
    }`;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Topics</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {index
              ? `${solved} of ${total} problems solved · ${Math.round((solved / total) * 100)}%`
              : "Loading progress…"}
          </p>
          {index && total > 0 && (
            <div className="mt-3 max-w-md">
              <ProgressBar done={solved} total={total} />
            </div>
          )}
        </div>
        <div
          className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-300 p-1 dark:border-slate-700"
          role="group"
          aria-label="Topics view"
        >
          <button
            type="button"
            onClick={() => setView("grid")}
            title="Grid view"
            aria-label="Grid view"
            aria-pressed={view === "grid"}
            className={viewBtn(view === "grid")}
          >
            <GridIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setView("list")}
            title="List view"
            aria-label="List view"
            aria-pressed={view === "list"}
            className={viewBtn(view === "list")}
          >
            <ListIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          Failed to load question data: {error}
        </div>
      )}

      <div
        className={
          view === "grid"
            ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            : "flex flex-col gap-2"
        }
      >
        {TOPICS.map((t) => {
          const problems = problemsOf(t.slug);
          const s = solvedIn(problems);
          const Icon = t.icon;
          const complete = problems.length > 0 && s >= problems.length;
          const mix: DifficultyMix = { easy: 0, medium: 0, hard: 0 };
          for (const problem of problems) {
            const d = problem.difficulty;
            if (d === "easy" || d === "medium" || d === "hard") mix[d]++;
          }
          const pct = problems.length ? Math.round((s / problems.length) * 100) : 0;
          const border = complete
            ? "border-emerald-400 dark:border-emerald-700"
            : "border-slate-200 dark:border-slate-700";

          if (view === "list") {
            return (
              <div
                key={t.slug}
                className={`flex items-center justify-between gap-3 rounded-xl border bg-white px-4 py-2.5 shadow-sm transition hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800/60 ${border}`}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3 sm:hidden">
                  <span className={`shrink-0 rounded-lg p-1.5 ${t.chip}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold" title={t.name}>
                      {t.name}
                    </p>
                    <p
                      className={`mt-1 truncate text-xs font-medium tabular-nums ${
                        complete
                          ? "text-emerald-700 dark:text-emerald-400"
                          : "text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      {s}/{problems.length} · {pct}%
                    </p>
                  </div>
                </div>
                <div className="hidden min-w-0 flex-1 items-center gap-3 sm:flex">
                  <span className={`shrink-0 rounded-lg p-1.5 ${t.chip}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 shrink-0 sm:w-44">
                    <p className="truncate text-sm font-semibold" title={t.name}>
                      {t.name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {complete ? (
                        <span className="font-medium text-emerald-700 dark:text-emerald-400">
                          Completed · {s}/{problems.length}
                        </span>
                      ) : (
                        <span>
                          {s}/{problems.length} solved · {pct}%
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="hidden min-w-0 flex-1 sm:block">
                    <ProgressBar done={s} total={problems.length} />
                  </div>
                  <DifficultyBar
                    mix={mix}
                    total={problems.length}
                    className="hidden w-24 shrink-0 md:block"
                  />
                </div>
                <div className="flex shrink-0 items-center gap-2.5">
                  <a
                    href={workatTopicUrl(t.slug)}
                    target="_blank"
                    rel="noreferrer"
                    title="Open on workat.tech"
                    className="shrink-0 text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                  >
                    <ExternalIcon className="h-4 w-4" />
                  </a>
                  <Link
                    to={`/topic/${t.slug}`}
                    className="flex shrink-0 items-center gap-1 text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                  >
                    Open <ArrowRightIcon className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            );
          }

          return (
            <div key={t.slug} className={`rounded-xl border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:bg-slate-900 ${border}`}>
              <div className="flex items-center gap-3">
                <span className={`shrink-0 rounded-lg p-2 ${t.chip}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-base font-semibold" title={t.name}>
                    {t.name}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {complete ? (
                      <span className="font-medium text-emerald-700 dark:text-emerald-400">
                        Completed · {s}/{problems.length}
                      </span>
                    ) : (
                      <span>
                        {s}/{problems.length} solved · {pct}%
                      </span>
                    )}
                  </p>
                </div>
                <a
                  href={workatTopicUrl(t.slug)}
                  target="_blank"
                  rel="noreferrer"
                  title="Open on workat.tech"
                  className="shrink-0 text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                >
                  <ExternalIcon className="h-4 w-4" />
                </a>
              </div>
              <div className="mt-3">
                <ProgressBar done={s} total={problems.length} />
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <DifficultyBar mix={mix} total={problems.length} className="w-[30%]" />
                <Link
                  to={`/topic/${t.slug}`}
                  className="flex shrink-0 items-center gap-1 text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  Open <ArrowRightIcon className="h-4 w-4" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
