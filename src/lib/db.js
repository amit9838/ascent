// Central storage layer for the app.
//
// Today this is backed by localStorage (sync). All feature modules
// (progress, plans, rewards, qotd, notes, theme, profile) must go through
// this file instead of touching localStorage directly.
//
// Why: when we migrate to IndexedDB (async) in the future, only this file's
// internals need to change — callers keep the same key names. At that point
// the sync API here will become async (promises) and callers will need to
// `await` reads/writes.
//
// Keys are kept stable for backward compatibility with existing browsers
// and exported backup files.

export const KEYS = {
  progress: "dsa-progress-v1",
  notes: "dsa-notes-v1",
  plans: "dsa-plans-v1",
  rewards: "dsa-rewards-v1",
  theme: "dsa-theme-v1",
  qotd: "dsa-qotd-v1",
  qotdIgnored: "dsa-qotd-ignored-v1",
};

// Raw string access (for notes/theme, which store plain text).

export function getItem(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function setItem(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage unavailable (private mode / quota) — caller keeps in-memory state
  }
}

export function removeItem(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // nothing to clear
  }
}

// JSON object access (for progress, plans, rewards, qotd).

export function getJSON(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

export function setJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable — value applies for this session only
  }
}
