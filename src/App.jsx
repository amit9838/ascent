import { HashRouter, Routes, Route, Navigate, Link } from "react-router-dom";
import HomePage from "./pages/HomePage.jsx";
import TopicPage from "./pages/TopicPage.jsx";
import NotesPage from "./pages/NotesPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";
import TopicsPage from "./pages/TopicsPage.jsx";
import ProfilePage from "./pages/ProfilePage.jsx";
import { useProgress } from "./lib/progress.js";
import { useTheme } from "./lib/theme.js";
import { ThemeToggle } from "./components/ui.jsx";
import { CodeIcon, ExternalIcon, GridIcon, NotesIcon, SettingsIcon, UserIcon } from "./components/icons.jsx";

// HashRouter is required for gh-pages: static hosting has no URL
// rewrites, so deep links only work with hash-based routing.
export default function App() {
  const { done, toggle, reset, replaceAll } = useProgress();
  const { theme, toggleTheme } = useTheme();

  return (
    <HashRouter>
      <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
            <Link to="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
              <span className="rounded-lg bg-slate-900 p-1.5 text-white dark:bg-slate-100 dark:text-slate-900">
                <CodeIcon className="h-4 w-4" />
              </span>
              DSA Tracker
            </Link>
            <nav className="flex flex-wrap items-center justify-end gap-4">
              <Link to="/topics" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100">
                <GridIcon className="h-4 w-4" />
                Topics
              </Link>
              <Link to="/notes" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100">
                <NotesIcon className="h-4 w-4" />
                Notes
              </Link>
              <Link to="/settings" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100">
                <SettingsIcon className="h-4 w-4" />
                Settings
              </Link>
              <Link to="/profile" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100">
                <UserIcon className="h-4 w-4" />
                Profile
              </Link>
              <a
                href="https://workat.tech/problem-solving/practice/topics/index.html"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              >
                workat.tech <ExternalIcon className="h-3.5 w-3.5" />
              </a>
              <ThemeToggle theme={theme} onToggle={toggleTheme} />
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
              element={<SettingsPage done={done} onReplace={replaceAll} onReset={reset} />}
            />
            <Route path="/topics" element={<TopicsPage done={done} />} />
            <Route path="/profile" element={<ProfilePage done={done} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
}
