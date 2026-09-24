// Question of the Day: one deterministic pick per calendar day (local timezone),
// cached as a device pref so it survives reloads and only changes the next day.

import { getPref, removePref, setPref } from "../../lib/entities/prefs.ts";
import type { Problem } from "../../lib/data/problemRows.ts";
import type { Topic } from "../../data/topics.ts";

const QOTD_KEY = "qotd";
const IGNORED_KEY = "qotdIgnored";

export interface QotdProblem {
  topic: Topic;
  problem: Problem;
}

export interface QotdPick extends QotdProblem {
  id: string;
  date: string;
  dateLabel: string;
}

export interface QotdCache {
  date: string;
  id: string;
}

function localDayKey(d: Date = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function todayLabel(): string {
  return new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

// Deterministic within the day even if storage is unavailable: the cached
// id only pins the pick across reloads. problems: [{ topic, problem }]
// (E1 records) in stable order; identity = problem.id.
// todayOverride (YYYY-MM-DD) is for testing only.
export async function pickQuestionOfTheDay(
  problems: QotdProblem[],
  todayOverride?: string
): Promise<QotdPick | null> {
  if (!problems.length) return null;
  const today = todayOverride ?? localDayKey();
  const cached = (await getPref(QOTD_KEY, null)) as QotdCache | null;
  if (cached && cached.date === today && cached.id) {
    const found = problems.find((p) => p.problem.id === cached.id);
    if (found)
      return { ...found, id: cached.id, date: today, dateLabel: todayLabel() };
  }
  const rng = mulberry32(hashStr(`ascent-qotd:${today}`));
  const pick = problems[Math.floor(rng() * problems.length)];
  const id = pick.problem.id;
  await setPref(QOTD_KEY, { date: today, id });
  return { ...pick, id, date: today, dateLabel: todayLabel() };
}

export async function loadIgnored(): Promise<QotdCache | null> {
  const v = (await getPref(IGNORED_KEY, null)) as Partial<QotdCache> | null;
  if (v && typeof v.date === "string" && typeof v.id === "string")
    return { date: v.date, id: v.id };
  return null;
}

export async function saveIgnored(entry: QotdCache | null): Promise<void> {
  if (entry) await setPref(IGNORED_KEY, entry);
  else await removePref(IGNORED_KEY);
}
