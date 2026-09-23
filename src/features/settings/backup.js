// Full-profile backup: progress, notes, goals, rewards, theme and
// question-of-day in one file. Storage keys mirrored from src/lib/db.js
// (kept stable for backward compatibility).

import { KEYS, getItem, getJSON, setItem, setJSON } from "../../lib/db.js";
import { readNotesBlob, writeNotesBlob } from "../../lib/notes.js";

const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);

export async function exportProfile() {
  const data = {};
  for (const [name, key] of Object.entries(KEYS)) {
    // qotdIgnored + cloudMeta are internal/local-only, not part of backups
    if (name === "qotdIgnored" || name === "cloudMeta") continue;
    // notes live as per-note records — export the aggregate blob;
    // theme is raw text; everything else is already JSON
    if (name === "notes") {
      const raw = await readNotesBlob();
      if (raw != null) data[name] = raw;
      continue;
    }
    if (name === "theme") {
      const raw = await getItem(key);
      if (raw != null) data[name] = raw;
      continue;
    }
    const parsed = await getJSON(key, undefined);
    if (parsed !== undefined) data[name] = parsed;
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
    if (typeof d.notes === "string" || Array.isArray(d.notes)) out.notes = d.notes;
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
export async function applyBackup(parsed, currentDone) {
  let merged = currentDone;
  if (parsed.progress) merged = { ...currentDone, ...parsed.progress };
  if (parsed.notes !== undefined) await writeNotesBlob(parsed.notes, "local");
  if (parsed.plans !== undefined) await setJSON(KEYS.plans, parsed.plans);
  if (parsed.rewards !== undefined) await setJSON(KEYS.rewards, parsed.rewards);
  if (parsed.theme !== undefined) await setItem(KEYS.theme, parsed.theme);
  if (parsed.qotd !== undefined) await setJSON(KEYS.qotd, parsed.qotd);
  return merged;
}
