// Gaming-flavored titles: ranked ladder (total solves), streak titles
// (all-time best streak, reconstructed from history), and consistency
// titles (perfect weeks). All derivable from stored data — no migration.

import { dayCounts, dayKey } from "./activity.ts";

const RANKS: [number, string][] = [
  [1, "First Light"],
  [10, "Iron"],
  [25, "Bronze"],
  [50, "Silver"],
  [75, "Gold"],
  [100, "Platinum"],
  [150, "Emerald"],
  [200, "Diamond"],
];

export interface TitleRule {
  days?: number;
  weeks?: number;
  name: string;
}

export const STREAK_TITLES: TitleRule[] = [
  { days: 3, name: "Spark" },
  { days: 7, name: "Glimmer" },
  { days: 14, name: "Radiance" },
  { days: 30, name: "Aurora" },
  { days: 100, name: "Eternal Dawn" },
];

export const CONSISTENCY_TITLES: TitleRule[] = [
  { weeks: 1, name: "Coronation" },
  { weeks: 4, name: "Dynasty" },
  { weeks: 12, name: "Immortal" },
];

export interface RankStep {
  solves: number;
  name: string;
}

export function rankLadder(total: number): RankStep[] {
  return [
    ...RANKS.map(([solves, name]) => ({ solves, name })),
    { solves: total, name: "Crown Jewel" },
  ];
}

export function currentRank(
  solved: number,
  total: number
): { current: RankStep | null; next: RankStep | null } {
  let current: RankStep | null = null;
  let next: RankStep | null = null;
  for (const r of rankLadder(total)) {
    if (solved >= r.solves) current = r;
    else {
      next = r;
      break;
    }
  }
  return { current, next };
}

const RANK_ORDER = [...RANKS.map(([, name]) => name), "Crown Jewel"];

// Numeric tier for a rank title so titles can be compared/sorted.
// "Unranked" (or anything unknown) sorts lowest.
export function rankTier(name: string): number {
  const i = RANK_ORDER.indexOf(name);
  return i === -1 ? -1 : i;
}

// Longest consecutive-day run ever (not just the live streak).
export function maxStreak(
  solves: Record<string, unknown>,
  now: Date = new Date()
): number {
  const counts = dayCounts(solves);
  const days = Object.keys(counts).sort();
  const todayK = dayKey(now);
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const k of days) {
    if (k > todayK) break; // ignore future-dated entries
    if (prev) {
      const diff =
        (Date.parse(`${k}T12:00:00`) - Date.parse(`${prev}T12:00:00`)) / 86400000;
      run = Math.round(diff) === 1 ? run + 1 : 1;
    } else {
      run = 1;
    }
    best = Math.max(best, run);
    prev = k;
  }
  return best;
}
