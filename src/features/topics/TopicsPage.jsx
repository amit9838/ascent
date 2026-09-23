import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { TOPICS, workatTopicUrl } from "../../data/topics.js";
import { loadTopicCsv, F } from "../../lib/csv.js";
import { ProgressBar } from "../../components/ui.jsx";
import { ArrowRightIcon, ExternalIcon } from "../../components/icons.jsx";

export default function TopicsPage({ done }) {
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

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Topics</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {data
            ? `${solved} of ${total} problems solved · ${Math.round((solved / total) * 100)}%`
            : "Loading progress…"}
        </p>
        {data && total > 0 && (
          <div className="mt-3 max-w-md">
            <ProgressBar done={solved} total={total} />
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          Failed to load question data: {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TOPICS.map((t) => {
          const rows = data?.[t.slug] ?? [];
          const s = solvedIn(rows);
          const Icon = t.icon;
          const complete = rows.length > 0 && s >= rows.length;
          const diffs = { easy: 0, medium: 0, hard: 0 };
          for (const r of rows) {
            const d = (r[F.difficulty] || "").toLowerCase();
            if (d in diffs) diffs[d]++;
          }
          const pct = rows.length ? Math.round((s / rows.length) * 100) : 0;
          return (
            <div
              key={t.slug}
              className={`rounded-xl border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:bg-slate-900 ${
                complete
                  ? "border-emerald-400 dark:border-emerald-700"
                  : "border-slate-200 dark:border-slate-700"
              }`}
            >
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
                        Completed · {s}/{rows.length}
                      </span>
                    ) : (
                      <span>
                        {s}/{rows.length} solved · {pct}%
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
                <ProgressBar done={s} total={rows.length} />
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                {rows.length > 0 && (
                  <div
                    className="flex h-2 w-[30%] overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
                    title={`${diffs.easy} easy · ${diffs.medium} medium · ${diffs.hard} hard`}
                  >
                    <div
                      className="h-full bg-emerald-500/70"
                      style={{ width: `${(diffs.easy / rows.length) * 100}%` }}
                    />
                    <div
                      className="h-full bg-amber-500/70"
                      style={{ width: `${(diffs.medium / rows.length) * 100}%` }}
                    />
                    <div
                      className="h-full bg-rose-500/70"
                      style={{ width: `${(diffs.hard / rows.length) * 100}%` }}
                    />
                  </div>
                )}
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
