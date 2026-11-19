import { z } from "zod";

import { compare, type Trace, type TraceDefinition, type TraceStep } from "../types";

const show = (values: readonly number[]) => `[${values.join(", ")}]`;

/**
 * Insertion sort. For each `i`, lift `a[i]` out (leaving a gap), shift every larger value in the sorted prefix one
 * slot right (the gap moves left), then drop the value into the gap. Key steps: the first lift, the first shift,
 * the first insertion, a value already in place, the insertion after the longest run of shifts, and the finish.
 */
export function insertionSort(nums: number[]): Trace {
  const a = [...nums];
  const n = a.length;
  const steps: TraceStep[] = [];
  let longest = { shifts: 0, step: -1 };

  for (let i = 1; i < n; i++) {
    const held = a[i];
    steps.push({
      kind: "lift",
      key: i === 1,
      pointers: { i },
      values: [...a],
      empty: [i],
      held: { value: held, index: i },
      sorted: { from: 0, to: i - 1 },
      note: `Lift out ${held} (position ${i}). Everything to its left is already sorted; find where ${held} belongs there.`,
    });
    let j = i - 1;
    let shifts = 0;
    while (j >= 0 && a[j] > held) {
      a[j + 1] = a[j];
      steps.push({
        kind: "shift",
        key: steps.every((s) => s.kind !== "shift"),
        // j points at the value just compared, which now sits one slot right; the gap is where it came from.
        pointers: { i, j: j + 1 },
        // Shifting is routine work, not bad news, even though the sign is ">".
        equation: {
          terms: [a[j]],
          operator: "+",
          result: a[j],
          comparison: { op: ">", target: held },
          tone: "neutral",
        },
        active: [j + 1],
        values: [...a],
        moves: [{ from: j, to: j + 1 }],
        empty: [j],
        held: { value: held, index: j },
        sorted: { from: 0, to: i - 1 },
        note: `${a[j]} > ${held}, so shift ${a[j]} one slot right. The gap moves to position ${j}.`,
      });
      j--;
      shifts++;
    }
    a[j + 1] = held;
    const stop = j >= 0 ? a[j] : undefined;
    const inPlace = shifts === 0;
    steps.push({
      kind: inPlace ? "in-place" : "insert",
      key: (inPlace && steps.every((s) => s.kind !== "in-place")) || i === 1,
      pointers: j >= 0 ? { i, j } : { i },
      ...(stop !== undefined
        ? {
            equation: {
              terms: [stop],
              operator: "+" as const,
              result: stop,
              comparison: { op: compare(stop, held), target: held },
              tone: "positive" as const,
            },
            active: [j],
          }
        : {}),
      values: [...a],
      sorted: { from: 0, to: i },
      note:
        stop === undefined
          ? `Nothing is left to compare: ${held} is the smallest so far, so it drops into position 0. Now ${show(a)}.`
          : inPlace
            ? `${stop} ≤ ${held}: ${held} is already in the right place. Positions 0–${i} are sorted.`
            : `${stop} ≤ ${held}, so ${held} drops into the gap at position ${j + 1}. Now ${show(a)}.`,
    });
    if (shifts > longest.shifts) longest = { shifts, step: steps.length - 1 };
  }
  if (longest.step >= 0) steps[longest.step].key = true;
  steps.push({
    kind: "done",
    key: true,
    pointers: {},
    values: [...a],
    sorted: { from: 0, to: n - 1 },
    found: a.map((_, i) => i),
    note: `Every value has been inserted into the sorted part: ${show(a)}.`,
  });

  return {
    problem: "sorting/insertion-sort",
    row: { values: [...nums], display: "bars" },
    pointerNames: ["i", "j"],
    steps,
    answer: a,
    answerDisplay: show(a),
  };
}

export const insertionSortTrace: TraceDefinition<[number[]]> = {
  problem: "sorting/insertion-sort",
  exampleIndex: 0,
  exampleSource: "analogy",
  args: z.tuple([z.array(z.number().int().nonnegative()).min(1).max(8)]),
  run: insertionSort,
};
