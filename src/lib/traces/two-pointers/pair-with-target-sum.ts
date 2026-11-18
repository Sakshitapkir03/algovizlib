import { z } from "zod";

import { compare, sortedIndices, type Trace, type TraceDefinition, type TraceStep } from "../types";

/**
 * Pair sum on a sorted array: sum too small → advance `left`; too big → retreat `right`; equal → done.
 * Every comparison is a key step (each one rules out an item, which is the whole idea).
 */
export function pairWithTargetSum(nums: number[], target: number): Trace {
  const steps: TraceStep[] = [];
  const rejected = new Set<number>();
  let left = 0;
  let right = nums.length - 1;
  let pair: [number, number] | null = null;

  while (left < right) {
    const sum = nums[left] + nums[right];
    const op = compare(sum, target);
    const base = {
      key: true,
      pointers: { left, right },
      equation: {
        terms: [nums[left], nums[right]],
        operator: "+" as const,
        result: sum,
        comparison: { op, target },
      },
      active: [left, right],
      ...(rejected.size > 0 ? { rejected: sortedIndices(rejected) } : {}),
    };
    if (op === "=") {
      pair = [left, right];
      steps.push({
        ...base,
        kind: "found",
        found: [left, right],
        note: `${nums[left]} + ${nums[right]} = ${sum} equals the target ${target}: found the pair (${left}, ${right}).`,
      });
      break;
    }
    if (op === "<") {
      steps.push({
        ...base,
        kind: "move-left",
        note: `${nums[left]} + ${nums[right]} = ${sum} < ${target}: even the largest remaining value is too small for nums[${left}], so rule it out and move left right.`,
      });
      rejected.add(left);
      left++;
    } else {
      steps.push({
        ...base,
        kind: "move-right",
        note: `${nums[left]} + ${nums[right]} = ${sum} > ${target}: even the smallest remaining value is too big with nums[${right}], so rule it out and move right left.`,
      });
      rejected.add(right);
      right--;
    }
  }

  return {
    problem: "two-pointers/pair-with-target-sum",
    row: { values: nums, display: "cards" },
    pointerNames: ["left", "right"],
    steps,
    answer: pair ?? [],
    answerDisplay: pair ? `[${pair[0]}, ${pair[1]}]` : "[]",
    ...(pair ? { answerIndices: pair } : {}),
  };
}

export const pairWithTargetSumTrace: TraceDefinition<[number[], number]> = {
  problem: "two-pointers/pair-with-target-sum",
  exampleIndex: 0,
  exampleSource: "analogy",
  args: z.tuple([z.array(z.number()).min(2), z.number()]),
  run: pairWithTargetSum,
};
