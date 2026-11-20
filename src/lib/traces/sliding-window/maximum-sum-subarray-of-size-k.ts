import { z } from "zod";

import { compare, type Trace, type TraceDefinition, type TraceStep } from "../types";

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, k) => from + k);

/**
 * Add up the first k values, then slide: each step drops the value leaving on the left and adds the one entering on
 * the right, so every window costs O(1). Key steps: the first window, the first slide, every new best, the last
 * slide, and the result.
 */
export function maximumSumSubarrayOfSizeK(nums: number[], k: number): Trace {
  const steps: TraceStep[] = [];
  let sum = nums.slice(0, k).reduce((a, b) => a + b, 0);
  let best = sum;
  let bestFrom = 0;
  steps.push({
    kind: "first-window",
    key: true,
    pointers: { left: 0, right: k - 1 },
    active: range(0, k - 1),
    window: { from: 0, to: k - 1, value: sum },
    equation: { terms: nums.slice(0, k), operator: "+", result: sum },
    note: `Add up the first ${k} values: ${nums.slice(0, k).join(" + ")} = ${sum}. That's the best so far.`,
  });

  for (let right = k; right < nums.length; right++) {
    const left = right - k + 1;
    const leaving = nums[left - 1];
    sum += nums[right] - leaving;
    const op = compare(sum, best);
    const improved = op === ">";
    steps.push({
      kind: improved ? "new-best" : "slide",
      key: right === k || improved || right === nums.length - 1,
      pointers: { left, right },
      active: [right],
      rejected: [left - 1],
      window: { from: left, to: right, value: sum },
      // A bigger sum is good news even though the sign is ">"; a smaller one is just information.
      equation: {
        terms: [sum],
        operator: "+",
        result: sum,
        comparison: { op, target: best },
        tone: improved ? "positive" : "neutral",
      },
      note:
        `Slide right: drop ${leaving}, add ${nums[right]}. The sum becomes ${sum}` +
        (improved ? `, a new best (was ${best}).` : `, not more than the best, ${best}.`),
    });
    if (improved) {
      best = sum;
      bestFrom = left;
    }
  }

  steps.push({
    kind: "done",
    key: true,
    pointers: { left: bestFrom, right: bestFrom + k - 1 },
    found: range(bestFrom, bestFrom + k - 1),
    window: { from: bestFrom, to: bestFrom + k - 1, value: best },
    note: `Every window has been checked. The largest sum is ${best}, at positions ${bestFrom}–${bestFrom + k - 1}.`,
  });

  return {
    problem: "sliding-window/maximum-sum-subarray-of-size-k",
    row: { values: nums, display: "cards" },
    pointerNames: ["left", "right"],
    steps,
    answer: best,
    answerDisplay: String(best),
  };
}

export const maximumSumSubarrayOfSizeKTrace: TraceDefinition<[number[], number]> = {
  problem: "sliding-window/maximum-sum-subarray-of-size-k",
  exampleIndex: 0,
  exampleSource: "analogy",
  args: z
    .tuple([z.array(z.number().int().min(-99).max(99)).min(1).max(9), z.number().int().positive()])
    .refine(([nums, k]) => k <= nums.length, "k must be at most nums.length"),
  run: maximumSumSubarrayOfSizeK,
};
