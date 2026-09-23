// Weekly target + monthly topic plans, persisted via src/lib/db.js (IndexedDB).
// Shape: { weeklyTarget: number, months: { "YYYY-MM": [topicSlug, ...] } }

import { useEffect, useState } from "react";
import { KEYS, getJSON, setJSON, subscribe } from "../db.js";

export const DEFAULT_WEEKLY_TARGET = 21;

async function load() {
  const v = await getJSON(KEYS.plans, {});
  if (v && typeof v === "object" && !Array.isArray(v)) return v;
  return {};
}

async function save(v) {
  await setJSON(KEYS.plans, v);
}

export async function getWeeklyTarget() {
  const v = (await load()).weeklyTarget;
  return Number.isInteger(v) && v > 0 ? v : DEFAULT_WEEKLY_TARGET;
}

export async function setWeeklyTarget(n) {
  const v = await load();
  v.weeklyTarget = n;
  await save(v);
}

// React binding: loads the stored target once, persists changes, and
// follows cloud-synced updates via db.js events.
export function useWeeklyTarget() {
  const [target, setTargetState] = useState(DEFAULT_WEEKLY_TARGET);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getWeeklyTarget().then((t) => {
      if (!cancelled) {
        setTargetState(t);
        setReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(
    () =>
      subscribe((key) => {
        if (key !== KEYS.plans) return;
        getWeeklyTarget().then((t) => setTargetState(t));
      }),
    []
  );

  const setTarget = async (n) => {
    setTargetState(n);
    await setWeeklyTarget(n);
  };

  return [target, setTarget, ready];
}
