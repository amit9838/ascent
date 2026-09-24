// Pure E1 Problem builders (docs/data-model-redesign.md §3).
//
// Zero browser dependencies on purpose: this module imports only the CSV
// column map, so it runs under plain `node --test` with fixture rows.
// The async catalog loader lives in problems.js.
//
// Identity rules (must stay in sync with scripts/assign-problem-ids.mjs):
//   - `id` is the source of truth; `#` is display order only.
//   - The same problem listed under two topics shares one id and shows up
//     in both topic lists (separate listing objects — seq is per-topic;
//     byId keeps the first).
//   - byUrl keeps the FIRST topic's entry when a URL repeats (canonical
//     home = alphabetical-first file, same rule as the assign script).

import { F } from "../csv.js";
import type { CsvRow } from "../csv.js";

export interface Problem {
  id: string;
  seq: number;
  topic: string;
  name: string;
  url: string;
  score: number;
  accuracy: string;
  difficulty: string;
  companies: string;
  lcName: string;
  lcUrl: string;
  otherName: string;
  otherUrl: string;
  note: string;
}

export interface ProblemIndex {
  byId: Map<string, Problem>;
  byTopic: Map<string, Problem[]>;
  byUrl: Map<string, string>;
  total: number;
}

const VALID_DIFFICULTIES = new Set(["easy", "medium", "hard"]);

function toInt(value: string | null | undefined, fallback = 0): number {
  const parsed = parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function cleanText(value: string | null | undefined): string {
  return (value ?? "").toString().trim();
}

// One raw CSV row -> one E1 Problem.
export function rowToProblem(topicSlug: string, row: CsvRow): Problem {
  const difficulty = cleanText(row[F.difficulty]).toLowerCase();
  return {
    id: cleanText(row[F.id]),
    seq: toInt(row[F.num], 0),
    topic: topicSlug,
    name: cleanText(row[F.name]),
    url: cleanText(row[F.link]),
    score: toInt(row[F.score], 0),
    accuracy: cleanText(row[F.accuracy]),
    difficulty: VALID_DIFFICULTIES.has(difficulty) ? difficulty : "medium",
    companies: cleanText(row[F.companies]),
    lcName: cleanText(row[F.lc]),
    lcUrl: cleanText(row[F.lcLink]),
    otherName: cleanText(row[F.other]),
    otherUrl: cleanText(row[F.otherLink]),
    note: cleanText(row[F.notes]),
  };
}

// One topic's rows -> ordered Problem list. Rows without an id are skipped
// so a hand-edited CSV missing ids degrades to "hidden row", never a crash.
export function buildTopicProblems(
  topicSlug: string,
  rows: CsvRow[] | null | undefined
): Problem[] {
  return (rows ?? [])
    .map((row) => rowToProblem(topicSlug, row))
    .filter((problem) => problem.id !== "")
    .sort((a, b) => a.seq - b.seq);
}

// Topic lists -> full index. Shared problems (same id, two topics) appear
// in both lists as separate listing objects — seq is per-topic — but exist
// once in byId (first topic wins).
export function buildProblemIndex(topicProblems: Array<[string, Problem[]]>): ProblemIndex {
  const byId = new Map();
  const byTopic = new Map();
  const byUrl = new Map();
  for (const [topicSlug, problems] of topicProblems) {
    byTopic.set(topicSlug, problems);
    for (const problem of problems) {
      if (!byId.has(problem.id)) byId.set(problem.id, problem);
      // First topic wins as the canonical home of a repeated URL.
      if (problem.url && !byUrl.has(problem.url)) {
        byUrl.set(problem.url, problem.id);
      }
    }
  }
  return { byId, byTopic, byUrl, total: byId.size };
}
