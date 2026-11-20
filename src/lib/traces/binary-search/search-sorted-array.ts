import { z } from "zod";

import { compare, type Trace, type TraceDefinition, type TraceStep } from "../types";
import { onRow, sortedNums } from "./shared";

/**
 * Check the middle of the range still in play: equal means found; smaller means the target can only be to the
 * right, so the middle and everything left of it are dropped; bigger drops the right half. Each check halves the
 * range, and an empty range (low past high) means the target isn't there. Every step is key.
 */
export function searchSortedArray(nums: number[], target: number): Trace {
  const n = nums.length;
  const steps: TraceStep[] = [];
  let low = 0;
  let high = n - 1;
  let answer = -1;
  steps.push({
    kind: "start",
    key: true,
    pointers: { low, high },
    search: { from: low, to: high },
    note: `${target} could be anywhere from position 0 to ${n - 1}: all ${n} values are in play.`,
  });

  while (low <= high) {
    const mid = low + Math.floor((high - low) / 2);
    const op = compare(nums[mid], target);
    const equation = {
      terms: [nums[mid]],
      operator: "+" as const,
      result: nums[mid],
      comparison: { op, target },
    };
    if (op === "=") {
      answer = mid;
      steps.push({
        kind: "found",
        key: true,
        pointers: { low, mid, high },
        found: [mid],
        search: { from: low, to: high, mid },
        equation,
        note: `The middle of positions ${low}–${high} is ${mid}, holding ${nums[mid]}: that's the target, found at position ${mid}.`,
      });
      break;
    }
    const before = `${low}–${high}`;
    if (op === "<") low = mid + 1;
    else high = mid - 1;
    const left = high - low + 1;
    steps.push({
      kind: op === "<" ? "drop-left" : "drop-right",
      key: true,
      pointers: onRow({ low, mid, high }, n),
      active: [mid],
      search: { from: low, to: high, mid },
      equation,
      note:
        `The middle of positions ${before} is ${mid}, holding ${nums[mid]}. ` +
        (op === "<"
          ? `${nums[mid]} < ${target}, so the target can only be to its right: drop position ${mid} and everything left of it (low = ${low}).`
          : `${nums[mid]} > ${target}, so the target can only be to its left: drop position ${mid} and everything right of it (high = ${high}).`) +
        (left > 0 ? ` ${left} left in play.` : " Nothing is left in play."),
    });
  }

  if (answer === -1) {
    steps.push({
      kind: "not-found",
      key: true,
      pointers: onRow({ low, high }, n),
      search: { from: low, to: low - 1 },
      note: `low (${low}) has passed high (${high}): the range is empty, so ${target} isn't in the list. Return -1.`,
    });
  }

  return {
    problem: "binary-search/search-sorted-array",
    row: { values: nums, display: "cards" },
    pointerNames: ["low", "mid", "high"],
    steps,
    answer,
    answerDisplay: String(answer),
    ...(answer >= 0 ? { answerIndices: [answer] } : {}),
  };
}

export const searchSortedArrayTrace: TraceDefinition<[number[], number]> = {
  problem: "binary-search/search-sorted-array",
  exampleIndex: 0,
  exampleSource: "analogy",
  args: z.tuple([sortedNums(9), z.number().int().min(-99).max(99)]),
  run: searchSortedArray,
};
