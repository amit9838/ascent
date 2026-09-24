// Public profile summary: the small stats snapshot shared via
// profiles/{uid}. Computed from local entity stores whenever solves or
// reward events change, so it can never leak more than the user chose to
// share (shareEnabled flag, enforced by Firestore rules).

import { loadProblemIndex } from "../data/problems.js";
import { buildPointsMap, pointsOf } from "../gamification/points.ts";
import { currentStreak } from "../gamification/activity.ts";
import { currentRank } from "../gamification/titles.ts";
import { getSolvedMap } from "../entities/solves.ts";
import { getRewardCounts } from "../gamification/rewards.ts";
import { subscribeRecords } from "../store/records.ts";
import { cached, forget } from "../cache.js";

export interface ProfileSummary {
  solved: number;
  total: number;
  points: number;
  streak: number;
  rank: string;
  stars: number;
  crowns: number;
  updatedAt: string;
}

async function computeSummaryImpl(): Promise<ProfileSummary> {
  const [index, solves, { stars, crowns }] = await Promise.all([
    loadProblemIndex(),
    getSolvedMap(),
    getRewardCounts(),
  ]);
  const pointsMap = buildPointsMap(index);
  const solvedIds = Object.keys(solves);
  const solved = solvedIds.length;
  const points = solvedIds.reduce(
    (sum, problemId) => sum + pointsOf(pointsMap, problemId),
    0
  );
  const streak = currentStreak(solves);
  const rank = currentRank(solved, index.total).current?.name ?? "Unranked";
  return {
    solved,
    total: index.total,
    points,
    streak,
    rank,
    stars,
    crowns,
    updatedAt: new Date().toISOString(),
  };
}

// The summary only changes when solves or reward events are written — every
// write flows through the record stores, so invalidate exactly then (no TTL
// staleness window). Concurrent callers share one computation.
subscribeRecords((storeName) => {
  if (storeName === "solves" || storeName === "rewardEvents") forget("summary");
});

export function computeSummary(): Promise<ProfileSummary> {
  return cached<ProfileSummary>("summary", computeSummaryImpl, { ttl: Infinity });
}
