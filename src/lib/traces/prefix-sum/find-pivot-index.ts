import { z } from "zod";

import { compare, type Trace, type TraceDefinition, type TraceStep } from "../types";
import { PrefixRow, sumSpan } from "./shared";

/**
 * Build the prefix row (cell i: the sum before item i; the last cell is the total). Then each index p is checked with
 * two lookups instead of two loops: left = prefix[p] − prefix[0], right = prefix[n] − prefix[p + 1] (the item itself
 * belongs to neither side). Unequal sides aren't bad news, just not the pivot (neutral); equal sides are (positive).
 * Key steps: the first and last cells built, and every index checked.
 */
export function findPivotIndex(nums: number[]): Trace {
  const n = nums.length;
  const prefix = new PrefixRow("prefix", "+", "prefix", n);
  prefix.set(0, 0);
  const steps: TraceStep[] = [];
  for (let i = 0; i < n; i++) {
    prefix.set(i + 1, prefix.get(i) + nums[i]);
    steps.push({
      kind: "build",
      key: i === 0 || i === n - 1,
      pointers: { i },
      active: [i],
      note:
        i === n - 1
          ? `prefix[${n}] = ${prefix.get(i)} + ${nums[i]} = ${prefix.get(n)}: the last cell is the whole total.`
          : `prefix[${i + 1}] = prefix[${i}] + ${nums[i]} = ${prefix.get(i + 1)}.`,
      equation: { terms: [prefix.get(i), nums[i]], operator: "+", result: prefix.get(i + 1) },
      prefix: [prefix.snapshot({ current: i + 1, reads: [i] })],
    });
  }
  let answer = -1;
  for (let p = 0; p < n; p++) {
    const left = sumSpan(prefix, 0, p);
    const right = sumSpan(prefix, p + 1, n);
    const balanced = left.value === right.value;
    steps.push({
      kind: balanced ? "pivot" : "check",
      key: true,
      pointers: { p },
      active: [p],
      ...(balanced ? { found: [p] } : {}),
      note: balanced
        ? `At ${p}: left = prefix[${p}] = ${left.value}, right = prefix[${n}] − prefix[${p + 1}] = ${right.value}. Equal: ${p} is the pivot.`
        : `At ${p}: left = prefix[${p}] = ${left.value}, right = prefix[${n}] − prefix[${p + 1}] = ${right.value}. Not equal; move on.`,
      equation: {
        terms: [left.value],
        operator: "+",
        result: left.value,
        comparison: { op: compare(left.value, right.value), target: right.value },
        tone: balanced ? "positive" : "neutral",
      },
      prefix: [prefix.snapshot({ reads: [...new Set([0, p, p + 1, n])], spans: [left, right] })],
    });
    if (balanced) {
      answer = p;
      break;
    }
  }
  return {
    problem: "prefix-sum/find-pivot-index",
    row: { values: nums, display: "cards" },
    pointerNames: ["i", "p"],
    steps,
    answer,
    answerDisplay: String(answer),
    ...(answer >= 0 ? { answerIndices: [answer] } : {}),
  };
}

export const findPivotIndexTrace: TraceDefinition<[number[]]> = {
  problem: "prefix-sum/find-pivot-index",
  exampleIndex: 0,
  exampleSource: "analogy",
  // Five items at most: two build scenes plus one scene per index checked.
  args: z.tuple([z.array(z.number().int().min(-99).max(99)).min(1).max(5)]),
  run: findPivotIndex,
};
