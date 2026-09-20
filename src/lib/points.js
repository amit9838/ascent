// Points: easy = 1, medium = 2, hard = 3. Derived from CSV difficulty
// at computation time, so no storage migration is ever needed.
import { F } from "./csv.js";

export const POINTS_BY_DIFFICULTY = { easy: 1, medium: 2, hard: 3 };

export function pointsFor(difficulty) {
  const d = (difficulty || "").toLowerCase().trim();
  return POINTS_BY_DIFFICULTY[d] ?? 1;
}

// { [workatUrl]: points } built from loaded CSV data ({ slug: rows }).
export function buildPointsMap(data) {
  const map = {};
  for (const rows of Object.values(data ?? {})) {
    for (const r of rows) {
      if (r?.[F.link]) map[r[F.link]] = pointsFor(r[F.difficulty]);
    }
  }
  return map;
}

export function pointsOf(map, url) {
  return map?.[url] ?? 1;
}
