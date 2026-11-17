import { describe, expect, it } from "vitest";

import { twoPointers } from "@/lib/engines";

describe("twoPointers engine", () => {
  it("finds a pair and records every move", () => {
    const run = twoPointers([4, 9, 14, 21, 28, 36, 45], 50);
    expect(run.pair).toEqual([2, 5]);
    expect(run.steps.map((s) => [s.left, s.right, s.sum, s.comparison, s.action])).toEqual([
      [0, 6, 49, "<", "move-left"],
      [1, 6, 54, ">", "move-right"],
      [1, 5, 45, "<", "move-left"],
      [2, 5, 50, "=", "found"],
    ]);
    expect(run.states).toEqual([
      { left: 0, right: 6 },
      { left: 1, right: 6 },
      { left: 1, right: 5 },
      { left: 2, right: 5 },
    ]);
  });

  it("returns null when no pair exists, after the pointers meet", () => {
    const run = twoPointers([1, 2, 3, 9], 100);
    expect(run.pair).toBeNull();
    expect(run.steps.every((s) => s.action === "move-left")).toBe(true);
    expect(run.states.at(-1)).toEqual({ left: 3, right: 3 });
  });

  it("handles duplicate values", () => {
    expect(twoPointers([5, 5], 10).pair).toEqual([0, 1]);
    expect(twoPointers([1, 3, 3, 3, 8], 6).pair).toEqual([1, 3]);
  });

  it("works on the minimum length of two", () => {
    expect(twoPointers([2, 7], 9).pair).toEqual([0, 1]);
    expect(twoPointers([2, 7], 10).pair).toBeNull();
  });

  it("never pairs an element with itself", () => {
    expect(twoPointers([5], 10).pair).toBeNull();
    expect(twoPointers([], 0).pair).toBeNull();
  });

  it("rejects unsorted input", () => {
    expect(() => twoPointers([3, 1, 2], 4)).toThrow(/sorted/);
  });
});
