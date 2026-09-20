export function ProgressBar({ done, total, className = "" }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700 ${className}`}>
      <div
        className="h-full rounded-full bg-emerald-500 transition-all duration-300"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

const DIFF_STYLES = {
  easy: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  hard: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
};

export function DifficultyBadge({ level }) {
  const key = (level || "").toLowerCase();
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
        DIFF_STYLES[key] ?? "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
      }`}
    >
      {level}
    </span>
  );
}

export function ExternalLink({ href, children }) {
  if (!href) return <span className="text-slate-400">–</span>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-blue-600 hover:underline dark:text-blue-400"
    >
      {children}
    </a>
  );
}

export function ThemeToggle({ theme, onToggle }) {
  const dark = theme === "dark";
  return (
    <button
      onClick={onToggle}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      className="rounded-lg border border-slate-300 p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
    >
      {dark ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="h-5 w-5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
          />
        </svg>
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="h-5 w-5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21.752 15.002A9.72 9.72 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0012 21.75a9.753 9.753 0 009.752-6.748z"
          />
        </svg>
      )}
    </button>
  );
}
