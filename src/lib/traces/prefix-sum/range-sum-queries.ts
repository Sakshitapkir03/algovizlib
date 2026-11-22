import { z } from "zod";

import type { Trace, TraceDefinition, TraceStep } from "../types";
import { PrefixRow, sumSpan } from "./shared";

/**
 * Build the prefix row once: `prefix[0] = 0`, `prefix[i + 1] = prefix[i] + nums[i]`, so cell i sits on the boundary
 * before item i. Then every query [l, r] is one subtraction, `prefix[r + 1] − prefix[l]`: the total up to the end of
 * the range minus the total before it, instead of re-adding the range. No comparison here, so no tones. Key steps: the
 * first and last cells built, and every query.
 */
export function rangeSumQueries(nums: number[], queries: [number, number][]): Trace {
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
      note: `prefix[${i + 1}] = prefix[${i}] + ${nums[i]} = ${prefix.get(i + 1)}: the total of the first ${i + 1} item${i === 0 ? "" : "s"}.`,
      equation: { terms: [prefix.get(i), nums[i]], operator: "+", result: prefix.get(i + 1) },
      prefix: [prefix.snapshot({ current: i + 1, reads: [i] })],
    });
  }
  const answers: number[] = [];
  queries.forEach(([l, r]) => {
    const span = sumSpan(prefix, l, r + 1);
    answers.push(span.value);
    steps.push({
      kind: "query",
      key: true,
      pointers: { l, r },
      note: `sum(${l}..${r}) = prefix[${r + 1}] − prefix[${l}] = ${prefix.get(r + 1)} − ${prefix.get(l)} = ${span.value}: one subtraction, however long the range.`,
      equation: { terms: [prefix.get(r + 1), prefix.get(l)], operator: "-", result: span.value },
      prefix: [prefix.snapshot({ reads: [l, r + 1], spans: [span] })],
    });
  });
  return {
    problem: "prefix-sum/range-sum-queries",
    row: { values: nums, display: "cards" },
    pointerNames: ["i", "l", "r"],
    steps,
    answer: answers,
    answerDisplay: `[${answers.join(", ")}]`,
  };
}

export const rangeSumQueriesTrace: TraceDefinition<[number[], [number, number][]]> = {
  problem: "prefix-sum/range-sum-queries",
  exampleIndex: 0,
  exampleSource: "analogy",
  args: z
    .tuple([
      z.array(z.number().int().min(-99).max(99)).min(1).max(7),
      z
        .array(z.tuple([z.number().int().min(0), z.number().int().min(0)]))
        .min(1)
        .max(4),
    ])
    .refine(([nums, qs]) => qs.every(([l, r]) => l <= r && r < nums.length), "each query is 0 ≤ l ≤ r < n"),
  run: rangeSumQueries,
};
