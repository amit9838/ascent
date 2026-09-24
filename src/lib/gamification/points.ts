// Points: easy = 1, medium = 2, hard = 3. Derived from the E1 problem
// index at computation time, so no storage migration is ever needed.
//
// Maps are keyed by problem id (never URL).

export const POINTS_BY_DIFFICULTY: Record<string, number> = {
  easy: 1,
  medium: 2,
  hard: 3,
};

export function pointsFor(difficulty: string | null | undefined): number {
  const key = (difficulty || "").toLowerCase().trim();
  return POINTS_BY_DIFFICULTY[key] ?? 1;
}

// { [problemId]: points } from a loaded problem index ({ byId: Map }).
export function buildPointsMap(index: {
  byId?: Map<string, { id?: string; difficulty?: string }> | null;
}): Record<string, number> {
  const map: Record<string, number> = {};
  for (const problem of index?.byId?.values() ?? []) {
    if (problem?.id) map[problem.id] = pointsFor(problem.difficulty);
  }
  return map;
}

// Unknown ids (e.g. a problem removed from the catalog) still count 1.
export function pointsOf(
  map: Record<string, number> | null | undefined,
  problemId: string
): number {
  return map?.[problemId] ?? 1;
}
