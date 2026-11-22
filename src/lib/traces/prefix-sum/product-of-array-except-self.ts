import { z } from "zod";

import type { Trace, TraceDefinition, TraceStep } from "../types";
import { PrefixRow } from "./shared";

/**
 * "Everything except item i" is everything before it times everything after it. The left pass fills `left[i]`, the
 * product of the items before boundary i (left[0] = 1). The right pass walks back with `right[i + 1]`, the product of
 * the items after item i (right[n] = 1), and each answer is the two cells on either side of item i:
 * out[i] = left[i] × right[i + 1]. No division, so a zero is no problem. No comparisons, so no tones. Key steps: the
 * first and last left cells, the first and last answers, and one in the middle.
 */
export function productOfArrayExceptSelf(nums: number[]): Trace {
  const n = nums.length;
  const left = new PrefixRow("left", "×", "prefix", n);
  const right = new PrefixRow("right", "×", "suffix", n);
  const steps: TraceStep[] = [];
  left.set(0, 1);
  for (let i = 0; i < n; i++) {
    if (i > 0) left.set(i, left.get(i - 1) * nums[i - 1]);
    steps.push({
      kind: "left",
      key: i === 0 || i === n - 1,
      pointers: { i },
      note:
        i === 0
          ? "Nothing comes before item 0: left[0] = 1, the empty product."
          : `left[${i}] = left[${i - 1}] × ${nums[i - 1]} = ${left.get(i)}: everything before item ${i}.`,
      ...(i > 0
        ? { equation: { terms: [left.get(i - 1), nums[i - 1]], operator: "×" as const, result: left.get(i) } }
        : {}),
      prefix: [left.snapshot({ current: i, ...(i > 0 ? { reads: [i - 1] } : {}) }), right.snapshot()],
    });
  }
  const out = new Array<number>(n);
  right.set(n, 1);
  for (let i = n - 1; i >= 0; i--) {
    if (i < n - 1) right.set(i + 1, right.get(i + 2) * nums[i + 1]);
    out[i] = left.get(i) * right.get(i + 1);
    steps.push({
      kind: "right",
      key: i === n - 1 || i === 0 || i === Math.floor(n / 2) - 1,
      pointers: { i },
      active: [i],
      note: `${i === n - 1 ? "Nothing comes after the last item: right = 1. " : `right[${i + 1}] = ${nums[i + 1]} × right[${i + 2}] = ${right.get(i + 1)}. `}out[${i}] = left[${i}] × right[${i + 1}] = ${left.get(i)} × ${right.get(i + 1)} = ${out[i]}: everything except item ${i}.`,
      equation: { terms: [left.get(i), right.get(i + 1)], operator: "×", result: out[i] },
      prefix: [
        left.snapshot({ reads: [i], spans: [{ from: 0, to: i, value: left.get(i) }] }),
        right.snapshot({
          current: i + 1,
          reads: [i + 1],
          spans: [{ from: i + 1, to: n, value: right.get(i + 1) }],
        }),
      ],
    });
  }
  return {
    problem: "prefix-sum/product-of-array-except-self",
    row: { values: nums, display: "cards" },
    pointerNames: ["i"],
    steps,
    answer: out,
    answerDisplay: `[${out.join(", ")}]`,
  };
}

export const productOfArrayExceptSelfTrace: TraceDefinition<[number[]]> = {
  problem: "prefix-sum/product-of-array-except-self",
  exampleIndex: 0,
  exampleSource: "analogy",
  args: z.tuple([z.array(z.number().int().min(-9).max(9)).min(2).max(5)]),
  run: productOfArrayExceptSelf,
};
