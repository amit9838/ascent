// Gaming-flavored titles: ranked ladder (total solves), streak titles
// (all-time best streak, reconstructed from history), and consistency
// titles (perfect weeks). All derivable from stored data — no migration.

import { dayCounts, dayKey } from "./activity.js";

const RANKS = [
  [1, "First Light"],
  [10, "Iron"],
  [25, "Bronze"],
  [50, "Silver"],
  [75, "Gold"],
  [100, "Platinum"],
  [150, "Emerald"],
  [200, "Diamond"],
];

export const STREAK_TITLES = [
  { days: 3, name: "Spark" },
  { days: 7, name: "Glimmer" },
  { days: 14, name: "Radiance" },
  { days: 30, name: "Aurora" },
  { days: 100, name: "Eternal Dawn" },
];

export const CONSISTENCY_TITLES = [
  { weeks: 1, name: "Coronation" },
  { weeks: 4, name: "Dynasty" },
  { weeks: 12, name: "Immortal" },
];

export function rankLadder(total) {
  return [
    ...RANKS.map(([solves, name]) => ({ solves, name })),
    { solves: total, name: "Crown Jewel" },
  ];
}

export function currentRank(solved, total) {
  let current = null;
  let next = null;
  for (const r of rankLadder(total)) {
    if (solved >= r.solves) current = r;
    else {
      next = r;
      break;
    }
  }
  return { current, next };
}

// Longest consecutive-day run ever (not just the live streak).
export function maxStreak(done, now = new Date()) {
  const counts = dayCounts(done);
  const days = Object.keys(counts).sort();
  const todayK = dayKey(now);
  let best = 0;
  let run = 0;
  let prev = null;
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
