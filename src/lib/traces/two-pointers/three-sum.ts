import { z } from "zod";

import { compare, type Trace, type TraceDefinition, type TraceStep } from "../types";

/**
 * Sort, then fix each anchor `i` and run pair-sum with `left`/`right` on the rest, looking for a total of 0.
 * Duplicate anchors and duplicate inner values are skipped so each triplet appears once.
 * Key steps: the sort, every triplet found, the first "too small", the first "too big", the first duplicate skip.
 */
export function threeSum(nums: number[]): Trace {
  const sorted = [...nums].sort((a, b) => a - b);
  const steps: TraceStep[] = [];
  const triplets: number[][] = [];
  const first = { small: true, big: true, skip: true };

  steps.push({
    kind: "sort",
    key: true,
    pointers: {},
    note: `Sort the numbers: [${sorted.join(", ")}]. Now a fixed anchor plus a pair-sum search finds each triplet.`,
  });

  for (let i = 0; i < sorted.length - 2; i++) {
    if (i > 0 && sorted[i] === sorted[i - 1]) {
      steps.push({
        kind: "skip-anchor",
        key: first.skip,
        pointers: { i },
        active: [i],
        note: `Anchor ${sorted[i]} at index ${i} repeats the previous anchor, so skip it to avoid duplicate triplets.`,
      });
      first.skip = false;
      continue;
    }
    let left = i + 1;
    let right = sorted.length - 1;
    while (left < right) {
      const sum = sorted[i] + sorted[left] + sorted[right];
      const op = compare(sum, 0);
      const base = {
        pointers: { i, left, right },
        equation: {
          terms: [sorted[i], sorted[left], sorted[right]],
          operator: "+" as const,
          result: sum,
          comparison: { op, target: 0 },
        },
        active: [i, left, right],
      };
      if (op === "<") {
        steps.push({
          ...base,
          kind: "too-small",
          key: first.small,
          note: `${base.equation.terms.join(" + ")} = ${sum} < 0: too small, so move left right.`,
        });
        first.small = false;
        left++;
      } else if (op === ">") {
        steps.push({
          ...base,
          kind: "too-big",
          key: first.big,
          note: `${base.equation.terms.join(" + ")} = ${sum} > 0: too big, so move right left.`,
        });
        first.big = false;
        right--;
      } else {
        const triplet = [sorted[i], sorted[left], sorted[right]];
        triplets.push(triplet);
        steps.push({
          ...base,
          kind: "found",
          key: true,
          found: [i, left, right],
          note: `${triplet.join(" + ")} = 0: record [${triplet.join(", ")}], then move both pointers inward.`,
        });
        left++;
        right--;
        while (left < right && sorted[left] === sorted[left - 1]) left++;
        while (left < right && sorted[right] === sorted[right + 1]) right--;
      }
    }
  }

  const display = `[${triplets.map((t) => `[${t.join(", ")}]`).join(", ")}]`;
  steps.push({
    kind: "done",
    key: true,
    pointers: {},
    note: `Every anchor has been tried. The triplets that sum to 0 are ${display}.`,
  });

  return {
    problem: "two-pointers/three-sum",
    row: { values: sorted, display: "cards" },
    pointerNames: ["i", "left", "right"],
    steps,
    answer: triplets,
    answerDisplay: display,
  };
}

export const threeSumTrace: TraceDefinition<[number[]]> = {
  problem: "two-pointers/three-sum",
  exampleIndex: 1,
  exampleSource: "analogy",
  args: z.tuple([z.array(z.number().int()).min(3).max(10)]),
  run: threeSum,
};
