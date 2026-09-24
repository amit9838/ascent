// Time-based insights derived from the solves map.
// solves = { [problemId]: ISO timestamp string }

import { pointsOf } from "./points.ts";

export function dayKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

// ISO timestamp -> epoch ms, or null when the entry has no usable date.
export function solvedAt(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : t;
}

// { "YYYY-MM-DD": solves } for dated entries only.
export function dayCounts(solves: Record<string, unknown>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const v of Object.values(solves)) {
    const t = solvedAt(v);
    if (t == null) continue;
    const k = dayKey(new Date(t));
    counts[k] = (counts[k] ?? 0) + 1;
  }
  return counts;
}

// { "YYYY-MM-DD": points } for dated entries only.
export function dayPoints(
  solves: Record<string, unknown>,
  points: Record<string, number> = {}
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const [problemId, v] of Object.entries(solves)) {
    const t = solvedAt(v);
    if (t == null) continue;
    const k = dayKey(new Date(t));
    map[k] = (map[k] ?? 0) + pointsOf(points, problemId);
  }
  return map;
}

// Monday 00:00 local of the week containing d.
export function weekStart(d: Date = new Date()): Date {
  const c = new Date(d);
  c.setDate(c.getDate() - ((c.getDay() + 6) % 7));
  c.setHours(0, 0, 0, 0);
  return c;
}

export function weekRangeLabel(d: Date = new Date()): string {
  const s = weekStart(d);
  const e = new Date(s);
  e.setDate(e.getDate() + 6);
  const fmt = (x: Date) =>
    x.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${fmt(s)} – ${fmt(e)}`;
}

export function solvedThisWeek(
  solves: Record<string, unknown>,
  points: Record<string, number> = {},
  now: Date = new Date()
): number {
  const start = weekStart(now).getTime();
  const end = start + 7 * 86400000;
  let n = 0;
  for (const [problemId, v] of Object.entries(solves)) {
    const t = solvedAt(v);
    if (t != null && t >= start && t < end) n += pointsOf(points, problemId);
  }
  return n;
}

export function currentStreak(
  solves: Record<string, unknown>,
  now: Date = new Date()
): number {
  const counts = dayCounts(solves);
  const d = new Date(now);
  if (!counts[dayKey(d)]) d.setDate(d.getDate() - 1); // today still pending
  let streak = 0;
  while (counts[dayKey(d)] > 0) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

export function bestDay(
  solves: Record<string, unknown>,
  points: Record<string, number> = {}
): { day: string; points: number } | null {
  const map = dayPoints(solves, points);
  let best: { day: string; points: number } | null = null;
  for (const [day, pts] of Object.entries(map)) {
    if (!best || pts > best.points) best = { day, points: pts };
  }
  return best; // null when there are no dated solves
}

export interface HeatmapDay {
  key: string;
  points: number;
  future: boolean;
  label: string;
}

// Last `weeks` Monday–Sunday columns ending with the current week.
export function heatmapWeeks(
  solves: Record<string, unknown>,
  points: Record<string, number> = {},
  weeks = 15,
  now: Date = new Date()
): HeatmapDay[][] {
  const counts = dayPoints(solves, points);
  const start = weekStart(now);
  start.setDate(start.getDate() - (weeks - 1) * 7);
  const todayK = dayKey(now);
  const cols: HeatmapDay[][] = [];
  for (let w = 0; w < weeks; w++) {
    const days: HeatmapDay[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + w * 7 + i);
      const k = dayKey(d);
      days.push({
        key: k,
        points: counts[k] ?? 0,
        future: k > todayK,
        label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      });
    }
    cols.push(days);
  }
  return cols;
}
