import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import HomePage from "./features/home/HomePage.jsx";
import TopicPage from "./features/topics/TopicPage.jsx";
import NotesPage from "./features/notes/NotesPage.jsx";
import SettingsPage from "./features/settings/SettingsPage.jsx";
import TopicsPage from "./features/topics/TopicsPage.jsx";
import ProgressPage from "./features/progress/ProgressPage.jsx";
import { useSolves } from "./lib/entities/solves.ts";
import { useTheme } from "./lib/entities/prefs.ts";
import { useAuth } from "./lib/auth.js";
import { useCloudSync } from "./lib/cloud/sync.ts";
import Header from "./components/Header.jsx";
import PublicProfilePage from "./features/profile/PublicProfilePage.jsx";
import LeaderboardPage from "./features/leaderboard/LeaderboardPage.jsx";

// HashRouter is required for gh-pages: static hosting has no URL
// rewrites, so deep links only work with hash-based routing.
export default function App() {
  const { solves, ready, toggle, reset, replaceAll } = useSolves();
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();
  const { status: syncStatus } = useCloudSync(user);

  return (
    <HashRouter>
      <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <Header user={user} status={syncStatus} />
        <main className="mx-auto max-w-7xl px-4 py-6">
          {!ready || solves === null ? (
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
              Loading your progress…
            </p>
          ) : (
          <Routes>
            <Route path="/" element={<HomePage solves={solves} onToggle={toggle} />} />
            <Route path="/topic/:slug" element={<TopicPage solves={solves} onToggle={toggle} />} />
            <Route path="/notes" element={<NotesPage />} />
            <Route
              path="/settings"
              element={<SettingsPage solves={solves} onReplace={replaceAll} onReset={reset} theme={theme} setTheme={setTheme} user={user} syncStatus={syncStatus} />}
            />
            <Route path="/topics" element={<TopicsPage solves={solves} />} />
            <Route path="/progress" element={<ProgressPage solves={solves} />} />
            <Route path="/leaderboard" element={<LeaderboardPage user={user} />} />
            <Route path="/u/:uid" element={<PublicProfilePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          )}
        </main>
      </div>
    </HashRouter>
  );
}
