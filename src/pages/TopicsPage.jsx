import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { TOPICS, workatTopicUrl } from "../data/topics.js";
import { loadTopicCsv, F } from "../lib/csv.js";
import { ProgressBar } from "../components/ui.jsx";
import { ArrowRightIcon, ExternalIcon } from "../components/icons.jsx";

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
          {data ? `${solved} of ${total} problems solved` : "Loading progress…"}
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          Failed to load question data: {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TOPICS.map((t, i) => {
          const rows = data?.[t.slug] ?? [];
          const s = solvedIn(rows);
          return (
            <div
              key={t.slug}
              className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-medium text-slate-400">#{i + 1}</p>
                  <h2 className="text-lg font-semibold">{t.name}</h2>
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
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {data ? `${rows.length} problems` : "…"}
              </p>
              <div className="mt-3">
                <ProgressBar done={s} total={rows.length} />
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {s}/{rows.length} solved
                </p>
              </div>
              <Link
                to={`/topic/${t.slug}`}
                className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-center text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
              >
                Open questions <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
