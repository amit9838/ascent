// Weekly target + monthly topic plans, persisted via src/lib/db.js.
// Shape: { weeklyTarget: number, months: { "YYYY-MM": [topicSlug, ...] } }

import { KEYS, getJSON, setJSON } from "./db.js";

function load() {
  const v = getJSON(KEYS.plans, {});
  if (v && typeof v === "object" && !Array.isArray(v)) return v;
  return {};
}

function save(v) {
  setJSON(KEYS.plans, v);
}

export function getWeeklyTarget() {
  const v = load().weeklyTarget;
  return Number.isInteger(v) && v > 0 ? v : 21;
}

export function setWeeklyTarget(n) {
  const v = load();
  v.weeklyTarget = n;
  save(v);
}
