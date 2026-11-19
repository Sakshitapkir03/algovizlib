import { z } from "zod";

import type { Trace, TraceDefinition, TraceStep } from "../types";

const show = (values: readonly number[]) => `[${values.join(", ")}]`;

/**
 * Quick sort with a Lomuto partition and the last value of each range as the pivot. Per range: a "pivot" step,
 * one "compare" step per scanned value (smaller values swap to the boundary, which moves right), and a "place"
 * step where the pivot swaps into the boundary: its final position. One-value ranges are a "base" step.
 *
 * Key steps: the first pivot, the first value that stays right and the first that moves left, the first pivot
 * landing, the left side of that pivot, the next placed pivot (one level deeper, summarized), and the finish.
 */
export function quickSort(nums: number[]): Trace {
  const a = [...nums];
  const n = a.length;
  const steps: TraceStep[] = [];
  const final = a.map(() => false);
  // The sorted-region primitive is one range, so show the finished prefix (it grows left to right here).
  const sorted = () => {
    let end = 0;
    while (end < n && final[end]) end++;
    return end > 0 ? { sorted: { from: 0, to: end - 1 } } : {};
  };

  const sort = (lo: number, hi: number, depth: number) => {
    if (lo > hi) return;
    if (lo === hi) {
      final[lo] = true;
      steps.push({
        kind: "base",
        key: false,
        pointers: {},
        values: [...a],
        range: { from: lo, to: hi },
        depth,
        active: [lo],
        ...sorted(),
        note: `The range at position ${lo} holds just ${a[lo]}: one value is already sorted, and it's in its final place.`,
      });
      return;
    }
    const pivot = a[hi];
    let i = lo;
    steps.push({
      kind: "pivot",
      key: false,
      pointers: { j: lo },
      values: [...a],
      range: { from: lo, to: hi },
      depth,
      pivot: hi,
      boundary: lo,
      ...sorted(),
      note: `Sort ${show(a.slice(lo, hi + 1))}: take its last value, ${pivot}, as the pivot. Walk the rest once; values smaller than ${pivot} go to the left of the boundary.`,
    });
    for (let j = lo; j < hi; j++) {
      const value = a[j];
      const smaller = value < pivot;
      const moves =
        smaller && i !== j
          ? [
              { from: j, to: i },
              { from: i, to: j },
            ]
          : undefined;
      if (smaller) {
        [a[i], a[j]] = [a[j], a[i]];
        i++;
      }
      steps.push({
        kind: smaller ? "move-left" : "stay-right",
        key: false,
        pointers: { j },
        equation: {
          terms: [value],
          operator: "+",
          result: value,
          comparison: { op: value < pivot ? "<" : value > pivot ? ">" : "=", target: pivot },
          // Both outcomes are routine; a smaller value joining the left side is the progress worth marking.
          tone: smaller ? "positive" : "neutral",
        },
        active: [smaller ? i - 1 : j],
        values: [...a],
        ...(moves ? { moves } : {}),
        range: { from: lo, to: hi },
        depth,
        pivot: hi,
        boundary: i,
        ...sorted(),
        note: smaller
          ? `${value} < ${pivot}, so it belongs left of the pivot: ${i - 1 !== j ? `swap it to the boundary (position ${i - 1}) and move the boundary right` : "it's already at the boundary, so just move the boundary right"}.`
          : `${value} ≥ ${pivot}, so it stays on the right side. The boundary doesn't move.`,
      });
    }
    const placeMoves =
      i !== hi
        ? [
            { from: hi, to: i },
            { from: i, to: hi },
          ]
        : undefined;
    [a[i], a[hi]] = [a[hi], a[i]];
    final[i] = true;
    steps.push({
      kind: "place",
      key: false,
      pointers: {},
      values: [...a],
      ...(placeMoves ? { moves: placeMoves } : {}),
      range: { from: lo, to: hi },
      depth,
      pivot: i,
      boundary: i,
      found: [i],
      ...sorted(),
      note: `${placeMoves ? `Swap the pivot ${pivot} into the boundary at position ${i}` : `The pivot ${pivot} is already at the boundary, position ${i}`}. Everything left of it is smaller and everything right is not, so ${pivot} is in its final place. Now ${show(a)}.`,
    });
    sort(lo, i - 1, depth + 1);
    sort(i + 1, hi, depth + 1);
  };

  sort(0, n - 1, 0);
  steps.push({
    kind: "done",
    key: true,
    pointers: {},
    values: [...a],
    sorted: { from: 0, to: n - 1 },
    found: a.map((_, i) => i),
    note: `Every range is down to one value or a placed pivot, so the array is sorted: ${show(a)}.`,
  });

  const first = (kind: string, from = 0) => steps.findIndex((s, i) => i >= from && s.kind === kind);
  const mark = (i: number) => i >= 0 && (steps[i].key = true);
  const firstPlace = first("place");
  mark(first("pivot"));
  mark(first("stay-right"));
  mark(first("move-left"));
  mark(firstPlace);
  if (firstPlace >= 0) {
    // The first pivot's left side (its first step), and the next pivot placed at the next level.
    mark(firstPlace + 1 < steps.length - 1 ? firstPlace + 1 : -1);
    mark(first("place", firstPlace + 1));
  }

  return {
    problem: "sorting/quick-sort",
    row: { values: [...nums], display: "bars" },
    pointerNames: ["j"],
    steps,
    answer: a,
    answerDisplay: show(a),
  };
}

export const quickSortTrace: TraceDefinition<[number[]]> = {
  problem: "sorting/quick-sort",
  exampleIndex: 0,
  exampleSource: "analogy",
  args: z.tuple([z.array(z.number().int().nonnegative()).min(1).max(8)]),
  run: quickSort,
};
