import { z } from "zod";

import type { Trace, TraceDefinition, TraceStep } from "../types";
import { RecordedHeap } from "./shared";

/**
 * Count every value, then keep the k highest counts in a min-heap (by count) capped at k: its root is the least
 * frequent of the k kept, so when a push makes it k + 1, popping the root drops the one value that can't be in the
 * top k. Key steps: the counts, the first sift-up, the first value bounced straight back out, any kept value evicted,
 * and the answer.
 */
export function topKFrequent(nums: number[], k: number): Trace {
  const counts = new Map<number, number>();
  for (const num of nums) counts.set(num, (counts.get(num) ?? 0) + 1);
  const freq = { entries: [...counts].map(([value, count]) => ({ key: String(value), count })) };
  const heap = new RecordedHeap("min", k);
  const steps: TraceStep[] = [];
  const record = (step: Omit<TraceStep, "pointers" | "heaps" | "freq">) =>
    steps.push({ ...step, pointers: {}, freq, heaps: [heap.snapshot()] });
  record({
    kind: "count",
    key: true,
    note: `Count each value: ${[...counts].map(([v, c]) => `${v} appears ${c} ${c === 1 ? "time" : "times"}`).join(", ")}.`,
  });
  let firstSift = true;
  let firstBounce = true;
  for (const [value, count] of counts) {
    heap.push({ key: count, label: `${value} ×${count}` });
    const sifted = heap.size > 1 && heap.peek()!.label === `${value} ×${count}`;
    record({
      kind: "push",
      key: sifted && firstSift,
      note: `Push ${value} with count ${count}.${sifted ? ` It's the least frequent kept, so it sifts up to the root.` : ""}`,
    });
    if (sifted) firstSift = false;
    if (heap.size > k) {
      const out = heap.pop()!;
      const bounced = out.label === `${value} ×${count}`;
      record({
        kind: bounced ? "bounce" : "evict",
        key: !bounced || firstBounce,
        note: bounced
          ? `${k + 1} values is one too many. ${value} has the lowest count, so it's popped right back out.`
          : `${k + 1} values is one too many: pop the root, ${out.label}, the least frequent kept.`,
      });
      if (bounced) firstBounce = false;
    }
  }
  const answer = heap.items.map((item) => Number(item.label.split(" ")[0]));
  record({
    kind: "done",
    key: true,
    note: `Every count is in. The heap holds the ${k} most frequent values: ${answer.join(" and ")}.`,
  });
  return {
    problem: "heap/top-k-frequent-elements",
    row: { values: nums, display: "cards" },
    pointerNames: [],
    steps,
    answer,
    answerDisplay: `[${answer.join(", ")}]`,
  };
}

export const topKFrequentElementsTrace: TraceDefinition<[number[], number]> = {
  problem: "heap/top-k-frequent-elements",
  exampleIndex: 0,
  exampleSource: "analogy",
  args: z
    .tuple([z.array(z.number().int().min(-9).max(99)).min(1).max(9), z.number().int().min(1).max(4)])
    .refine(([nums, k]) => k <= new Set(nums).size, "k is at most the number of distinct values")
    .refine(([nums]) => new Set(nums).size <= 6, "at most 6 distinct values"),
  run: topKFrequent,
};
