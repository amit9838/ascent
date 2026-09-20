import Papa from "papaparse";

// Friendly names for the exact CSV header columns.
export const F = {
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
};

const cache = new Map();

export async function loadTopicCsv(csvFile) {
  if (cache.has(csvFile)) return cache.get(csvFile);
  const promise = (async () => {
    const res = await fetch(`${import.meta.env.BASE_URL}${csvFile}`);
    if (!res.ok) throw new Error(`Failed to load ${csvFile} (HTTP ${res.status})`);
    const text = await res.text();
    const { data, errors } = Papa.parse(text, { header: true, skipEmptyLines: true });
    if (errors.length) console.warn(`CSV parse warnings for ${csvFile}:`, errors);
    return data;
  })();
  cache.set(csvFile, promise);
  return promise;
}
