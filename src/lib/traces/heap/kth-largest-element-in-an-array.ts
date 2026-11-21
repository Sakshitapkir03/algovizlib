import { z } from "zod";

import type { Trace, TraceDefinition, TraceStep } from "../types";
import { RecordedHeap } from "./shared";

/**
 * Keep the k largest values seen so far in a min-heap capped at k. Its root is the smallest of them, so when a push
 * makes it k + 1, popping the root drops exactly the one value that can't be among the k largest. After every value,
 * the root is the kth largest so far. A value smaller than the root sifts straight back to the top and leaves at
 * once. Key steps: the first sift-up (with the heap reaching capacity), every eviction of a kept value, the first value
 * that bounces straight back out, and the answer at the root.
 */
export function kthLargestElement(nums: number[], k: number): Trace {
  const heap = new RecordedHeap("min", k);
  const steps: TraceStep[] = [];
  const record = (i: number | undefined, step: Omit<TraceStep, "pointers" | "heaps">) =>
    steps.push({ ...step, pointers: i === undefined ? {} : { i }, heaps: [heap.snapshot()] });
  let firstSift = true;
  let firstFull = true;
  let firstBounce = true;
  nums.forEach((num, i) => {
    heap.push({ key: num, label: String(num) });
    const sifted = heap.peek()!.key === num && heap.size > 1;
    const full = heap.size === k;
    record(i, {
      kind: "push",
      key: (sifted && firstSift) || (full && firstFull),
      note: `Push ${num}.${sifted ? ` It's the smallest kept so far, so it sifts up to the root.` : ""}${full && firstFull ? ` The heap now holds ${k}: it's full.` : ""}`,
      active: [i],
    });
    if (sifted) firstSift = false;
    if (full) firstFull = false;
    if (heap.size > k) {
      const out = heap.pop()!;
      const bounced = out.key === num;
      record(i, {
        kind: bounced ? "bounce" : "evict",
        // Every eviction of a kept value, and the first value that bounces straight back out.
        key: !bounced || firstBounce,
        note: bounced
          ? `${k + 1} values is one too many. ${num} is the smallest, so it's popped right back out: it can't be among the ${k} largest.`
          : `${k + 1} values is one too many: pop the root, ${out.key}, the smallest kept. ${num} stays among the ${k} largest.`,
        active: [i],
      });
      if (bounced) firstBounce = false;
    }
  });
  const answer = heap.peek()!.key;
  record(undefined, {
    kind: "done",
    key: true,
    note: `Every value is in. The heap holds the ${k} largest, and its root, ${answer}, is the ${k === 1 ? "largest" : `${ordinal(k)} largest`}.`,
  });
  return {
    problem: "heap/kth-largest-element-in-an-array",
    row: { values: nums, display: "cards" },
    pointerNames: ["i"],
    steps,
    answer,
    answerDisplay: String(answer),
  };
}

const ordinal = (n: number) => `${n}${n === 2 ? "nd" : n === 3 ? "rd" : "th"}`;

export const kthLargestElementInAnArrayTrace: TraceDefinition<[number[], number]> = {
  problem: "heap/kth-largest-element-in-an-array",
  exampleIndex: 0,
  exampleSource: "analogy",
  args: z
    .tuple([z.array(z.number().int().min(-99).max(99)).min(1).max(8), z.number().int().min(1).max(6)])
    .refine(([nums, k]) => k <= nums.length, "k is at most the number of values"),
  run: kthLargestElement,
};
