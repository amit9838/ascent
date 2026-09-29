import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import HomePage from "./features/home/HomePage.tsx";
import TopicPage from "./features/topics/TopicPage.tsx";
import NotesPage from "./features/notes/NotesPage.tsx";
import SettingsPage from "./features/settings/SettingsPage.tsx";
import TopicsPage from "./features/topics/TopicsPage.tsx";
import ProgressPage from "./features/progress/ProgressPage.tsx";
import { useSolves } from "./lib/entities/solves.ts";
import { useTheme } from "./lib/entities/prefs.ts";
import { useAuth } from "./lib/auth.ts";
import { useCloudSync } from "./lib/cloud/sync.ts";
import Header from "./components/Header.tsx";
import PublicProfilePage from "./features/profile/PublicProfilePage.tsx";
import LeaderboardPage from "./features/leaderboard/LeaderboardPage.tsx";

// HashRouter is required for gh-pages: static hosting has no URL
// rewrites, so deep links only work with hash-based routing.
export default function App() {
  const { solves, ready, toggle, reset, replaceAll } = useSolves();
  useTheme();
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
              element={<SettingsPage solves={solves} onReplace={replaceAll} onReset={reset} user={user} syncStatus={syncStatus} />}
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
