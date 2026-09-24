// Full-profile backup (v2): solves, notes, settings, reward events, theme
// and question-of-day in one file. No backward compatibility with v1
// backups (fresh start — see docs/data-model-redesign.md).

import { getSolvedMap } from "../../lib/entities/solves.ts";
import {
  getMonthPlans,
  getWeeklyTarget,
  replaceSettings,
} from "../../lib/entities/settings.ts";
import { getPref, setPref } from "../../lib/entities/prefs.ts";
import {
  exportRewardEvents,
  replaceRewardEvents,
} from "../../lib/gamification/rewards.ts";
import type { RewardEventRecord } from "../../lib/store/types.ts";
import {
  exportNotes,
  replaceNotes,
} from "../../lib/entities/notes.ts";
import type { NoteLike } from "../../lib/entities/notes.ts";

export interface ParsedBackup {
  solves?: Record<string, string>;
  notes?: { notes: NoteLike[]; isDeleted: Record<string, string> };
  settings?: {
    weeklyTarget?: number;
    weeklyTargetAt?: string;
    months?: Record<string, string[]>;
    monthAt?: Record<string, string>;
  };
  rewardEvents?: RewardEventRecord[];
  theme?: string;
  qotd?: { date: string; id: string };
}

export interface BackupFile {
  app: string;
  version: number;
  exportedAt: string;
  data: Record<string, unknown>;
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function isIsoStr(v: unknown): v is string {
  return typeof v === "string" && !Number.isNaN(Date.parse(v));
}

export async function exportProfile(): Promise<BackupFile> {
  const data: Record<string, unknown> = {};
  const solves = await getSolvedMap();
  if (Object.keys(solves).length) data.solves = solves;
  const notes = await exportNotes();
  if (notes.notes.length || Object.keys(notes.isDeleted).length) {
    data.notes = notes;
  }
  const weeklyTarget = await getWeeklyTarget();
  const { months, monthAt } = await getMonthPlans();
  data.settings = { weeklyTarget, months, monthAt };
  const events = await exportRewardEvents();
  if (events.length) data.rewardEvents = events;
  const theme = await getPref("theme", null);
  if (theme === "light" || theme === "dark") data.theme = theme;
  const qotd = await getPref("qotd", null);
  if (isObj(qotd)) data.qotd = qotd;
  return {
    app: "ascent",
    version: 2,
    exportedAt: new Date().toISOString(),
    data,
  };
}

// --- import sanitizers (valid sections only; garbage is dropped) ---

function cleanSolves(raw: unknown): Record<string, string> | undefined {
  if (!isObj(raw)) return undefined;
  const out: Record<string, string> = {};
  for (const [problemId, solvedAt] of Object.entries(raw)) {
    if (typeof problemId === "string" && problemId && isIsoStr(solvedAt)) {
      out[problemId] = solvedAt;
    }
  }
  return Object.keys(out).length ? out : undefined;
}

function isNoteRow(n: unknown): n is NoteLike {
  return isObj(n) && typeof n.id === "string" && n.id !== "";
}

function cleanNotes(
  raw: unknown
): { notes: NoteLike[]; isDeleted: Record<string, string> } | undefined {
  if (!isObj(raw) || !Array.isArray(raw.notes)) return undefined;
  const notes = raw.notes.filter(isNoteRow);
  if (!notes.length) return undefined;
  const isDeleted: Record<string, string> = {};
  // Current key is `isDeleted`; pre-rename backups used `deleted`.
  const stamps = isObj(raw.isDeleted) ? raw.isDeleted : raw.deleted;
  if (isObj(stamps)) {
    for (const [id, at] of Object.entries(stamps)) {
      if (typeof id === "string" && id && isIsoStr(at)) isDeleted[id] = at;
    }
  }
  return { notes, isDeleted };
}

function cleanSettings(raw: unknown): ParsedBackup["settings"] {
  if (!isObj(raw)) return undefined;
  const out: NonNullable<ParsedBackup["settings"]> = {};
  if (
    typeof raw.weeklyTarget === "number" &&
    Number.isInteger(raw.weeklyTarget) &&
    raw.weeklyTarget > 0
  ) {
    out.weeklyTarget = Math.min(100, raw.weeklyTarget);
  }
  if (isObj(raw.months)) {
    const months: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(raw.months)) {
      if (/^\d{4}-\d{2}$/.test(k) && Array.isArray(v)) {
        months[k] = v.filter((s): s is string => typeof s === "string");
      }
    }
    out.months = months;
  }
  if (isIsoStr(raw.weeklyTargetAt)) out.weeklyTargetAt = raw.weeklyTargetAt;
  if (isObj(raw.monthAt)) {
    const monthAt: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw.monthAt)) {
      if (/^\d{4}-\d{2}$/.test(k) && isIsoStr(v)) monthAt[k] = v;
    }
    if (Object.keys(monthAt).length) out.monthAt = monthAt;
  }
  return out;
}

