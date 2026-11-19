import { z } from "zod";

import type { Trace, TraceDefinition, TraceStep } from "../types";

const show = (values: readonly number[]) => `[${values.join(", ")}]`;

/**
 * Heap sort. The array is a binary tree (children of `i` at `2i + 1` and `2i + 2`). Build a max-heap by sifting
 * down every parent from the last one to the root, then repeatedly swap the root (the largest value left) to the
 * end of the heap, shrink the heap by one, and sift the new root down. A sift-down step compares a parent with
 * its larger child: "sift-swap" when the child is bigger, "sift-stop" when the parent already wins.
 *
 * Key steps: the root's sift-down while building (each swap, in detail), the finished heap, the first root moved
 * to the end, the sift-down that repairs the heap after it, and the finish.
 */
export function heapSort(nums: number[]): Trace {
  const a = [...nums];
  const n = a.length;
  const steps: TraceStep[] = [];
  let heapSize = n;
  let phase: "build" | "sort" = "build";
  const sorted = () => (heapSize < n ? { sorted: { from: heapSize, to: n - 1 } } : {});

  const siftDown = (start: number) => {
    let parent = start;
    while (2 * parent + 1 < heapSize) {
      const l = 2 * parent + 1;
      const r = l + 1;
      const child = r < heapSize && a[r] > a[l] ? r : l;
      const [p, c] = [a[parent], a[child]];
      const swap = c > p;
      if (swap) [a[parent], a[child]] = [a[child], a[parent]];
      steps.push({
        kind: swap ? "sift-swap" : "sift-stop",
        key: false,
        pointers: {},
        equation: {
          terms: [c],
          operator: "+",
          result: c,
          comparison: { op: c < p ? "<" : c > p ? ">" : "=", target: p },
          // A bigger child breaks the heap rule (swap); a parent that already wins is the repair finishing.
          tone: swap ? "negative" : "positive",
        },
        active: [parent, child],
        compare: [parent, child],
        values: [...a],
        ...(swap
          ? {
              moves: [
                { from: parent, to: child },
                { from: child, to: parent },
              ],
            }
          : {}),
        heapSize,
        ...sorted(),
        note: swap
          ? `${phase === "build" ? "Building the heap" : "Repairing the heap"}: the parent ${p} (position ${parent}) is smaller than its bigger child ${c} (position ${child}), so they swap and ${p} keeps sinking.`
          : `The parent ${p} (position ${parent}) is at least as big as its bigger child ${c}, so this part of the heap is fine. Stop.`,
      });
      if (!swap) return;
      parent = child;
    }
  };

  for (let i = Math.floor(n / 2) - 1; i >= 0; i--) siftDown(i);
  steps.push({
    kind: "heap-built",
    key: true,
    pointers: {},
    values: [...a],
    heapSize,
    found: [0],
    note: `Every parent is now at least as big as its children: a max-heap ${show(a)}. The largest value, ${a[0]}, sits at the root (position 0).`,
  });
  phase = "sort";
  for (let end = n - 1; end > 0; end--) {
    const top = a[0];
    [a[0], a[end]] = [a[end], a[0]];
    heapSize = end;
    steps.push({
      kind: "extract",
      key: false,
      pointers: {},
      values: [...a],
      moves: [
        { from: 0, to: end },
        { from: end, to: 0 },
      ],
      heapSize,
      ...sorted(),
      note: `Swap the root ${top} (the largest left) with the heap's last value ${a[0]}. ${top} is now in its final place at position ${end}; the heap shrinks to ${heapSize} value${heapSize === 1 ? "" : "s"}.`,
    });
    siftDown(0);
  }
  heapSize = 0;
  steps.push({
    kind: "done",
    key: true,
    pointers: {},
    values: [...a],
    heapSize: 0,
    sorted: { from: 0, to: n - 1 },
    found: a.map((_, i) => i),
    note: `The heap is empty and every value went to its final place from the back: ${show(a)}.`,
  });

  // The detailed sift-down: the root's, the last one while building (it often swaps more than once).
  const built = steps.findIndex((s) => s.kind === "heap-built");
  for (let i = 0; i < built; i++)
    if (steps[i].compare && steps[i].kind === "sift-swap" && isRootChain(steps, i, built))
      steps[i].key = true;
  const firstExtract = steps.findIndex((s) => s.kind === "extract");
  if (firstExtract >= 0) {
    steps[firstExtract].key = true;
    const repair = steps.findIndex((s, i) => i > firstExtract && s.kind === "sift-swap");
    if (repair >= 0 && steps[repair - 1].kind === "extract") steps[repair].key = true;
  }

  return {
    problem: "sorting/heap-sort",
    row: { values: [...nums], display: "bars" },
    pointerNames: [],
    steps,
    answer: a,
    answerDisplay: show(a),
  };
}

/** Whether build step `i` belongs to the root's sift-down (the sift that starts at position 0, ending at `built`). */
function isRootChain(steps: TraceStep[], i: number, built: number): boolean {
  let start = built - 1;
  // Walk back while each step continues the previous one (its parent is the previous child).
  while (
    start > 0 &&
    steps[start].compare &&
    steps[start - 1].compare &&
    steps[start - 1].compare![1] === steps[start].compare![0]
  )
    start--;
  return steps[start].compare?.[0] === 0 && i >= start && i < built;
}

export const heapSortTrace: TraceDefinition<[number[]]> = {
  problem: "sorting/heap-sort",
  exampleIndex: 0,
  exampleSource: "analogy",
  args: z.tuple([z.array(z.number().int().nonnegative()).min(1).max(7)]),
  run: heapSort,
};
