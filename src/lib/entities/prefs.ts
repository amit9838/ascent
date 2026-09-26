// E13 DevicePrefs (docs/schema-v3-plan.md §2): device-local preferences
// in the `prefs` store — { name, value, updatedAt } rows keyed by name.
// Never synced, never leave the device. Rows: theme, qotd, qotdIgnored,
// topicsView.

import { useEffect, useState } from "react";
import { deleteRecord, getRecord, putRecord } from "../store/records.ts";
import { useEntityState } from "../store/useEntityState.ts";
import type { StoreMap } from "../store/types.ts";

type PrefName = StoreMap["prefs"]["name"];
type Theme = "light" | "dark";
export type TopicsView = "grid" | "list";

export async function getPref(name: PrefName, fallback: unknown = null): Promise<unknown> {
  const row = await getRecord("prefs", name);
  if (!row || !("value" in row)) return fallback;
  return row.value;
}

export async function setPref(name: PrefName, value: unknown): Promise<void> {
  await putRecord("prefs", { name, value, updatedAt: new Date().toISOString() });
}

export async function removePref(name: PrefName): Promise<void> {
  await deleteRecord("prefs", name);
}

function osTheme(): Theme {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

// React binding for appearance. Starts from the OS preference so first
// paint looks right, then applies the stored value once IDB loads.
export function useTheme() {
  const load = async (): Promise<Theme> => {
    const saved = await getPref("theme");
    return saved === "light" || saved === "dark" ? saved : osTheme();
  };
  const [theme, setTheme, ready] = useEntityState<Theme>("prefs", load, osTheme());

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    if (ready) setPref("theme", theme); // persists through the subscription
  }, [theme, ready]);

  const toggleTheme = () =>
    setTheme((current) => (current === "dark" ? "light" : "dark"));

  return { theme, toggleTheme, setTheme, ready };
}

// React binding for the Topics page layout (grid cards vs. compact rows).
export function useTopicsView() {
  const load = async (): Promise<TopicsView> => {
    const saved = await getPref("topicsView");
    return saved === "grid" || saved === "list" ? saved : "grid";
  };
  const [view, setView, ready] = useEntityState<TopicsView>("prefs", load, "grid");

  useEffect(() => {
    if (ready) setPref("topicsView", view); // persists through the subscription
  }, [view, ready]);

  return { view, setView };
}
