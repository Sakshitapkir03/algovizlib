import { z } from "zod";

import type { Trace, TraceDefinition, TraceStep } from "../types";
import { RecordedHeap } from "./shared";

const pointLabel = ([x, y]: number[]) => `(${x},${y})`;
const sq = (n: number) => (n < 0 ? `(${n})²` : `${n}²`);

/**
 * Keep the k closest points so far in a max-heap by squared distance (no square roots needed: x² + y² orders points
 * the same way) capped at k. Its root is the farthest of the kept points, so when a push makes it k + 1, popping the
 * root drops the one point that can't be among the k closest. Key steps: a far point sifting up to the root, the
 * first eviction, a closer point pushing out a kept one, and the answer.
 */
export function kClosestPoints(points: number[][], k: number): Trace {
  const heap = new RecordedHeap("max", k);
  const steps: TraceStep[] = [];
  const record = (i: number | undefined, step: Omit<TraceStep, "pointers" | "heaps">) =>
    steps.push({ ...step, pointers: i === undefined ? {} : { i }, heaps: [heap.snapshot()] });
  let firstSift = true;
  let firstBounce = true;
  points.forEach((point, i) => {
    const [x, y] = point;
    const d = x * x + y * y;
    heap.push({ key: d, label: pointLabel(point) });
    const sifted = heap.size > 1 && heap.peek()!.label === pointLabel(point);
    record(i, {
      kind: "push",
      key: sifted && firstSift,
      note: `Push ${pointLabel(point)}: ${sq(x)} + ${sq(y)} = ${d}.${sifted ? " It's the farthest kept, so it sifts up to the root." : ""}`,
      equation: { terms: [x * x, y * y], operator: "+", result: d },
      active: [i],
    });
    if (sifted) firstSift = false;
    if (heap.size > k) {
      const out = heap.pop()!;
      const bounced = out.label === pointLabel(point);
      record(i, {
        kind: bounced ? "bounce" : "evict",
        key: !bounced || firstBounce,
        note: bounced
          ? `${k + 1} points is one too many. ${pointLabel(point)} is the farthest, so it's popped right back out.`
          : `${k + 1} points is one too many: pop the root, ${out.label} at ${out.key}, the farthest kept. ${pointLabel(point)} stays.`,
        active: [i],
      });
      if (bounced) firstBounce = false;
    }
  });
  const answer = heap.items.map((item) => item.label);
  record(undefined, {
    kind: "done",
    key: true,
    note: `Every point is in. The heap holds the ${k} closest: ${answer.join(" and ")}.`,
  });
  const values = heap.items.map((item) => points.find((p) => pointLabel(p) === item.label)!);
  return {
    problem: "heap/k-closest-points-to-origin",
    // Cards show "0,-2" (parentheses would make them too wide on a phone); heap nodes show "(0,-2)".
    row: { values: points.map(([x, y]) => `${x},${y}`), display: "cards" },
    pointerNames: ["i"],
    steps,
    answer: values,
    answerDisplay: `[${values.map(([x, y]) => `[${x}, ${y}]`).join(", ")}]`,
  };
}

export const kClosestPointsToOriginTrace: TraceDefinition<[number[][], number]> = {
  problem: "heap/k-closest-points-to-origin",
  exampleIndex: 0,
  exampleSource: "analogy",
  args: z
    .tuple([
      z
        .array(z.tuple([z.number().int().min(-9).max(9), z.number().int().min(-9).max(9)]))
        .min(1)
        .max(6),
      z.number().int().min(1).max(4),
    ])
    .refine(([points, k]) => k <= points.length, "k is at most the number of points"),
  run: kClosestPoints,
};
