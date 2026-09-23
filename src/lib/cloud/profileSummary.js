// Public profile summary: the small stats snapshot shared via
// users/{uid}/profile. Computed from local data whenever progress or
// rewards sync, so it can never leak more than the user chose to share
// (shareEnabled flag, enforced by Firestore rules).

import { TOPICS } from "../../data/topics.js";
import { loadTopicCsv } from "../csv.js";
import { buildPointsMap, pointsOf } from "../gamification/points.js";
import { currentStreak } from "../gamification/activity.js";
import { currentRank } from "../gamification/titles.js";
import { KEYS, getJSON, subscribe } from "../db.js";
import { cached, forget } from "../cache.js";

let topicDataPromise = null;
let pointsMap = null; // derived once from the static CSVs

function loadTopicData() {
  if (!topicDataPromise) {
    topicDataPromise = Promise.all(
      TOPICS.map((t) => loadTopicCsv(t.csv).then((rows) => [t.slug, rows]))
    ).then((entries) => {
      const data = Object.fromEntries(entries);
      pointsMap = buildPointsMap(data);
      return data;
    });
  }
  return topicDataPromise;
}

async function computeSummaryImpl() {
  const [done, rewards, data] = await Promise.all([
    getJSON(KEYS.progress, {}),
    getJSON(KEYS.rewards, {}),
    loadTopicData(),
  ]);
  const doneMap = done ?? {};
  const total = Object.values(data).reduce((a, rows) => a + rows.length, 0);
  const solved = Object.keys(doneMap).length;
  const points = Object.entries(doneMap).reduce(
    (a, [url]) => a + pointsOf(pointsMap, url),
    0
  );
  const streak = currentStreak(doneMap);
  const rank = currentRank(solved, total).current?.name ?? "Unranked";
  const daily = rewards?.daily ?? {};
  const weekly = rewards?.weekly ?? {};
  const stars = Object.values(daily).filter((s) => s === "collected").length;
  const crowns = Object.values(weekly).filter((s) => s === "collected").length;
  return {
    solved,
    total,
    points,
    streak,
    rank,
    stars,
    crowns,
    updatedAt: new Date().toISOString(),
  };
}

// The summary only changes when progress or rewards are written — every
// write flows through db.js pub/sub, so invalidate exactly then (no TTL
// staleness window). Concurrent callers share one computation.
subscribe((key) => {
  if (key === KEYS.progress || key === KEYS.rewards) forget("summary");
});

export function computeSummary() {
  return cached("summary", computeSummaryImpl, { ttl: Infinity });
}
