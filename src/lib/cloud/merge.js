// Pure merge strategies for syncing local IndexedDB state with Firestore.
// No I/O — trivially unit-testable.
//
// Cloud docs store values as JSON strings (Firestore forbids "/", "*", etc.
// in map field names, and progress is keyed by URL), so callers parse
// before merging and stringify after.

// done maps: { [url]: ISO timestamp | true (legacy) }.
// Union, per-problem newer-timestamp-wins. A solve is never lost; an undo
// (delete) on one device while solved on another keeps it solved (safe default).
export function mergeProgress(local = {}, remote = {}) {
  const out = { ...local };
  for (const [k, rv] of Object.entries(remote)) {
    const lv = out[k];
    if (lv === undefined) {
      out[k] = rv;
    } else if (typeof rv === "string") {
      if (typeof lv !== "string" || rv > lv) out[k] = rv; // timestamp beats legacy `true` and older stamps
    }
    // remote `true` (legacy) never beats a local timestamp
  }
  return out;
}

const RANK = { collected: 2, earned: 1 };

function mergeStatusMap(local = {}, remote = {}) {
  const out = { ...local };
  for (const [k, rv] of Object.entries(remote)) {
    if (RANK[rv] > (RANK[out[k]] ?? 0)) out[k] = rv;
  }
  return out;
}

// rewards: { daily: {...}, weekly: {...} } — union, collected > earned.
export function mergeRewards(local, remote) {
  const l = local ?? {};
  const r = remote ?? {};
  return {
    daily: mergeStatusMap(l.daily, r.daily),
    weekly: mergeStatusMap(l.weekly, r.weekly),
  };
}

// Last-write-wins by updatedAt (ms). Used for notes and plans.
export function lwwNewer(remoteUpdatedAtMs, localLastWriteMs) {
  return remoteUpdatedAtMs > (localLastWriteMs ?? 0);
}
