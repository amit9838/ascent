import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getTopic, workatTopicUrl } from "../../data/topics.js";
import { loadTopicCsv, F } from "../../lib/csv.js";
import { DifficultyBadge, ExternalLink, ProgressBar } from "../../components/ui.jsx";
import { BackIcon, ExternalIcon, SearchIcon } from "../../components/icons.jsx";

export default function TopicPage({ done, onToggle }) {
  const { slug } = useParams();
  const topic = getTopic(slug);

  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const [difficulty, setDifficulty] = useState("all");
  const [hideDone, setHideDone] = useState(false);

  useEffect(() => {
    if (!topic) return;
    let cancelled = false;
    setRows(null);
    setError(null);
    loadTopicCsv(topic.csv)
      .then((r) => {
        if (!cancelled) setRows(r);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (difficulty !== "all" && (r[F.difficulty] || "").toLowerCase() !== difficulty)
        return false;
      if (hideDone && done[r[F.link]]) return false;
      if (!q) return true;
      return [r[F.name], r[F.companies], r[F.lc], r[F.notes]]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [rows, query, difficulty, hideDone, done]);

  if (!topic) {
    return (
      <div>
        <p className="text-lg font-semibold">Unknown topic: {slug}</p>
        <Link to="/" className="mt-2 inline-flex items-center gap-1.5 text-blue-600 hover:underline dark:text-blue-400">
          <BackIcon className="h-4 w-4" /> Back to topics
        </Link>
      </div>
    );
  }

  const solved = rows ? rows.filter((r) => done[r[F.link]]).length : 0;

  return (
    <div>
      <Link to="/" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100">
        <BackIcon className="h-4 w-4" /> All topics
      </Link>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{topic.name}</h1>
          <a
            href={workatTopicUrl(topic.slug)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline dark:text-blue-400"
          >
            Practice on workat.tech <ExternalIcon className="h-3.5 w-3.5" />
          </a>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {rows ? `${solved}/${rows.length} solved` : "Loading…"}
        </p>
      </div>
      {rows && (
        <div className="mt-3">
          <ProgressBar done={solved} total={rows.length} />
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="relative w-64 max-w-full">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search problems, companies…"
            className="w-full rounded-lg border border-slate-300 bg-white py-1.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
        </div>
        <select
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        >
          <option value="all">All difficulties</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <input
            type="checkbox"
            checked={hideDone}
            onChange={(e) => setHideDone(e.target.checked)}
            className="h-4 w-4 accent-emerald-600"
          />
          Hide completed
        </label>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          Failed to load question data: {error}
        </div>
      )}

      {rows && filtered.length === 0 && (
        <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">
          No questions match the current filters.
        </p>
      )}

      {rows && filtered.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                <th className="px-3 py-2">Done</th>
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Problem</th>
                <th className="px-3 py-2">Score</th>
                <th className="px-3 py-2">Accuracy</th>
                <th className="px-3 py-2">Difficulty</th>
                <th className="px-3 py-2">Companies</th>
                <th className="px-3 py-2">LeetCode</th>
                <th className="px-3 py-2">Other</th>
                <th className="px-3 py-2">Notes</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const id = r[F.link];
                const checked = Boolean(done[id]);
                return (
                  <tr
                    key={id || r[F.num]}
                    className={`border-b border-slate-100 last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60 ${
                      checked ? "bg-emerald-50/60 dark:bg-emerald-950/40" : ""
                    }`}
                  >
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => onToggle(id)}
                        title={checked ? "Mark as not done" : "Mark as done"}
                        className="h-4 w-4 cursor-pointer accent-emerald-600"
                      />
                    </td>
                    <td className="px-3 py-2 text-slate-500">{r[F.num]}</td>
                    <td className="px-3 py-2 font-medium">
                      <ExternalLink href={r[F.link]}>{r[F.name]}</ExternalLink>
                    </td>
                    <td className="px-3 py-2">{r[F.score]}</td>
                    <td className="px-3 py-2">{r[F.accuracy]}</td>
                    <td className="px-3 py-2">
                      <DifficultyBadge level={r[F.difficulty]} />
                    </td>
                    <td className="max-w-[220px] px-3 py-2 text-slate-600 dark:text-slate-300">
                      {r[F.companies] || "–"}
                    </td>
                    <td className="max-w-[220px] px-3 py-2">
                      <ExternalLink href={r[F.lcLink]}>{r[F.lc]}</ExternalLink>
                    </td>
                    <td className="max-w-[220px] px-3 py-2">
                      <ExternalLink href={r[F.otherLink]}>{r[F.other]}</ExternalLink>
                    </td>
                    <td className="max-w-[280px] px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                      {r[F.notes]}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
