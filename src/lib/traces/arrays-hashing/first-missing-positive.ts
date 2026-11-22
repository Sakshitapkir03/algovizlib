import { z } from "zod";

import type { Trace, TraceDefinition, TraceStep } from "../types";

/**
 * Use the array itself as the lookup table: value v belongs in slot v − 1. Walk the slots; while a slot holds a value
 * 1…n that isn't already in its own slot, swap it there (cyclic sort). Values out of range stay put. Then the first
 * slot i not holding i + 1 says i + 1 is missing; if every slot is right, n + 1 is. Key steps: a value left in place
 * because it's out of range, every swap into place, and the scan that finds the gap.
 */
export function firstMissingPositive(input: number[]): Trace {
  const nums = [...input];
  const n = nums.length;
  const steps: TraceStep[] = [];
  const placed = () => nums.flatMap((v, i) => (v === i + 1 ? [i] : []));
  let shownOut = false;
  for (let i = 0; i < n; i++) {
    let swapped = false;
    while (nums[i] >= 1 && nums[i] <= n && nums[nums[i] - 1] !== nums[i]) {
      const v = nums[i];
      const target = v - 1;
      [nums[i], nums[target]] = [nums[target], nums[i]];
      swapped = true;
      steps.push({
        kind: "swap",
        key: true,
        pointers: { i },
        active: [i, target],
        note: `${v} belongs in slot ${target} (value − 1): swap it there. ${nums[i]} comes back to slot ${i}.`,
        values: [...nums],
        moves: [
          { from: i, to: target },
          { from: target, to: i },
        ],
        final: placed(),
      });
    }
    if (!swapped || !(nums[i] >= 1 && nums[i] <= n)) {
      const v = nums[i];
      const out = v < 1 || v > n;
      const key = out && !shownOut;
      if (key) shownOut = true;
      steps.push({
        kind: out ? "out-of-range" : "in-place",
        key,
        pointers: { i },
        active: [i],
        note: out
          ? `${v} can't be a slot's value: only 1 to ${n} have slots. Leave it.`
          : `${v} is already in its slot, or its slot already holds a ${v}. Move on.`,
        values: [...nums],
        final: placed(),
      });
    }
  }
  const gap = nums.findIndex((v, i) => v !== i + 1);
  const answer = gap === -1 ? n + 1 : gap + 1;
  steps.push({
    kind: "scan",
    key: true,
    pointers: gap === -1 ? {} : { i: gap },
    ...(gap === -1 ? {} : { rejected: [gap] }),
    note:
      gap === -1
        ? `Every slot holds its own value 1 to ${n}, so the first missing one is ${n + 1}.`
        : `Scan the slots: slot ${gap} should hold ${gap + 1} but holds ${nums[gap]}. ${gap + 1} is missing.`,
    values: [...nums],
    final: placed(),
  });
  return {
    problem: "arrays-hashing/first-missing-positive",
    row: { values: input, display: "bars" },
    pointerNames: ["i"],
    steps,
    answer,
    answerDisplay: String(answer),
  };
}

export const firstMissingPositiveTrace: TraceDefinition<[number[]]> = {
  problem: "arrays-hashing/first-missing-positive",
  exampleIndex: 0,
  exampleSource: "analogy",
  // Bars must be drawable (nonnegative) and few.
  args: z.tuple([z.array(z.number().int().min(0).max(20)).min(1).max(6)]),
  run: firstMissingPositive,
};
