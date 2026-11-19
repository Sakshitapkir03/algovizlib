import { z } from "zod";

import { compare, type Trace, type TraceDefinition, type TraceStep } from "../types";

const show = (values: readonly number[]) => `[${values.join(", ")}]`;

/**
 * Bubble sort with early exit. One step per neighbor comparison, one when a pass ends (its largest value settles
 * at the end), and a final step when a pass makes no swaps. Key steps: the first swap, the first pair already in
 * order, the end of the first two passes, every step of the pass with no swaps, and the finish.
 */
export function bubbleSort(nums: number[]): Trace {
  const a = [...nums];
  const n = a.length;
  const steps: TraceStep[] = [];
  let sawSwap = false;
  let sawKeep = false;
  const sortedFrom = (pass: number) => (pass > 0 ? { sorted: { from: n - pass, to: n - 1 } } : {});

  for (let pass = 0; pass < n - 1; pass++) {
    const firstStepOfPass = steps.length;
    let swapped = false;
    for (let j = 0; j < n - 1 - pass; j++) {
      const [x, y] = [a[j], a[j + 1]];
      const op = compare(x, y);
      const swap = op === ">";
      if (swap) [a[j], a[j + 1]] = [y, x];
      steps.push({
        kind: swap ? "swap" : "keep",
        key: (swap && !sawSwap) || (!swap && !sawKeep),
        pointers: { j, next: j + 1 },
        // Out of order is the bad news a swap fixes; in order (including equal) is good news, whatever the sign.
        equation: {
          terms: [x],
          operator: "+",
          result: x,
          comparison: { op, target: y },
          tone: swap ? "negative" : "positive",
        },
        active: [j, j + 1],
        values: [...a],
        ...(swap
          ? {
              moves: [
                { from: j, to: j + 1 },
                { from: j + 1, to: j },
              ],
            }
          : {}),
        ...sortedFrom(pass),
        note: swap
          ? `${x} > ${y}: out of order, so swap them. The array is now ${show(a)}.`
          : `${x} ≤ ${y}: already in order, so leave them.`,
      });
      sawSwap ||= swap;
      sawKeep ||= !swap;
      swapped ||= swap;
    }
    if (!swapped) {
      // A pass with no swaps proves the array is sorted: stop early.
      for (let s = firstStepOfPass; s < steps.length; s++) steps[s].key = true;
      steps.push({
        kind: "early-exit",
        key: true,
        pointers: {},
        values: [...a],
        sorted: { from: 0, to: n - 1 },
        found: a.map((_, i) => i),
        note: `Pass ${pass + 1} made no swaps, so every neighbor pair is in order: the array is sorted. Stop early.`,
      });
      break;
    }
    const settled = n - 1 - pass;
    steps.push({
      kind: "pass-end",
      key: pass < 2,
      pointers: {},
      values: [...a],
      sorted: { from: settled, to: n - 1 },
      note: `Pass ${pass + 1} is over: ${a[settled]}, the largest value not yet placed, has bubbled to position ${settled} and won't move again.`,
    });
    if (settled === 1) {
      // Only one unsorted value is left, so it is in place too.
      steps.push({
        kind: "done",
        key: true,
        pointers: {},
        values: [...a],
        sorted: { from: 0, to: n - 1 },
        found: a.map((_, i) => i),
        note: `Only one value is left in front of the sorted part, so it is already in place: ${show(a)}.`,
      });
    }
  }
  if (n < 2) {
    steps.push({
      kind: "done",
      key: true,
      pointers: {},
      values: [...a],
      note: "A single value is already sorted.",
    });
  }

  return {
    problem: "sorting/bubble-sort",
    row: { values: [...nums], display: "bars" },
    pointerNames: ["j", "next"],
    steps,
    answer: a,
    answerDisplay: show(a),
  };
}

export const bubbleSortTrace: TraceDefinition<[number[]]> = {
  problem: "sorting/bubble-sort",
  exampleIndex: 0,
  exampleSource: "analogy",
  args: z.tuple([z.array(z.number().int().nonnegative()).min(1).max(8)]),
  run: bubbleSort,
};
