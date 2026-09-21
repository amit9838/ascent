import { HashRouter, Routes, Route, Navigate, Link } from "react-router-dom";
import HomePage from "./pages/HomePage.jsx";
import TopicPage from "./pages/TopicPage.jsx";
import NotesPage from "./pages/NotesPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";
import TopicsPage from "./pages/TopicsPage.jsx";
import ProgressPage from "./pages/ProgressPage.jsx";
import { useProgress } from "./lib/progress.js";
import { useTheme } from "./lib/theme.js";
import { ChartIcon, ChevronsUpIcon, GridIcon, NotesIcon, SettingsIcon } from "./components/icons.jsx";

// HashRouter is required for gh-pages: static hosting has no URL
// rewrites, so deep links only work with hash-based routing.
export default function App() {
  const { done, toggle, reset, replaceAll } = useProgress();
  const { theme, setTheme } = useTheme();

  return (
    <HashRouter>
      <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
            <div className="flex items-center gap-5">
              <Link to="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
              <span className="rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 p-1.5 text-white shadow-sm">
                <ChevronsUpIcon className="h-4 w-4" />
              </span>
                Ascent
              </Link>
              <Link to="/notes" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100">
                <NotesIcon className="h-4 w-4" />
                Notes
              </Link>
            </div>
            <nav className="flex flex-wrap items-center justify-end gap-4">
              <Link to="/topics" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100">
                <GridIcon className="h-4 w-4" />
                Topics
              </Link>
              <Link to="/progress" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100">
                <ChartIcon className="h-4 w-4" />
                Progress
              </Link>
              <Link to="/settings" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100">
                <SettingsIcon className="h-4 w-4" />
                Settings
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6">
          <Routes>
            <Route path="/" element={<HomePage done={done} onToggle={toggle} />} />
            <Route path="/topic/:slug" element={<TopicPage done={done} onToggle={toggle} />} />
            <Route path="/notes" element={<NotesPage />} />
            <Route
              path="/settings"
              element={<SettingsPage done={done} onReplace={replaceAll} onReset={reset} theme={theme} setTheme={setTheme} />}
            />
            <Route path="/topics" element={<TopicsPage done={done} />} />
            <Route path="/progress" element={<ProgressPage done={done} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
}
