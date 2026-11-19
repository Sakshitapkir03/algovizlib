import { z } from "zod";

import type { Trace, TraceDefinition, TraceStep } from "../types";

const show = (values: readonly number[]) => `[${values.join(", ")}]`;

/**
 * Counting sort over the values present (min..max; the catalog problem's -50..50 range works the same with an
 * offset). Phase 1: one step per input value, adding 1 to its tally. Phase 2: one step per output slot, writing
 * the smallest value whose tally is still positive. Key steps: the first tally, the first repeated value, the
 * finished tally, the first write, the first value written twice, and the finish.
 */
export function countingSort(nums: number[]): Trace {
  const n = nums.length;
  const lo = Math.min(...nums);
  const hi = Math.max(...nums);
  const keys = Array.from({ length: hi - lo + 1 }, (_, k) => lo + k);
  const counts = keys.map(() => 0);
  const steps: TraceStep[] = [];
  let sawRepeat = false;

  nums.forEach((v, i) => {
    const k = v - lo;
    const before = counts[k];
    counts[k]++;
    const repeat = before > 0;
    steps.push({
      kind: "count",
      key: i === 0 || (repeat && !sawRepeat),
      pointers: { i },
      equation: { terms: [before, 1], operator: "+", result: counts[k] },
      active: [i],
      values: [...nums],
      counts: { keys, counts: [...counts], active: k },
      note: `Value ${v}: its tally goes from ${before} to ${counts[k]}.${repeat ? ` ${v} has been seen before.` : ""}`,
    });
    sawRepeat ||= repeat;
  });

  const out: number[] = [];
  const all = Array.from({ length: n }, (_, i) => i);
  steps.push({
    kind: "tallied",
    key: true,
    pointers: {},
    values: all.map(() => 0),
    empty: all,
    counts: { keys, counts: [...counts] },
    note: `Every value is counted: ${keys.map((key, k) => `${counts[k]}× ${key}`).join(", ")}. Now write the output from the smallest value up.`,
  });

  let sawSecondCopy = false;
  for (let k = 0; k < keys.length; k++) {
    let copy = 0;
    while (counts[k] > 0) {
      const before = counts[k];
      counts[k]--;
      out.push(keys[k]);
      copy++;
      const values = all.map((i) => out[i] ?? 0);
      const pos = out.length - 1;
      steps.push({
        kind: "write",
        key: pos === 0 || (copy === 2 && !sawSecondCopy),
        pointers: { out: pos },
        equation: { terms: [before, 1], operator: "-", result: counts[k] },
        values,
        ...(out.length < n ? { empty: all.slice(out.length) } : {}),
        sorted: { from: 0, to: pos },
        counts: { keys, counts: [...counts], active: k },
        note: `Write ${keys[k]} at position ${pos}; its tally drops to ${counts[k]}.`,
      });
      sawSecondCopy ||= copy === 2;
    }
  }
  steps.push({
    kind: "done",
    key: true,
    pointers: {},
    values: [...out],
    sorted: { from: 0, to: n - 1 },
    found: [...all],
    counts: { keys, counts: [...counts] },
    note: `Every tally is used up, and the output is sorted: ${show(out)}.`,
  });

  return {
    problem: "sorting/counting-sort",
    row: { values: [...nums], display: "bars" },
    pointerNames: ["i", "out"],
    steps,
    answer: out,
    answerDisplay: show(out),
  };
}

export const countingSortTrace: TraceDefinition<[number[]]> = {
  problem: "sorting/counting-sort",
  exampleIndex: 0,
  exampleSource: "analogy",
  // Bars can't be negative and the tally panel shows one cell per value from min to max, so keep both small.
  args: z.tuple([
    z
      .array(z.number().int().min(0).max(9))
      .min(1)
      .max(8)
      .refine((a) => Math.max(...a) - Math.min(...a) <= 7, "values must span at most 8 tally cells"),
  ]),
  run: countingSort,
};
