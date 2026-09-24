// E2 Solve entity (docs/schema-v3-plan.md §2).
//
// One STATE row per problem, never a tombstone:
//   { problemId, solvedAt, updatedAt, isDone }
//
// isDone is the domain flag: solved → true, unchecked → false (the row
// stays so re-solving just flips it back to true). solvedAt is the
// user-visible timestamp (streaks, heatmap, weekly stats); updatedAt is
// the sync clock, bumped on every flip. Rows are never pruned — they ARE
// the progress state (bounded by catalog size).
//
// UI modules consume the plain `{ [problemId]: solvedAt }` map of DONE
// problems and never touch records directly.

import { useCallback } from "react";
import { deleteRecord, getAllRecords, getRecord, putRecord } from "../store/records.ts";
import { useEntityState } from "../store/useEntityState.ts";
import { resetRewardEvents } from "../gamification/rewards.ts";

const STORE = "solves";

// Pre-flag rows may still carry the old `deleted: true` (= unsolved);
// treat them by their equivalent flag so nothing reads as solved wrongly.
function isUnsolved(row: { isDone?: boolean; deleted?: boolean }): boolean {
  return row.isDone === false || row.deleted === true;
}

// UI-friendly map: { [problemId]: solvedAtISO } of DONE problems. Values
// feed streaks, heatmaps and points; keys are E1 problem ids (never URLs).
export async function getSolvedMap(): Promise<Record<string, string>> {
  const rows = await getAllRecords(STORE);
  const solved: Record<string, string> = {};
  for (const row of rows) {
    if (row && row.problemId && !isUnsolved(row)) {
      solved[row.problemId] = row.solvedAt;
    }
  }
  return solved;
}

// Toggle one problem. Returns true when it ends up solved.
export async function toggleSolve(problemId: string): Promise<boolean> {
  const existing = await getRecord(STORE, problemId);
  const now = new Date().toISOString();
  if (existing && !isUnsolved(existing)) {
    // flip the state flag — the row stays (re-solving flips it back on)
    await putRecord(STORE, {
      problemId,
      solvedAt: existing.solvedAt,
      updatedAt: now,
      isDone: false,
    });
    return false;
  }
  await putRecord(STORE, { problemId, solvedAt: now, updatedAt: now, isDone: true });
  return true;
}

// Reset-all: flip every done problem to not-done (propagates as
// "unsolved everywhere") and clear earned rewards.
export async function clearSolves(): Promise<void> {
  const now = new Date().toISOString();
  const rows = await getAllRecords(STORE);
  await Promise.all(
    rows
      .filter((row) => row && !isUnsolved(row))
      .map((row) => putRecord(STORE, { ...row, isDone: false, updatedAt: now }))
  );
  await resetRewardEvents();
}

// Replace the whole set (backup import). `solvedMap` is
// { [problemId]: solvedAtISO }; invalid entries are skipped by the caller.
export async function replaceSolves(solvedMap: Record<string, unknown>): Promise<void> {
  const existing = await getAllRecords(STORE);
  await Promise.all(
    existing.map((row) => row && deleteRecord(STORE, row.problemId))
  );
  const now = new Date().toISOString();
  await Promise.all(
    Object.entries(solvedMap ?? {}).map(([problemId, solvedAt]) =>
      putRecord(STORE, {
        problemId,
        solvedAt: typeof solvedAt === "string" ? solvedAt : now,
        updatedAt: now,
        isDone: true,
      })
    )
  );
}

// React binding: id-keyed solves map + actions. Replaces useProgress.
export function useSolves(): {
  solves: Record<string, string> | null;
  ready: boolean;
  toggle: (problemId: string) => void;
  reset: () => Promise<void>;
  replaceAll: (map: Record<string, string>) => Promise<void>;
} {
  const [solves, setSolves, ready] = useEntityState<Record<string, string> | null>(
    STORE,
    getSolvedMap,
    null
  );

  const toggle = useCallback(
    (problemId: string) => {
      setSolves((prev) => {
        const base = prev ?? {};
        const next = { ...base };
        if (next[problemId]) delete next[problemId];
        else next[problemId] = new Date().toISOString();
        return next;
      });
      toggleSolve(problemId);
    },
    [setSolves]
  );

  const reset = useCallback(async () => {
    setSolves({});
    await clearSolves();
  }, [setSolves]);

  const replaceAll = useCallback(
    async (map: Record<string, string>) => {
      setSolves(map ?? {});
      await replaceSolves(map);
    },
    [setSolves]
  );

  return { solves, ready, toggle, reset, replaceAll };
}
