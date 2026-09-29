// Unit tests for the Sapphire Crown rules (crowns.ts) and heatmap today flag.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CROWN_DAYS, crownDays, crownRunLength, liveCrownRun, perfectWeekCount, scanCrowns } from "./crowns.ts";
import { heatmapWeeks } from "./activity.ts";

const noon = (key: string): Date => new Date(`${key}T12:00:00`);

describe("scanCrowns", () => {
  it("awards a crown for 3 consecutive star days starting mid-week", () => {
    // 2026-09-30 is a Wednesday.
    const scan = scanCrowns(["2026-09-30", "2026-10-01", "2026-10-02"], []);
    assert.deepEqual(scan.starts, ["2026-09-30"]);
    assert.deepEqual(scan.open, []);
  });

  it("needs consecutive days — a gap resets the run", () => {
    const scan = scanCrowns(["2026-09-01", "2026-09-02", "2026-09-04", "2026-09-05"], []);
    assert.deepEqual(scan.starts, []);
    assert.deepEqual(scan.open, ["2026-09-04", "2026-09-05"]);
  });

  it("splits a long run into back-to-back blocks", () => {
    const days = crownDays("2026-09-01").concat(crownDays("2026-09-04"), ["2026-09-07"]);
    const scan = scanCrowns(days, []);
    assert.deepEqual(scan.starts, ["2026-09-01", "2026-09-04"]);
    assert.deepEqual(scan.open, ["2026-09-07"]);
  });

  it("crosses month boundaries", () => {
    assert.deepEqual(scanCrowns(["2026-09-29", "2026-09-30", "2026-10-01"], []).starts, [
      "2026-09-29",
    ]);
  });

  it("is idempotent and never re-slices awarded crowns", () => {
    // Crown already awarded for 2–4; a backfilled star on the 1st must not
    // shift it to 1–3 or mint a second crown.
    const days = ["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04"];
    const scan = scanCrowns(days, ["2026-09-02"]);
    assert.deepEqual(scan.starts, []);
    assert.deepEqual(scan.open, []);
  });

  it("ignores duplicate and unsorted input", () => {
    const scan = scanCrowns(["2026-09-03", "2026-09-01", "2026-09-02", "2026-09-01"], []);
    assert.deepEqual(scan.starts, ["2026-09-01"]);
  });
});

describe("liveCrownRun", () => {
  const days = ["2026-09-28", "2026-09-29"];

  it("counts a run ending today", () => {
    assert.deepEqual(liveCrownRun(days, [], noon("2026-09-29")), days);
  });

  it("keeps a run ending yesterday alive (today still pending)", () => {
    assert.deepEqual(liveCrownRun(days, [], noon("2026-09-30")), days);
  });

  it("drops a run that ended before yesterday", () => {
    assert.deepEqual(liveCrownRun(days, [], noon("2026-10-01")), []);
  });
});

describe("crownRunLength", () => {
  it("stays full on the day a crown closes, then resets", () => {
    const days = crownDays("2026-09-28");
    assert.equal(crownRunLength(days, ["2026-09-28"], noon("2026-09-30")), CROWN_DAYS);
    assert.equal(crownRunLength(days, ["2026-09-28"], noon("2026-10-01")), 0);
  });

  it("counts the live run otherwise", () => {
    assert.equal(crownRunLength(["2026-09-29", "2026-09-30"], [], noon("2026-09-30")), 2);
  });
});

describe("perfectWeekCount", () => {
  it("counts only full Monday–Sunday weeks", () => {
    const week = Array.from({ length: 7 }, (_, i) => `2026-09-${String(21 + i).padStart(2, "0")}`);
    assert.equal(perfectWeekCount(week), 1);
    assert.equal(perfectWeekCount(week.slice(1)), 0);
    // 7 consecutive days starting Wednesday span two weeks — not perfect.
    assert.equal(perfectWeekCount(crownDays("2026-09-23").concat(crownDays("2026-09-26"), ["2026-09-29"])), 0);
  });
});

describe("heatmapWeeks", () => {
  it("marks exactly one cell as today", () => {
    const cols = heatmapWeeks({}, {}, 15, noon("2026-09-30"));
    const today = cols.flat().filter((d) => d.isToday);
    assert.equal(today.length, 1);
    assert.equal(today[0].key, "2026-09-30");
  });
});
