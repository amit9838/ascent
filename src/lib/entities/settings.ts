// E5 Settings entity (docs/schema-v3-plan.md §2): the single SYNCED row
// { key: "settings", weeklyTarget, weeklyTargetAt, months, monthAt,
// updatedAt } in the `settings` store. Whole-doc LWW on updatedAt
// (single-user data, conflicts are vanishingly rare).
// Device-local preferences live in entities/prefs.ts — not here.

import { getRecord, putRecord } from "../store/records.ts";
import { useEntityState } from "../store/useEntityState.ts";
import { SETTINGS_KEY } from "../store/schema.ts";
import type { SettingsRow } from "../store/types.ts";

export const DEFAULT_WEEKLY_TARGET = 21;

// Firestore doc id for the synced row: users/{uid}/settings/preferences.
// (A bare users/{uid}/settings path has 3 segments — odd — which is a
// collection path; document references need an even number of segments.)
export const SETTINGS_DOC_ID = "preferences";

function isoNow(): string {
  return new Date().toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function loadSettingsRow(): Promise<Partial<SettingsRow>> {
  const row = await getRecord("settings", SETTINGS_KEY);
  return isRecord(row) ? row : {};
}

async function saveSettingsRow(patch: Partial<Omit<SettingsRow, "key">>): Promise<void> {
  const row = await loadSettingsRow();
  await putRecord("settings", { ...row, ...patch, key: SETTINGS_KEY, updatedAt: isoNow() });
}

function validTarget(value: unknown): number {
  return Number.isInteger(value) && (value as number) > 0
    ? (value as number)
    : DEFAULT_WEEKLY_TARGET;
}

export async function getWeeklyTarget(): Promise<number> {
  return validTarget((await loadSettingsRow()).weeklyTarget);
}

export async function setWeeklyTarget(target: number): Promise<void> {
  await saveSettingsRow({ weeklyTarget: target, weeklyTargetAt: isoNow() });
}

// Monthly topic plans: { "YYYY-MM": [topicSlug, ...] } + per-month clocks.
export async function getMonthPlans(): Promise<{
  months: Record<string, string[]>;
  monthAt: Record<string, string>;
}> {
  const row = await loadSettingsRow();
  return {
    months: isRecord(row.months) ? (row.months as Record<string, string[]>) : {},
    monthAt: isRecord(row.monthAt) ? (row.monthAt as Record<string, string>) : {},
  };
}

export async function setMonthPlans(
  months: Record<string, string[]>,
  monthAt: Record<string, string> = {}
): Promise<void> {
  await saveSettingsRow({ months, monthAt });
}

// Whole-row replace (backup import).
export async function replaceSettings(snapshot: {
  weeklyTarget?: number;
  weeklyTargetAt?: string | null;
  months?: Record<string, string[]>;
  monthAt?: Record<string, string>;
}): Promise<void> {
  await putRecord("settings", {
    key: SETTINGS_KEY,
    weeklyTarget: validTarget(snapshot?.weeklyTarget),
    weeklyTargetAt:
      typeof snapshot?.weeklyTargetAt === "string" ? snapshot.weeklyTargetAt : isoNow(),
    months: isRecord(snapshot?.months) ? (snapshot.months as Record<string, string[]>) : {},
    monthAt: isRecord(snapshot?.monthAt) ? (snapshot.monthAt as Record<string, string>) : {},
    updatedAt: isoNow(),
  });
}

// Raw row access for the sync engine. Unlike replaceSettings, these preserve
// the stored updatedAt stamp (LWW needs the true clocks, not "now").
export async function readSettingsRow(): Promise<SettingsRow | null> {
  const row = await getRecord("settings", SETTINGS_KEY);
  return isRecord(row) ? (row as SettingsRow) : null;
}

export async function writeSettingsRow(row: Partial<SettingsRow>): Promise<void> {
  if (!isRecord(row)) return;
  await putRecord("settings", { ...(row as SettingsRow), key: SETTINGS_KEY }, "remote");
}

// React binding for the weekly target (Progress page, dashboard cards).
// Optimistic: the UI moves immediately, the subscription re-read confirms.
export function useWeeklyTarget(): [number, (value: number) => void, boolean] {
  const [target, setTargetState, ready] = useEntityState<number>(
    "settings",
    getWeeklyTarget,
    DEFAULT_WEEKLY_TARGET
  );
  const setTarget = (value: number) => {
    setTargetState(value);
    setWeeklyTarget(value);
  };
  return [target, setTarget, ready];
}
