// Sapphire Crown rules, pure (no storage) so they unit-test under Node.
//
// A crown = CROWN_DAYS consecutive star days (days with a Daybreak Star),
// starting on any weekday. A long run splits into back-to-back blocks, and
// a star day belongs to at most one crown: days already covered by an
// existing crown are skipped, so backfilled history never re-slices blocks
// that were already awarded.

import { dayKey, weekStart } from "./activity.ts";

export const CROWN_DAYS = 3;

function parseDay(key: string /* YYYY-MM-DD, noon local to avoid TZ shifts */): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}

function addDays(key: string, n: number): string {
  const d = parseDay(key);
  d.setDate(d.getDate() + n);
  return dayKey(d);
}

// The CROWN_DAYS day keys a crown starting on `start` covers.
export function crownDays(start: string): string[] {
  return Array.from({ length: CROWN_DAYS }, (_, i) => addDays(start, i));
}

export interface CrownScan {
  /** Start days of crowns that should exist but don't yet. */
  starts: string[];
  /** Trailing run of uncovered consecutive star days (< CROWN_DAYS long). */
  open: string[];
}

export function scanCrowns(
  starDays: Iterable<string>,
  crownStarts: Iterable<string>
): CrownScan {
  const covered = new Set<string>();
  for (const start of crownStarts) for (const day of crownDays(start)) covered.add(day);

  const starts: string[] = [];
  let run: string[] = [];
  for (const day of [...new Set(starDays)].sort()) {
    if (covered.has(day)) {
      run = [];
      continue;
    }
    if (run.length && addDays(run[run.length - 1], 1) !== day) run = [];
    run.push(day);
    if (run.length === CROWN_DAYS) {
      starts.push(run[0]);
      run = [];
    }
  }
  return { starts, open: run };
}

// The run counting toward the next crown, or [] when there is none. The
// open run only counts while it's alive: it ends today or yesterday
// (today's star may still come).
export function liveCrownRun(
  starDays: Iterable<string>,
  crownStarts: Iterable<string>,
  now: Date = new Date()
): string[] {
  const { open } = scanCrowns(starDays, crownStarts);
  if (!open.length) return [];
  const last = open[open.length - 1];
  const todayK = dayKey(now);
  return last === todayK || addDays(last, 1) === todayK ? open : [];
}

// Days shown toward the next crown: full when a crown closed today (so the
// meter doesn't reset the moment it's won), else the live run's length.
export function crownRunLength(
  starDays: Iterable<string>,
  crownStarts: Iterable<string>,
  now: Date = new Date()
): number {
  const starts = [...crownStarts];
  const todayK = dayKey(now);
  if (starts.some((start) => crownDays(start).at(-1) === todayK)) return CROWN_DAYS;
  return liveCrownRun(starDays, starts, now).length;
}

// Monday–Sunday weeks with a star on all 7 days (Consistency titles).
export function perfectWeekCount(starDays: Iterable<string>): number {
  const perWeek = new Map<string, number>();
  for (const day of new Set(starDays)) {
    const week = dayKey(weekStart(parseDay(day)));
    perWeek.set(week, (perWeek.get(week) ?? 0) + 1);
  }
  return [...perWeek.values()].filter((n) => n === 7).length;
}
