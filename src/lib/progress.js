import { useState } from "react";

const KEY = "dsa-progress-v1";

export function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? {};
  } catch {
    return {};
  }
}

export function saveProgress(map) {
  localStorage.setItem(KEY, JSON.stringify(map));
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
  };

  const replaceAll = (map) => {
    setDone(map);
    saveProgress(map);
  };

  return { done, toggle, reset, replaceAll };
}
