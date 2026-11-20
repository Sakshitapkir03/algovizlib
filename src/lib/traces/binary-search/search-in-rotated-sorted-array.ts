import { z } from "zod";

import { compare, type Trace, type TraceDefinition, type TraceEquation, type TraceStep } from "../types";
import { onRow } from "./shared";

const single = (value: number, target: number, tone: TraceEquation["tone"]): TraceEquation => ({
  terms: [value],
  operator: "+",
  result: value,
  comparison: { op: compare(value, target), target },
  tone,
});

/**
 * A rotated sorted list has one break, so at least one half around the middle is in order: the left half when its
 * first value is no bigger than the middle one, otherwise the right half. Check whether the target lies inside that
 * sorted half (easy, since its ends bound it): keep that half if so, otherwise keep the other one. Key steps: the
 * start, the first sorted-half check, every keep/drop decision, and the end.
 */
export function searchInRotatedSortedArray(nums: number[], target: number): Trace {
  const n = nums.length;
  const steps: TraceStep[] = [];
  let low = 0;
  let high = n - 1;
  let answer = -1;
  let checks = 0;
  steps.push({
    kind: "start",
    key: true,
    pointers: { low, high },
    search: { from: low, to: high },
    note: `${target} could be anywhere from position 0 to ${n - 1}. The list is sorted but rotated, so one half around any middle is in order.`,
  });

  while (low <= high) {
    const mid = low + Math.floor((high - low) / 2);
    if (nums[mid] === target) {
      answer = mid;
      steps.push({
        kind: "found",
        key: true,
        pointers: { low, mid, high },
        found: [mid],
        search: { from: low, to: high, mid },
        equation: single(nums[mid], target, "positive"),
        note: `The middle of positions ${low}–${high} is ${mid}, holding ${nums[mid]}: that's the target, found at position ${mid}.`,
      });
      break;
    }

    const leftSorted = nums[low] <= nums[mid];
    const sorted = leftSorted ? { from: low, to: mid } : { from: mid, to: high };
    const [a, b] = [nums[sorted.from], nums[sorted.to]];
    steps.push({
      kind: "sorted-half",
      key: checks === 0,
      pointers: { low, mid, high },
      active: [mid],
      search: { from: low, to: high, mid, sorted },
      // Which half is in order is information, not good or bad news.
      equation: single(nums[low], nums[mid], "neutral"),
      note: leftSorted
        ? `The middle is position ${mid} (${nums[mid]}). ${nums[low]} at low is no bigger than ${nums[mid]}, so there's no break on the left: ${a}…${b} is in order.`
        : `The middle is position ${mid} (${nums[mid]}). ${nums[low]} at low is bigger than ${nums[mid]}, so the break is on the left and the right half ${a}…${b} is in order.`,
    });
    checks++;

    // Inside the sorted half: low end ≤ target < middle (left half) or middle < target ≤ high end (right half).
    const inside = leftSorted ? a <= target && target < nums[mid] : nums[mid] < target && target <= b;
    // Show the comparison that decides: the far end when it's inside, else the end it falls past.
    const decisive = leftSorted
      ? target < a
        ? a
        : target >= nums[mid]
          ? nums[mid]
          : a
      : target > b
        ? b
        : target <= nums[mid]
          ? nums[mid]
          : b;
    const before = { low, high };
    if (inside === leftSorted) high = mid - 1;
    else low = mid + 1;
    const kept = inside ? "that half" : "the other half";
    steps.push({
      kind: inside ? "keep-sorted" : "keep-other",
      key: true,
      pointers: onRow({ low, mid, high }, n),
      active: [mid],
      search: { from: low, to: high, mid },
      // Inside the sorted half is the lucky case; outside just sends the search the other way.
      equation: single(target, decisive, inside ? "positive" : "neutral"),
      note:
        (inside
          ? `${target} is ${leftSorted ? `at least ${a} and below ${nums[mid]}` : `above ${nums[mid]} and at most ${b}`}, inside the sorted half, so keep ${kept}`
          : `${target} isn't between the sorted half's ends (${a}…${b}), so it can only be in the other half`) +
        ` (positions ${before.low}–${before.high} become ${low <= high ? `${low}–${high}` : "nothing"}).`,
    });
  }

  if (answer === -1) {
    steps.push({
      kind: "not-found",
      key: true,
      pointers: onRow({ low, high }, n),
      search: { from: low, to: low - 1 },
      note: `low has passed high: nothing is left in play, so ${target} isn't in the list. Return -1.`,
    });
  }

  return {
    problem: "binary-search/search-in-rotated-sorted-array",
    row: { values: nums, display: "cards" },
    pointerNames: ["low", "mid", "high"],
    steps,
    answer,
    answerDisplay: String(answer),
    ...(answer >= 0 ? { answerIndices: [answer] } : {}),
  };
}

/** A strictly increasing list rotated at some point: at most one place where a value is smaller than the one before. */
const rotatedNums = z
  .array(z.number().int().min(-99).max(99))
  .min(1)
  .max(9)
  .refine((nums) => new Set(nums).size === nums.length, "values must be distinct")
  .refine(
    (nums) =>
      nums.filter((v, i) => i > 0 && v < nums[i - 1]).length +
        (nums.length > 1 && nums[0] < nums.at(-1)! ? 1 : 0) <=
      1,
    "nums must be a rotated sorted list",
  );

export const searchInRotatedSortedArrayTrace: TraceDefinition<[number[], number]> = {
  problem: "binary-search/search-in-rotated-sorted-array",
  exampleIndex: 0,
  exampleSource: "analogy",
  args: z.tuple([rotatedNums, z.number().int().min(-99).max(99)]),
  run: searchInRotatedSortedArray,
};
