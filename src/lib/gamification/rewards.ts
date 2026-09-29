// E6 RewardEvent entity + rewards engine (docs/schema-v3-plan.md §2).
//
// Daybreak Stars (hit the daily target) and Sapphire Crowns (a star on
// CROWN_DAYS consecutive days, any start day — rules in crowns.ts). One
// record per period:
//   { id: "YYYY-MM-DD:daily" | "YYYY-MM-DD:crown" (first day of the run),
//     kind, periodStart, target, status: earned|collected, earnedAt,
//     updatedAt, isRevoked? }
// Legacy "weekly" rows (Monday-keyed perfect weeks) are ignored.
//
// `target` is snapshotted at earn time so lowering the weekly target later
// never un-earns a star. Status only moves earned → collected (manual Claim
// in the UI); the sync engine merges records with plain per-record LWW.
//
// Returns the { daily, crowns } status view the Rewards UI renders.
// `now` overrides exist for testing.

import { dayKey, dayPoints } from "./activity.ts";
import { scanCrowns } from "./crowns.ts";
import { deleteRecord, getAllRecords, getRecord, putRecord } from "../store/records.ts";
import type { RewardEventRecord } from "../store/types.ts";

const STORE = "rewardEvents";

export type RewardStatus = "earned" | "collected";

type RewardKind = "daily" | "crown";

// Status view for the UI: { daily: {date: status}, crowns: {runStart: status} }.
export interface RewardStatusView {
  daily: Record<string, RewardStatus>;
  crowns: Record<string, RewardStatus>;
}

function isoNow(): string {
  return new Date().toISOString();
}

function eventId(kind: string, periodKey: string): string {
  return `${periodKey}:${kind}`;
}

// Revoked (reset) on this device? Checks the current flag and the
// pre-flag legacy field so old rows keep reading correctly.
function isEventRevoked(event: { isRevoked?: boolean; deleted?: boolean }): boolean {
  return event.isRevoked === true || event.deleted === true;
}

export function dailyTarget(weeklyTarget: number): number {
  return Math.max(1, Math.ceil(weeklyTarget / 7));
}

async function earnEvent(
  kind: RewardKind,
  periodKey: string,
  target: number,
  at: string
): Promise<void> {
  const id = eventId(kind, periodKey);
  const existing = await getRecord(STORE, id);
  if (existing && !isEventRevoked(existing)) return; // already earned — never downgrade
  await putRecord(STORE, {
    id,
    kind,
    periodStart: periodKey,
    target,
    status: "earned",
    earnedAt: at,
    updatedAt: at,
    isRevoked: false,
  });
}

async function loadStatusView(): Promise<RewardStatusView> {
  const daily: Record<string, RewardStatus> = {};
  const crowns: Record<string, RewardStatus> = {};
  for (const event of await getAllRecords(STORE)) {
    if (!event || isEventRevoked(event)) continue;
    if (event.status !== "earned" && event.status !== "collected") continue;
    if (event.kind === "daily") daily[event.periodStart] = event.status;
    else if (event.kind === "crown") crowns[event.periodStart] = event.status;
  }
  return { daily, crowns };
}

// Marks newly-earned rewards as "earned" (never touches "collected").
// Returns the status view. `now` override exists for testing.
export async function refreshRewards(
  solves: Record<string, unknown>,
  points: Record<string, number>,
  weeklyTarget: number,
  now: Date = new Date()
): Promise<RewardStatusView> {
  const target = dailyTarget(weeklyTarget);
  const counts = dayPoints(solves, points);
  const todayK = dayKey(now);
  const stamped = isoNow();

  for (const [day, dayTotal] of Object.entries(counts)) {
    if (day <= todayK && dayTotal >= target) {
      await earnEvent("daily", day, target, stamped);
    }
  }

  // Crowns derive from star records (earned or collected), not raw counts,
  // so a star earned under an older target still counts.
  const view = await loadStatusView();
  const { starts } = scanCrowns(Object.keys(view.daily), Object.keys(view.crowns));
  for (const start of starts) await earnEvent("crown", start, target, stamped);

  return loadStatusView();
}

async function collect(kind: RewardKind, periodKey: string): Promise<RewardStatusView> {
  const event = await getRecord(STORE, eventId(kind, periodKey));
  if (event && !isEventRevoked(event) && event.status === "earned") {
    await putRecord(STORE, { ...event, status: "collected", updatedAt: isoNow() });
  }
  return loadStatusView();
}

export function collectDaily(dayKeyStr: string): Promise<RewardStatusView> {
  return collect("daily", dayKeyStr);
}

export function collectCrown(runStart: string): Promise<RewardStatusView> {
  return collect("crown", runStart);
}

// Tombstone every event (reset flow) so other devices drop them too.
export async function resetRewardEvents(): Promise<void> {
  const now = isoNow();
  const rows = await getAllRecords(STORE);
  await Promise.all(
    rows
      .filter((event) => event && !isEventRevoked(event))
      .map((event) => putRecord(STORE, { ...event, isRevoked: true, updatedAt: now }))
  );
}

// Pinned counting rule (was scattered across profile summary + UI):
// collected events only.
export async function getRewardCounts(): Promise<{ stars: number; crowns: number }> {
  const { daily, crowns } = await loadStatusView();
  const collected = (status: RewardStatus) => status === "collected";
  return {
    stars: Object.values(daily).filter(collected).length,
    crowns: Object.values(crowns).filter(collected).length,
  };
}

// Backup export: live events only (tombstones carry no restore value).
export async function exportRewardEvents(): Promise<RewardEventRecord[]> {
  const rows = await getAllRecords(STORE);
  return rows.filter((event) => event && event.id && !isEventRevoked(event));
}

// Backup import: hard-replace local events with the validated array.
// Imported updatedAt stamps are kept as-is so sync merges them at face value.
export async function replaceRewardEvents(events: unknown[] | undefined): Promise<void> {
  const rows = await getAllRecords(STORE);
  await Promise.all(rows.map((event) => event && deleteRecord(STORE, event.id)));
  const valid = (events ?? []).filter(
    (event): event is RewardEventRecord =>
      Boolean(event) && typeof (event as RewardEventRecord)?.id === "string"
  );
  await Promise.all(
    valid.map((event) => putRecord(STORE, { ...event, isRevoked: event.isRevoked === true }))
  );
}
