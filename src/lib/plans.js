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
  return Number.isInteger(v) && v > 0 ? v : 7;
}

export function setWeeklyTarget(n) {
  const v = load();
  v.weeklyTarget = n;
  save(v);
}

export function getMonthPlan(month /* "YYYY-MM" */) {
  const m = load().months?.[month];
  return Array.isArray(m) ? m : [];
}

export function toggleMonthTopic(month, slug) {
  const v = load();
  v.months = v.months ?? {};
  const cur = new Set(Array.isArray(v.months[month]) ? v.months[month] : []);
  if (cur.has(slug)) cur.delete(slug);
  else cur.add(slug);
  v.months[month] = [...cur];
  save(v);
  return v.months[month];
}
