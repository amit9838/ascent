// Weekly target + monthly topic plans, persisted in localStorage.
// Shape: { weeklyTarget: number, months: { "YYYY-MM": [topicSlug, ...] } }

const KEY = "dsa-plans-v1";

function load() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY));
    if (v && typeof v === "object" && !Array.isArray(v)) return v;
  } catch {
    // fall through to defaults
  }
  return {};
}

function save(v) {
  try {
    localStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    // storage unavailable — plans apply for this session only
  }
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
