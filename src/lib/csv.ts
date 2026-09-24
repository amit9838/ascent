import Papa from "papaparse";
import { cached } from "./cache.js";

// Friendly names for the exact CSV header columns.
export const F = {
  id: "id",
  num: "#",
  name: "Problem Name",
  link: "Link",
  score: "Score",
  accuracy: "Accuracy",
  difficulty: "Difficulty",
  companies: "Companies",
  lc: "Equivalent (LeetCode)",
  lcLink: "LeetCode Link",
  other: "Other Platform",
  otherLink: "Other Platform Link",
  notes: "Notes",
} as const;

// One parsed CSV row: every cell is a string.
export type CsvRow = Record<string, string>;

// CSVs are static per deployment — cache for the whole session and
// dedupe concurrent loads of the same file.
export function loadTopicCsv(csvFile: string): Promise<CsvRow[]> {
  return cached<CsvRow[]>(
    `csv:${csvFile}`,
    async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}${csvFile}`);
      if (!res.ok) throw new Error(`Failed to load ${csvFile} (HTTP ${res.status})`);
      const text = await res.text();
      const { data, errors } = Papa.parse<CsvRow>(text, { header: true, skipEmptyLines: true });
      if (errors.length) console.warn(`CSV parse warnings for ${csvFile}:`, errors);
      return data;
    },
    { ttl: Infinity, tags: ["csv"] }
  );
}
