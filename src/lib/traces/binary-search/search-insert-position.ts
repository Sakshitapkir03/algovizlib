import { z } from "zod";

import { compare, type Trace, type TraceDefinition, type TraceStep } from "../types";
import { onRow, sortedNums } from "./shared";

/**
 * The spot is somewhere from position `low` to `high` (where `high = n` means after the last value). Check the
 * middle: a value smaller than the target puts the spot after it (low = mid + 1); otherwise the spot is at mid or
 * before (high = mid). When low meets high there's one spot left: that's the answer. Every step is key.
 *
 * Cards in play are positions low…high-1; once low = high the range is empty and marks the gap before `low`.
 */
export function searchInsertPosition(nums: number[], target: number): Trace {
  const n = nums.length;
  const steps: TraceStep[] = [];
  let low = 0;
  let high = n;
  steps.push({
    kind: "start",
    key: true,
    pointers: onRow({ low, high }, n),
    search: { from: low, to: high - 1 },
    note: `The spot for ${target} is somewhere from position 0 to ${n} (${n} means after the last value).`,
  });

  while (low < high) {
    const mid = low + Math.floor((high - low) / 2);
    const op = compare(nums[mid], target);
    const smaller = op === "<";
    if (smaller) low = mid + 1;
    else high = mid;
    steps.push({
      kind: smaller ? "go-right" : "go-left",
      key: true,
      pointers: onRow({ low, mid, high }, n),
      active: [mid],
      search: { from: low, to: high - 1, mid },
      equation: { terms: [nums[mid]], operator: "+", result: nums[mid], comparison: { op, target } },
      note: smaller
        ? `Position ${mid} holds ${nums[mid]}, smaller than ${target}, so the spot is after it: low = ${mid} + 1 = ${low}.`
        : `Position ${mid} holds ${nums[mid]}, ${op === "=" ? "equal to" : "bigger than"} ${target}, so the spot is at ${mid} or before: high = ${mid}.`,
    });
  }

  steps.push({
    kind: "done",
    key: true,
    pointers: onRow({ low, high }, n),
    search: { from: low, to: low - 1 },
    note: `low and high meet at ${low}: only one spot is left, so ${target} goes at position ${low}.`,
  });

  return {
    problem: "binary-search/search-insert-position",
    row: { values: nums, display: "cards" },
    pointerNames: ["low", "mid", "high"],
    steps,
    answer: low,
    answerDisplay: String(low),
  };
}

export const searchInsertPositionTrace: TraceDefinition<[number[], number]> = {
  problem: "binary-search/search-insert-position",
  exampleIndex: 1,
  exampleSource: "analogy",
  args: z.tuple([sortedNums(9), z.number().int().min(-99).max(99)]),
  run: searchInsertPosition,
};
