// E1 Problem index loader (docs/data-model-redesign.md §3).
//
// Pure row/index builders live in problemRows.js (unit-tested); this module
// only wires them to the topic CSVs with a session memo.

import { TOPICS } from "../../data/topics.js";
import { loadTopicCsv } from "../csv.js";
import {
  buildProblemIndex,
  buildTopicProblems,
  rowToProblem,
} from "./problemRows.js";
import type { Problem, ProblemIndex } from "./problemRows.js";

export { buildProblemIndex, buildTopicProblems, rowToProblem };
export type { Problem, ProblemIndex };

let indexPromise: Promise<ProblemIndex> | null = null;

// Loads every topic CSV and builds the index once per session.
// Callers share the in-flight promise (no request stampede).
export function loadProblemIndex(): Promise<ProblemIndex> {
  if (!indexPromise) {
    indexPromise = Promise.all(
      TOPICS.map(
        async (topic): Promise<[string, Problem[]]> => [
          topic.slug,
          buildTopicProblems(topic.slug, await loadTopicCsv(topic.csv)),
        ]
      )
    ).then(buildProblemIndex);
  }
  return indexPromise;
}
