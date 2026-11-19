import { z } from "zod";

import type { Trace, TraceDefinition } from "../types";
import { runMergeSort, show } from "./merge-steps";

/**
 * Merge sort, top-down. Key steps: the split down to single values; one merge in detail (the left half's top
 * merge of two sorted runs: each comparison of the fronts, then the merged run); the right half summarized by its
 * merged run; the final merge's first comparison; and the finished array.
 */
export function mergeSort(nums: number[]): Trace {
  const { steps, sorted } = runMergeSort(nums, { countInversions: false });
  const n = nums.length;
  if (n > 1) {
    steps[0].key = true;
    const mid = Math.floor((n - 1) / 2);
    // The detailed merge: the left half's top merge (two sorted runs, not two single values).
    const leftKey = `0-${mid}`;
    const detail = mid > 0 ? leftKey : `0-${n - 1}`;
    const detailTakes = steps.flatMap((s, i) =>
      (s.kind === "take-left" || s.kind === "take-right") &&
      s.range &&
      `${s.range.from}-${s.range.to}` === detail
        ? [i]
        : [],
    );
    for (const i of detailTakes.slice(0, 2)) steps[i].key = true;
    const keyMerged = (from: number, to: number) => {
      const i = steps.findIndex((s) => s.kind === "merged" && s.range?.from === from && s.range.to === to);
      if (i >= 0) steps[i].key = true;
    };
    keyMerged(0, mid);
    keyMerged(mid + 1, n - 1);
    const finalTake = steps.findIndex(
      (s) =>
        (s.kind === "take-left" || s.kind === "take-right") && s.range?.from === 0 && s.range.to === n - 1,
    );
    if (finalTake >= 0) steps[finalTake].key = true;
  }
  return {
    problem: "sorting/merge-sort",
    row: { values: [...nums], display: "bars" },
    pointerNames: ["i", "j"],
    steps,
    answer: sorted,
    answerDisplay: show(sorted),
  };
}

export const mergeSortTrace: TraceDefinition<[number[]]> = {
  problem: "sorting/merge-sort",
  exampleIndex: 0,
  exampleSource: "analogy",
  args: z.tuple([z.array(z.number().int().nonnegative()).min(1).max(8)]),
  run: mergeSort,
};
