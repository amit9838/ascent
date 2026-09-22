import { useCallback, useEffect, useState } from "react";
import { resetRewards } from "./rewards.js";
import { KEYS, getJSON, setJSON } from "./db.js";

export async function loadProgress() {
  return (await getJSON(KEYS.progress, {})) ?? {};
}

export async function saveProgress(map) {
  await setJSON(KEYS.progress, map);
}

// done = { [workatProblemUrl]: ISO timestamp | true (legacy) }
// done starts as null until IndexedDB finishes loading; App gates on `ready`.
export function useProgress() {
  const [done, setDone] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadProgress().then((map) => {
      if (!cancelled) {
        setDone(map);
        setReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = useCallback((id) => {
    setDone((prev) => {
      const base = prev ?? {};
      const next = { ...base };
      if (next[id]) delete next[id];
      // store an ISO timestamp so weekly stats, streaks and the heatmap
      // can be derived; legacy `true` values still count as done.
      else next[id] = new Date().toISOString();
      saveProgress(next);
      return next;
    });
  }, []);

  const reset = useCallback(async () => {
    setDone({});
    await saveProgress({});
    await resetRewards();
  }, []);

  const replaceAll = useCallback(async (map) => {
    setDone(map);
    await saveProgress(map);
  }, []);

  return { done, ready, toggle, reset, replaceAll };
}
