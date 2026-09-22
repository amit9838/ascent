// Public profile summary: the small stats snapshot shared via
// users/{uid}/profile. Computed from local data whenever progress or
// rewards sync, so it can never leak more than the user chose to share
// (shareEnabled flag, enforced by Firestore rules).

import { TOPICS } from "../../data/topics.js";
import { loadTopicCsv } from "../csv.js";
import { buildPointsMap, pointsOf } from "../points.js";
import { currentStreak } from "../activity.js";
import { currentRank } from "../titles.js";
import { KEYS, getJSON } from "../db.js";

let topicDataPromise = null;

function loadTopicData() {
  if (!topicDataPromise) {
    topicDataPromise = Promise.all(
      TOPICS.map((t) => loadTopicCsv(t.csv).then((rows) => [t.slug, rows]))
    ).then(Object.fromEntries);
  }
  return topicDataPromise;
}

export async function computeSummary() {
  const [done, rewards, data] = await Promise.all([
    getJSON(KEYS.progress, {}),
    getJSON(KEYS.rewards, {}),
    loadTopicData(),
  ]);
  const doneMap = done ?? {};
  const pointsMap = buildPointsMap(data);
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
