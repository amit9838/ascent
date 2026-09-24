import { useEffect, useState } from "react";
import type { ComponentType } from "react";
import type { User } from "firebase/auth";
import { Link, useLocation } from "react-router-dom";
import AuthMenu from "./AuthMenu.jsx";
import type { SyncStatus } from "../lib/cloud/sync/engine.ts";
import {
  ChartIcon,
  ChevronsUpIcon,
  GridIcon,
  MenuIcon,
  NotesIcon,
  SettingsIcon,
  TrophyIcon,
  XIcon,
} from "./icons.jsx";

interface HeaderLink {
  to: string;
  label: string;
  Icon: ComponentType<{ className?: string }>;
}

const LINKS: HeaderLink[] = [
  { to: "/notes", label: "Notes", Icon: NotesIcon },
  { to: "/topics", label: "Topics", Icon: GridIcon },
  { to: "/progress", label: "Progress", Icon: ChartIcon },
  { to: "/leaderboard", label: "Leaderboard", Icon: TrophyIcon },
  { to: "/settings", label: "Settings", Icon: SettingsIcon },
];

const navLink =
  "flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100";

export default function Header({
  user,
  status,
}: {
  user: User | null;
  status: SyncStatus;
}) {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  // Close the drawer on navigation and on Escape; lock scroll while open.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <header className="relative z-40 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-5">
            <Link
              to="/"
              className="flex items-center gap-2 text-lg font-bold tracking-tight"
            >
              <span className="rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 p-1.5 text-white shadow-sm">
                <ChevronsUpIcon className="h-4 w-4" />
              </span>
              Ascent
            </Link>
            <Link to="/notes" className={`${navLink} hidden md:flex`}>
              <NotesIcon className="h-4 w-4" />
              Notes
            </Link>
          </div>

          <div className="flex items-center gap-1 sm:gap-4">
            <nav className="hidden items-center gap-4 md:flex">
              {LINKS.slice(1).map(({ to, label, Icon }) => (
                <Link key={to} to={to} className={navLink}>
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              ))}
            </nav>
            <AuthMenu user={user} status={status} />
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              className="rounded-lg border border-slate-300 p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 md:hidden dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            >
              {open ? (
                <XIcon className="h-5 w-5" />
              ) : (
                <MenuIcon className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <nav className="absolute right-0 top-0 flex h-full w-72 max-w-[85vw] flex-col overflow-y-auto bg-white p-4 shadow-2xl dark:bg-slate-900">
            <div className="mb-2 flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Menu
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-col gap-1">
              {LINKS.map(({ to, label, Icon }) => {
                const active =
                  pathname === to || (to !== "/" && pathname.startsWith(`${to}/`));
                return (
                  <Link
                    key={to}
                    to={to}
                    className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${
                      active
                        ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                        : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                    }`}
                  >
                    <Icon
                      className={`h-5 w-5 ${
                        active
                          ? "text-blue-600 dark:text-blue-400"
                          : "text-slate-400 dark:text-slate-500"
                      }`}
                    />
                    {label}
                  </Link>
                );
              })}
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
