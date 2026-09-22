// Question of the Day: one deterministic pick per calendar day (local timezone),
// cached via src/lib/db.js so it survives reloads and only changes the next day.

import { KEYS, getJSON, setJSON, removeItem } from "./db.js";

function localDayKey(d = new Date()) {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function todayLabel() {
  return new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

// problems: [{ topic, row }] in stable order; identity = row.Link (workat URL).
// todayOverride (YYYY-MM-DD) is for testing only.
export function pickQuestionOfTheDay(problems, todayOverride) {
  const today = todayOverride ?? localDayKey();
  const cached = getJSON(KEYS.qotd, null);
  if (cached && cached.date === today && cached.id) {
    const found = problems.find((p) => p.row.Link === cached.id);
    if (found)
      return { ...found, id: cached.id, date: today, dateLabel: todayLabel() };
  }
  const rng = mulberry32(hashStr(`dsa-qotd:${today}`));
  const pick = problems[Math.floor(rng() * problems.length)];
  const id = pick.row.Link;
  setJSON(KEYS.qotd, { date: today, id });
  return { ...pick, id, date: today, dateLabel: todayLabel() };
}

export function loadIgnored() {
  const v = getJSON(KEYS.qotdIgnored, null);
  if (v && typeof v.date === "string" && typeof v.id === "string") return v;
  return null;
}

export function saveIgnored(entry) {
  if (entry) setJSON(KEYS.qotdIgnored, entry);
  else removeItem(KEYS.qotdIgnored);
}
