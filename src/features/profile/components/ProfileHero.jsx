import { StatStrip } from "./StatStrip.jsx";

// Premium header: solid card surface (white / slate-900), ringed avatar,
// identity, CTA slot — with icon stat tiles at the bottom.
export function ProfileHero({ profile, summary, subtitle, actions, badge }) {
  const s = summary;
  return (
    <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:shadow-xl dark:shadow-slate-900/10">
      <div className="relative p-4 sm:p-7">
        {/* Stack on mobile (name + full-width CTA), side-by-side from sm up */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
          <div className="flex min-w-0 flex-1 items-center gap-4 sm:gap-5">
            <div className="shrink-0 rounded-full bg-gradient-to-br from-blue-400 via-indigo-400 to-violet-400 p-[3px]">
              {profile.photoURL ? (
                <img
                  src={profile.photoURL}
                  alt=""
                  className="h-16 w-16 rounded-full border-2 border-white bg-slate-800 object-cover dark:border-slate-900 sm:h-24 sm:w-24"
                />
              ) : (
                <span className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-white bg-gradient-to-br from-blue-500 to-indigo-600 text-2xl font-bold text-white dark:border-slate-900 sm:h-24 sm:w-24 sm:text-3xl">
                  {(profile.displayName ?? "S").slice(0, 1).toUpperCase()}
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="min-w-0 truncate text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                  {profile.displayName ?? "Solver"}
                </h1>
                {badge}
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 sm:text-sm">{subtitle}</p>
            </div>
          </div>

          <div className="flex w-full shrink-0 flex-col items-stretch gap-2 sm:w-auto">
            {actions}
          </div>
        </div>

        {s && <StatStrip summary={s} className="mt-6" />}
      </div>
    </section>
  );
}
