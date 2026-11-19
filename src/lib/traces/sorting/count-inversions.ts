import { z } from "zod";

import type { Trace, TraceDefinition } from "../types";
import { runMergeSort } from "./merge-steps";

/**
 * Count inversions by merge sort. Each half's own inversions are counted while it is sorted; then merging two
 * sorted halves, taking a value from the right half adds every value still waiting on the left at once. Key steps:
 * the split, both halves sorted (one summary), and the final merge's first three takes (a right take that counts
 * several at once comes first in the chosen example), then the total.
 */
export function countInversions(nums: number[]): Trace {
  const { steps, inversions } = runMergeSort(nums, { countInversions: true });
  const n = nums.length;
  if (n > 1) {
    steps[0].key = true;
    const mid = Math.floor((n - 1) / 2);
    const rightMerged = steps.findIndex(
      (s) => s.kind === "merged" && s.range?.from === mid + 1 && s.range.to === n - 1,
    );
    if (rightMerged >= 0) steps[rightMerged].key = true;
    const finalTakes = steps.flatMap((s, i) =>
      (s.kind === "take-left" || s.kind === "take-right") && s.range?.from === 0 && s.range.to === n - 1
        ? [i]
        : [],
    );
    for (const i of finalTakes.slice(0, 3)) steps[i].key = true;
    // The insight must get its own scene: the take that counts the most at once.
    const most = finalTakes.reduce<number | undefined>(
      (best, i) =>
        best === undefined || (steps[i].counter?.delta ?? 0) > (steps[best].counter?.delta ?? 0) ? i : best,
      undefined,
    );
    if (most !== undefined) steps[most].key = true;
  }
  return {
    problem: "sorting/count-inversions",
    row: { values: [...nums], display: "bars" },
    pointerNames: ["i", "j"],
    steps,
    answer: inversions,
    answerDisplay: String(inversions),
  };
}

export const countInversionsTrace: TraceDefinition<[number[]]> = {
  problem: "sorting/count-inversions",
  exampleIndex: 0,
  exampleSource: "analogy",
  args: z.tuple([z.array(z.number().int().nonnegative()).min(1).max(8)]),
  run: countInversions,
};