function cleanRewardEvents(raw: unknown): RewardEventRecord[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const events = raw.filter(
    (e: unknown) =>
      isObj(e) &&
      typeof e.id === "string" &&
      e.id !== "" &&
      (e.kind === "daily" || e.kind === "weekly") &&
      typeof e.periodStart === "string" &&
      e.periodStart !== "" &&
      typeof e.target === "number" &&
      Number.isInteger(e.target) &&
      (e.status === "earned" || e.status === "collected") &&
      isIsoStr(e.earnedAt) &&
      isIsoStr(e.updatedAt)
  );
  return events.length ? (events as RewardEventRecord[]) : undefined;
}

function cleanQotd(raw: unknown): { date: string; id: string } | undefined {
  if (!isObj(raw)) return undefined;
  if (typeof raw.date !== "string" || typeof raw.id !== "string") {
    return undefined;
  }
  return { date: raw.date, id: raw.id };
}

// Accepts v2 full-profile backups only. Returns sanitized sections (valid
// ones only). Throws on garbage.
export function parseBackup(json: unknown): ParsedBackup {
  if (!isObj(json) || !isObj(json.data)) throw new Error("not a v2 backup");
  const d = json.data;
  const out: ParsedBackup = {};
  const solves = cleanSolves(d.solves);
  if (solves) out.solves = solves;
  const notes = cleanNotes(d.notes);
  if (notes) out.notes = notes;
  const settings = cleanSettings(d.settings);
  if (settings) out.settings = settings;
  const rewardEvents = cleanRewardEvents(d.rewardEvents);
  if (rewardEvents) out.rewardEvents = rewardEvents;
  if (d.theme === "light" || d.theme === "dark") out.theme = d.theme;
  const qotd = cleanQotd(d.qotd);
  if (qotd) out.qotd = qotd;
  if (Object.keys(out).length === 0) throw new Error("no usable sections");
  return out;
}

// Solves merge into the current map; every other section replaces.
// Returns the merged solves map (caller persists it via onReplace).
export async function applyBackup(
  parsed: ParsedBackup,
  currentSolves: Record<string, string>
): Promise<Record<string, string>> {
  let merged = currentSolves;
  if (parsed.solves) merged = { ...currentSolves, ...parsed.solves };
  if (parsed.notes !== undefined) {
    await replaceNotes(parsed.notes.notes, parsed.notes.isDeleted, "local");
  }
  if (parsed.settings !== undefined) {
    await replaceSettings({
      ...parsed.settings,
      weeklyTarget: parsed.settings.weeklyTarget ?? (await getWeeklyTarget()),
    });
  }
  if (parsed.rewardEvents !== undefined) {
    await replaceRewardEvents(parsed.rewardEvents);
  }
  if (parsed.theme !== undefined) await setPref("theme", parsed.theme);
  if (parsed.qotd !== undefined) await setPref("qotd", parsed.qotd);
  return merged;
}
