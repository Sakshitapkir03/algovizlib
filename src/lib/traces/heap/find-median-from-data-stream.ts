import { z } from "zod";

import type { Trace, TraceDefinition, TraceStep } from "../types";
import { RecordedHeap } from "./shared";

/**
 * Two heaps split the numbers seen so far: the lower half in a max-heap (its root is the largest of the small
 * numbers) and the upper half in a min-heap (its root is the smallest of the large ones). A new number goes to the
 * lower half if it's no bigger than that root, else to the upper half; then one root moves across if the halves differ
 * by more than one (the lower half may hold one extra). The median is the lower root, or the average of both roots.
 * Key steps: the first number, the first rebalance each way, a number going straight to the upper half, the first
 * even-count median, and the last answer.
 */
export function findMedianFromDataStream(operations: string[], args: number[][]): Trace {
  let lower = new RecordedHeap("max");
  let upper = new RecordedHeap("min");
  const steps: TraceStep[] = [];
  const outputs: (number | null)[] = [];
  const record = (step: Omit<TraceStep, "pointers" | "heaps">) =>
    steps.push({ ...step, pointers: {}, heaps: [lower.snapshot(), upper.snapshot()] });
  const shown = new Set<string>();
  const first = (what: string) => (shown.has(what) ? false : (shown.add(what), true));
  const item = (n: number) => ({ key: n, label: String(n) });

  operations.forEach((op, i) => {
    const last = i === operations.length - 1;
    if (op === "MedianFinder") {
      lower = new RecordedHeap("max");
      upper = new RecordedHeap("min");
      outputs.push(null);
      return;
    }
    if (op === "addNum") {
      const num = args[i][0];
      const top = lower.peek()?.key;
      const toLower = top === undefined || num <= top;
      (toLower ? lower : upper).push(item(num));
      outputs.push(null);
      record({
        kind: toLower ? "add-lower" : "add-upper",
        key: last || first("add") || (!toLower && first("add-upper")),
        note: toLower
          ? top === undefined
            ? `${num} is the first number: it goes in the lower half.`
            : `${num} ≤ ${top}, the lower half's root, so it joins the lower half.`
          : `${num} > ${top}, the lower half's root, so it joins the upper half.`,
      });
      if (lower.size > upper.size + 1) {
        const moved = lower.pop()!;
        upper.push(moved);
        record({
          kind: "move-up",
          key: last || first("move-up"),
          note: `The lower half has ${lower.size + 1} against ${upper.size - 1}: its root, ${moved.key}, moves to the upper half.`,
        });
      } else if (upper.size > lower.size) {
        const moved = upper.pop()!;
        lower.push(moved);
        record({
          kind: "move-down",
          key: last || first("move-down"),
          note: `The upper half is bigger: its root, ${moved.key}, moves to the lower half.`,
        });
      }
      return;
    }
    const a = lower.peek()!.key;
    const even = lower.size === upper.size;
    const median = even ? (a + upper.peek()!.key) / 2 : a;
    outputs.push(median);
    record({
      kind: "median",
      key: last || (even && first("even")),
      note: even
        ? `Both halves hold ${lower.size}: the median is the average of the two roots, (${a} + ${upper.peek()!.key}) / 2 = ${median}.`
        : `The lower half holds one extra, so its root, ${a}, is the median.`,
      ...(even
        ? {
            equation: {
              terms: [a, upper.peek()!.key],
              operator: "+" as const,
              result: a + upper.peek()!.key,
            },
          }
        : {}),
    });
  });
  return {
    problem: "heap/find-median-from-data-stream",
    row: { values: [], display: "cards" },
    pointerNames: [],
    steps,
    answer: outputs,
    answerDisplay: outputs.map((o) => (o === null ? "null" : String(o))).join(", "),
  };
}

export const findMedianFromDataStreamTrace: TraceDefinition<[string[], number[][]]> = {
  problem: "heap/find-median-from-data-stream",
  exampleIndex: 0,
  exampleSource: "analogy",
  args: z
    .tuple([
      z
        .array(z.enum(["MedianFinder", "addNum", "findMedian"]))
        .min(2)
        .max(12),
      z.array(z.array(z.number().int().min(-99).max(99)).max(1)),
    ])
    .refine(
      ([ops]) => ops[0] === "MedianFinder" && ops.filter((o) => o === "addNum").length <= 6,
      "at most 6 numbers",
    )
    .refine(([ops]) => {
      let added = 0;
      return ops.every((o) => (o === "addNum" ? ++added : o === "findMedian" ? added > 0 : true));
    }, "findMedian comes after a number"),
  run: findMedianFromDataStream,
};
