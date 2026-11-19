import { z } from "zod";

import { compare, type Trace, type TraceDefinition, type TraceStep } from "../types";

const show = (values: readonly number[]) => `[${values.join(", ")}]`;

/**
 * Selection sort. For each position `i`, scan the rest for the smallest value (one step per comparison), then
 * swap it into `i` (one step). Key steps: the first new minimum, the first value that isn't smaller, the first
 * swap, the first value already in place, and the finish.
 */
export function selectionSort(nums: number[]): Trace {
  const a = [...nums];
  const n = a.length;
  const steps: TraceStep[] = [];
  const seen = new Set<string>();
  const first = (kind: string) => !seen.has(kind) && seen.add(kind) !== undefined;
  const sortedBefore = (i: number) => (i > 0 ? { sorted: { from: 0, to: i - 1 } } : {});

  for (let i = 0; i < n - 1; i++) {
    let min = i;
    for (let j = i + 1; j < n; j++) {
      const op = compare(a[j], a[min]);
      const smaller = op === "<";
      const previousMin = a[min];
      if (smaller) min = j;
      steps.push({
        kind: smaller ? "new-min" : "not-smaller",
        key: first(smaller ? "new-min" : "not-smaller"),
        pointers: { i, j, min },
        // A new minimum is progress; a value that isn't smaller is just information (not "too high").
        equation: {
          terms: [a[j]],
          operator: "+",
          result: a[j],
          comparison: { op, target: previousMin },
          tone: smaller ? "positive" : "neutral",
        },
        active: [j],
        values: [...a],
        ...sortedBefore(i),
        note: smaller
          ? `${a[j]} < ${previousMin}: a new smallest value, so min moves to position ${j}.`
          : `${a[j]} isn't smaller than ${previousMin}, so the minimum stays at position ${min}.`,
      });
    }
    if (min === i) {
      steps.push({
        kind: "in-place",
        key: first("in-place"),
        pointers: { i, min },
        values: [...a],
        sorted: { from: 0, to: i },
        note: `The smallest remaining value, ${a[i]}, is already at position ${i}. No swap needed.`,
      });
    } else {
      [a[i], a[min]] = [a[min], a[i]];
      steps.push({
        kind: "swap",
        key: first("swap"),
        pointers: { i, min },
        values: [...a],
        moves: [
          { from: min, to: i },
          { from: i, to: min },
        ],
        sorted: { from: 0, to: i },
        note: `Swap the minimum, ${a[i]}, into position ${i}. Positions 0–${i} now hold the ${i + 1} smallest values, in order: ${show(a)}.`,
      });
    }
  }
  steps.push({
    kind: "done",
    key: true,
    pointers: {},
    values: [...a],
    sorted: { from: 0, to: n - 1 },
    found: a.map((_, i) => i),
    note: `Only the largest value is left, and it is already last. Sorted: ${show(a)}.`,
  });

  return {
    problem: "sorting/selection-sort",
    row: { values: [...nums], display: "bars" },
    pointerNames: ["i", "j", "min"],
    steps,
    answer: a,
    answerDisplay: show(a),
  };
}

export const selectionSortTrace: TraceDefinition<[number[]]> = {
  problem: "sorting/selection-sort",
  exampleIndex: 0,
  exampleSource: "analogy",
  args: z.tuple([z.array(z.number().int().nonnegative()).min(1).max(8)]),
  run: selectionSort,
};
