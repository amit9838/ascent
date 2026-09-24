// Unit tests for the E1 problem builders (problemRows.ts).
// Kept for reference — there is currently no test runner configured
// (`npm test` was removed along with tests/).

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildProblemIndex,
  buildTopicProblems,
  rowToProblem,
} from "./problemRows.js";

function csvRow(overrides = {}) {
  return {
    id: "a1b2c3d4e5f60718",
    "#": "3",
    "Problem Name": "Two Sum",
    Link: "https://workat.tech/problem-solving/practice/two-sum/index.html",
    Score: "30",
    Accuracy: "54%",
    Difficulty: "Easy",
    Companies: "Google",
    "Equivalent (LeetCode)": "Two Sum (1)",
    "LeetCode Link": "https://leetcode.com/problems/two-sum/",
    "Other Platform": "",
    "Other Platform Link": "",
    Notes: "Classic",
    ...overrides,
  };
}

describe("rowToProblem", () => {
  it("maps every E1 field with trimmed, typed values", () => {
    const problem = rowToProblem("arrays", csvRow());
    assert.equal(problem.id, "a1b2c3d4e5f60718");
    assert.equal(problem.seq, 3);
    assert.equal(problem.topic, "arrays");
    assert.equal(problem.name, "Two Sum");
    assert.equal(problem.score, 30);
    assert.equal(problem.difficulty, "easy"); // normalized to lowercase
    assert.equal(problem.lcName, "Two Sum (1)");
    assert.equal(problem.note, "Classic");
  });

  it("falls back to medium for unknown difficulty", () => {
    assert.equal(rowToProblem("arrays", csvRow({ Difficulty: "Nightmare" })).difficulty, "medium");
    assert.equal(rowToProblem("arrays", csvRow({ Difficulty: "" })).difficulty, "medium");
  });

  it("tolerates missing columns without throwing", () => {
    const problem = rowToProblem("arrays", {});
    assert.equal(problem.id, "");
    assert.equal(problem.seq, 0);
    assert.equal(problem.score, 0);
    assert.equal(problem.difficulty, "medium");
  });
});

describe("buildTopicProblems", () => {
  it("sorts by seq and drops rows without an id", () => {
    const problems = buildTopicProblems("arrays", [
      csvRow({ id: "bbbbbbbbbbbbbbbb", "#": "2", "Problem Name": "B" }),
      csvRow({ id: "", "#": "1", "Problem Name": "No id" }),
      csvRow({ id: "aaaaaaaaaaaaaaaa", "#": "1", "Problem Name": "A" }),
    ]);
    assert.deepEqual(
      problems.map((p) => p.name),
      ["A", "B"]
    );
  });

  it("handles null/undefined row lists", () => {
    assert.deepEqual(buildTopicProblems("arrays", null), []);
    assert.deepEqual(buildTopicProblems("arrays", undefined), []);
  });
});

describe("buildProblemIndex (shared problems across topics)", () => {
  const sharedId = "cccccccccccccccc";
  const sharedUrl = "https://workat.tech/problem-solving/practice/three-sum/index.html";
  const index = buildProblemIndex([
    ["arrays", buildTopicProblems("arrays", [
      csvRow({ id: "aaaaaaaaaaaaaaaa", "#": "1", "Problem Name": "A", Link: "https://example.com/a" }),
    ])],
    // Same problem listed under two topics shares one id, shows up twice.
    ["hashing", buildTopicProblems("hashing", [
      csvRow({ id: sharedId, "#": "1", "Problem Name": "Three Sum", Link: sharedUrl }),
    ])],
    ["two-pointers", buildTopicProblems("two-pointers", [
      csvRow({ id: sharedId, "#": "2", "Problem Name": "Three Sum", Link: sharedUrl }),
    ])],
  ]);

  it("counts unique problems, not rows", () => {
    assert.equal(index.total, 2);
    assert.equal(index.byId.size, 2);
  });

  it("lists the shared problem under both topics (same id, per-topic seq)", () => {
    assert.equal(index.byTopic.get("hashing").length, 1);
    assert.equal(index.byTopic.get("two-pointers").length, 1);
    assert.equal(index.byTopic.get("hashing")[0].id, sharedId);
    assert.equal(index.byTopic.get("two-pointers")[0].id, sharedId);
    assert.equal(index.byTopic.get("hashing")[0].seq, 1);
    assert.equal(index.byTopic.get("two-pointers")[0].seq, 2);
  });

  it("resolves shared URLs to one id via byUrl (first topic wins)", () => {
    assert.equal(index.byUrl.get(sharedUrl), sharedId);
    assert.equal(index.byUrl.get("https://example.com/a"), "aaaaaaaaaaaaaaaa");
    assert.equal(index.byUrl.get("https://example.com/gone"), undefined);
  });
});
