// Rewards engine: Daybreak Stars (hit the daily target) and Sapphire Crowns
// (hit the daily target every day of a week). Earned rewards stay
// claimable until collected. State: { daily: { "YYYY-MM-DD": "earned" | "collected" },
// weekly: { "<monday YYYY-MM-DD>": "earned" | "collected" } }

import { dayKey, dayPoints, weekStart } from "./activity.js";

const KEY = "dsa-rewards-v1";

function loadState() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY));
    if (v && typeof v === "object") {
      return {
        daily:
          v.daily && typeof v.daily === "object" && !Array.isArray(v.daily)
            ? v.daily
            : {},
        weekly:
          v.weekly && typeof v.weekly === "object" && !Array.isArray(v.weekly)
            ? v.weekly
            : {},
      };
    }
  } catch {
    // fall through to empty state
  }
  return { daily: {}, weekly: {} };
}

function saveState(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // storage unavailable — rewards apply for this session only
  }
}

function parseDay(key /* YYYY-MM-DD, noon local to avoid TZ shifts */) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}

export function dailyTarget(weeklyTarget) {
  return Math.max(1, Math.ceil(weeklyTarget / 7));
}

// Marks newly-earned rewards as "earned" (never touches "collected").
// Returns the full state. `now` override exists for testing.
export function refreshRewards(done, points, weeklyTarget, now = new Date()) {
  const target = dailyTarget(weeklyTarget);
  const counts = dayPoints(done, points);
  const state = loadState();
  const todayK = dayKey(now);

  for (const [day, n] of Object.entries(counts)) {
    if (day <= todayK && n >= target && !state.daily[day]) {
      state.daily[day] = "earned";
    }
  }

  const days = Object.keys(counts).sort();
  if (days.length) {
    const cur = weekStart(now);
    let m = weekStart(parseDay(days[0]));
    while (m <= cur) {
      const wk = dayKey(m);
      let ok = true;
      for (let i = 0; i < 7; i++) {
        const d = new Date(m);
        d.setDate(d.getDate() + i);
        const k = dayKey(d);
        if (k > todayK || (counts[k] ?? 0) < target) {
          ok = false;
          break;
        }
      }
      if (ok && !state.weekly[wk]) state.weekly[wk] = "earned";
      m.setDate(m.getDate() + 7);
    }
  }

  saveState(state);
  return state;
}

export function collectDaily(dayKeyStr) {
  const s = loadState();
  if (s.daily[dayKeyStr] === "earned") {
    s.daily[dayKeyStr] = "collected";
    saveState(s);
  }
  return s;
}

export function collectWeekly(weekKey) {
  const s = loadState();
  if (s.weekly[weekKey] === "earned") {
    s.weekly[weekKey] = "collected";
    saveState(s);
  }
  return s;
}
