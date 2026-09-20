// Full-profile backup: progress, notes, goals, rewards, theme and
// question-of-day in one file. Storage keys mirrored from each feature
// module (kept stable for backward compatibility).

const KEYS = {
  progress: "dsa-progress-v1",
  notes: "dsa-notes-v1",
  plans: "dsa-plans-v1",
  rewards: "dsa-rewards-v1",
  theme: "dsa-theme-v1",
  qotd: "dsa-qotd-v1",
};

const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);

export function exportProfile() {
  const data = {};
  for (const [name, key] of Object.entries(KEYS)) {
    try {
      const raw = localStorage.getItem(key);
      // notes is stored as raw text, everything else as JSON
      if (raw != null) data[name] = name === "notes" ? raw : JSON.parse(raw);
    } catch {
      // skip sections that fail to read/parse
    }
  }
  return {
    app: "ascent",
    version: 1,
    exportedAt: new Date().toISOString(),
    data,
  };
}

function cleanProgress(raw) {
  if (!isObj(raw)) return undefined;
  const entries = {};
  for (const [k, v] of Object.entries(raw)) {
    if (
      typeof k === "string" &&
      k.startsWith("http") &&
      (v === true || typeof v === "string")
    ) {
      entries[k] = v;
    }
  }
  return Object.keys(entries).length ? entries : undefined;
}

function cleanPlans(raw) {
  if (!isObj(raw)) return undefined;
  const out = {};
  if (Number.isInteger(raw.weeklyTarget) && raw.weeklyTarget > 0) {
    out.weeklyTarget = Math.min(100, raw.weeklyTarget);
  }
  if (isObj(raw.months)) {
    const months = {};
    for (const [k, v] of Object.entries(raw.months)) {
      if (/^\d{4}-\d{2}$/.test(k) && Array.isArray(v)) {
        months[k] = v.filter((s) => typeof s === "string");
      }
    }
    out.months = months;
  }
  return out;
}

function cleanStatusMap(m) {
  if (!isObj(m)) return {};
  const o = {};
  for (const [k, v] of Object.entries(m)) {
    if (typeof k === "string" && (v === "earned" || v === "collected")) {
      o[k] = v;
    }
  }
  return o;
}

function cleanRewards(raw) {
  if (!isObj(raw)) return undefined;
  return { daily: cleanStatusMap(raw.daily), weekly: cleanStatusMap(raw.weekly) };
}

function cleanQotd(raw) {
  if (!isObj(raw)) return undefined;
  if (typeof raw.date !== "string" || typeof raw.id !== "string") {
    return undefined;
  }
  return { date: raw.date, id: raw.id };
}

// Accepts full-profile backups, legacy progress files ({ done }) and raw
// done maps. Returns sanitized sections (valid ones only). Throws on garbage.
export function parseBackup(json) {
  if (!isObj(json)) throw new Error("not an object");
  if (isObj(json.data)) {
    const d = json.data;
    const out = {};
    const p = cleanProgress(d.progress ?? d.done);
    if (p) out.progress = p;
    if (typeof d.notes === "string") out.notes = d.notes;
    const plans = cleanPlans(d.plans);
    if (plans) out.plans = plans;
    const rewards = cleanRewards(d.rewards);
    if (rewards) out.rewards = rewards;
    if (d.theme === "light" || d.theme === "dark") out.theme = d.theme;
    const qotd = cleanQotd(d.qotd);
    if (qotd) out.qotd = qotd;
    if (Object.keys(out).length === 0) throw new Error("no usable sections");
    return out;
  }
  const p = cleanProgress(isObj(json.done) ? json.done : json);
  if (!p) throw new Error("no usable sections");
  return { progress: p };
}

// Progress merges into the current map; singleton sections replace.
// Returns the merged done map (caller persists it via onReplace).
export function applyBackup(parsed, currentDone) {
  let merged = currentDone;
  if (parsed.progress) merged = { ...currentDone, ...parsed.progress };
  const put = (key, value, raw) => {
    try {
      localStorage.setItem(key, raw ? value : JSON.stringify(value));
    } catch {
      // skip sections that fail to write
    }
  };
  if (parsed.notes !== undefined) put(KEYS.notes, parsed.notes, true);
  if (parsed.plans !== undefined) put(KEYS.plans, parsed.plans);
  if (parsed.rewards !== undefined) put(KEYS.rewards, parsed.rewards);
  if (parsed.theme !== undefined) put(KEYS.theme, parsed.theme);
  if (parsed.qotd !== undefined) put(KEYS.qotd, parsed.qotd);
  return merged;
}
