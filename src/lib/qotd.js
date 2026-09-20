// Question of the Day: one deterministic pick per calendar day (local timezone),
// cached in localStorage so it survives reloads and only changes the next day.

const KEY = "dsa-qotd-v1";

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
  try {
    const cached = JSON.parse(localStorage.getItem(KEY));
    if (cached && cached.date === today && cached.id) {
      const found = problems.find((p) => p.row.Link === cached.id);
      if (found)
        return { ...found, id: cached.id, date: today, dateLabel: todayLabel() };
    }
  } catch {
    // fall through to a fresh deterministic pick
  }
  const rng = mulberry32(hashStr(`dsa-qotd:${today}`));
  const pick = problems[Math.floor(rng() * problems.length)];
  const id = pick.row.Link;
  try {
    localStorage.setItem(KEY, JSON.stringify({ date: today, id }));
  } catch {
    // storage unavailable — the deterministic pick is still stable within the day
  }
  return { ...pick, id, date: today, dateLabel: todayLabel() };
}
