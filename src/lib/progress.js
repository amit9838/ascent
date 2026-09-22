import { useState } from "react";
import { resetRewards } from "./rewards.js";
import { KEYS, getJSON, setJSON } from "./db.js";

export function loadProgress() {
  return getJSON(KEYS.progress, {}) ?? {};
}

export function saveProgress(map) {
  setJSON(KEYS.progress, map);
}

// done = { [workatProblemUrl]: true }
export function useProgress() {
  const [done, setDone] = useState(loadProgress);

  const toggle = (id) =>
    setDone((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      // store an ISO timestamp so weekly stats, streaks and the heatmap
      // can be derived; legacy `true` values still count as done.
      else next[id] = new Date().toISOString();
      saveProgress(next);
      return next;
    });

  const reset = () => {
    setDone({});
    saveProgress({});
    resetRewards();
  };

  const replaceAll = (map) => {
    setDone(map);
    saveProgress(map);
  };

  return { done, toggle, reset, replaceAll };
}
