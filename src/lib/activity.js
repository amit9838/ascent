import { pointsOf } from "./points.js";

// Time-based insights derived from the progress map.
// done = { [workatUrl]: ISO timestamp string | true (legacy, undated) }

export function dayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

// ISO timestamp -> epoch ms, or null when the entry has no usable date.
export function solvedAt(value) {
  if (typeof value !== "string") return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : t;
}

// { "YYYY-MM-DD": solves } for dated entries only.
export function dayCounts(done) {
  const counts = {};
  for (const v of Object.values(done)) {
    const t = solvedAt(v);
    if (t == null) continue;
    const k = dayKey(new Date(t));
    counts[k] = (counts[k] ?? 0) + 1;
  }
  return counts;
}

// { "YYYY-MM-DD": points } for dated entries only.
export function dayPoints(done, points = {}) {
  const map = {};
  for (const [url, v] of Object.entries(done)) {
    const t = solvedAt(v);
    if (t == null) continue;
    const k = dayKey(new Date(t));
    map[k] = (map[k] ?? 0) + pointsOf(points, url);
  }
  return map;
}

// Monday 00:00 local of the week containing d.
export function weekStart(d = new Date()) {
  const c = new Date(d);
  c.setDate(c.getDate() - ((c.getDay() + 6) % 7));
  c.setHours(0, 0, 0, 0);
  return c;
}

export function weekRangeLabel(d = new Date()) {
  const s = weekStart(d);
  const e = new Date(s);
  e.setDate(e.getDate() + 6);
  const fmt = (x) =>
    x.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${fmt(s)} – ${fmt(e)}`;
}

export function solvedThisWeek(done, points = {}, now = new Date()) {
  const start = weekStart(now).getTime();
  const end = start + 7 * 86400000;
  let n = 0;
  for (const [url, v] of Object.entries(done)) {
    const t = solvedAt(v);
    if (t != null && t >= start && t < end) n += pointsOf(points, url);
  }
  return n;
}

export function currentStreak(done, now = new Date()) {
  const counts = dayCounts(done);
  const d = new Date(now);
  if (!counts[dayKey(d)]) d.setDate(d.getDate() - 1); // today still pending
  let streak = 0;
  while (counts[dayKey(d)] > 0) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

export function bestDay(done, points = {}) {
  const map = dayPoints(done, points);
  let best = null;
  for (const [day, pts] of Object.entries(map)) {
    if (!best || pts > best.points) best = { day, points: pts };
  }
  return best; // null when there are no dated solves
}

// Last `weeks` Monday–Sunday columns ending with the current week.
export function heatmapWeeks(done, points = {}, weeks = 15, now = new Date()) {
  const counts = dayPoints(done, points);
  const start = weekStart(now);
  start.setDate(start.getDate() - (weeks - 1) * 7);
  const todayK = dayKey(now);
  const cols = [];
  for (let w = 0; w < weeks; w++) {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + w * 7 + i);
      const k = dayKey(d);
      days.push({
        key: k,
        points: counts[k] ?? 0,
        future: k > todayK,
        label: d.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        }),
      });
    }
    cols.push(days);
  }
  return cols;
}
