import { useEffect, useState } from "react";
import { KEYS, getItem, setItem } from "./db.js";

function osTheme() {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function useTheme() {
  // Start from the OS preference so first paint looks right, then apply
  // the stored value once IndexedDB loads.
  const [theme, setTheme] = useState(osTheme);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getItem(KEYS.theme).then((saved) => {
      if (!cancelled && (saved === "light" || saved === "dark")) {
        setTheme(saved);
      }
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    if (ready) setItem(KEYS.theme, theme);
  }, [theme, ready]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return { theme, toggleTheme, setTheme, ready };
}
