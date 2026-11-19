import type { TraceStep } from "../types";

type Range = { from: number; to: number };

export const show = (values: readonly number[]) => `[${values.join(", ")}]`;
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/** Every level of a top-down split (mid = ⌊(lo + hi) / 2⌋), with single values carried down so each level covers the array. */
export function splitLevels(nums: readonly number[]): number[][][] {
  const levels: Range[][] = [[{ from: 0, to: nums.length - 1 }]];
  while (levels.at(-1)!.some((g) => g.from < g.to)) {
    levels.push(
      levels.at(-1)!.flatMap((g) => {
        if (g.from === g.to) return [g];
        const mid = Math.floor((g.from + g.to) / 2);
        return [
          { from: g.from, to: mid },
          { from: mid + 1, to: g.to },
        ];
      }),
    );
  }
  return levels.map((level) => level.map((g) => nums.slice(g.from, g.to + 1)));
}

export type MergeRun = {
  steps: TraceStep[];
  sorted: number[];
  inversions: number;
};

/**
 * Top-down merge sort, one step per decision: a "split" step (every value on its own), then for each merge
 * (children before parents, left before right) one "take" step per comparison of the two fronts, a "copy-rest"
 * step when one half runs out, and a "merged" step that writes the buffer back. A taken value is copied
 * into the buffer (lined up under the subarray it will fill) and its slot is drawn empty from the next step on.
 *
 * With `countInversions`, every step carries the running count; taking from the right half adds the number of
 * values still waiting in the left half, all at once. Every step is non-key: each trace marks its own.
 */
export function runMergeSort(nums: readonly number[], options: { countInversions: boolean }): MergeRun {
  const a = [...nums];
  const n = a.length;
  const steps: TraceStep[] = [];
  let segments: Range[] = a.map((_, i) => ({ from: i, to: i }));
  let inversions = 0;
  const counter = (delta?: number) =>
    options.countInversions
      ? { counter: { value: inversions, ...(delta !== undefined ? { delta } : {}) } }
      : {};

  steps.push({
    kind: "split",
    key: false,
    pointers: {},
    values: [...a],
    // No active range: the point of this step is that every group is a single value.
    segments: segments.map((s) => ({ ...s })),
    splitTree: splitLevels(nums),
    ...counter(),
    note: `Split ${show(a)} in half, and each half in half again, until every value stands alone. A single value is already sorted.`,
  });

  const sort = (lo: number, hi: number, depth: number) => {
    if (lo >= hi) return;
    const mid = Math.floor((lo + hi) / 2);
    sort(lo, mid, depth + 1);
    sort(mid + 1, hi, depth + 1);
    merge(lo, mid, hi, depth);
  };

  const merge = (lo: number, mid: number, hi: number, depth: number) => {
    const buffer: (number | null)[] = Array.from({ length: hi - lo + 1 }, () => null);
    const source: number[] = [];
    const empty: number[] = [];
    const left = show(a.slice(lo, mid + 1));
    const right = show(a.slice(mid + 1, hi + 1));
    const base = () => ({
      values: [...a],
      range: { from: lo, to: hi },
      depth,
      segments: segments.map((s) => ({ ...s })),
      empty: [...empty],
    });
    let i = lo;
    let j = mid + 1;
    let k = 0;
    while (i <= mid && j <= hi) {
      const fromLeft = a[i] <= a[j];
      const taken = fromLeft ? i : j;
      const added = fromLeft ? 0 : mid - i + 1;
      inversions += added;
      buffer[k] = a[taken];
      source.push(taken);
      const waiting = show(a.slice(i, mid + 1));
      steps.push({
        kind: fromLeft ? "take-left" : "take-right",
        key: false,
        pointers: { i, j },
        equation: {
          terms: [a[i]],
          operator: "+",
          result: a[i],
          comparison: { op: a[i] < a[j] ? "<" : a[i] > a[j] ? ">" : "=", target: a[j] },
          // Taking a front is never bad news in plain merge sort. Counting inversions, a right-hand take is the
          // event being counted: every value still waiting on the left is out of order with it.
          tone: options.countInversions && !fromLeft ? "negative" : "positive",
        },
        active: [i, j],
        ...base(),
        buffer: { from: lo, values: [...buffer], taken: k },
        ...counter(added),
        note: fromLeft
          ? `Merging ${left} and ${right}: compare the fronts, ${a[i]} ≤ ${a[j]}, so take ${a[i]} from the left half.${options.countInversions ? " Nothing on the left is bigger than it, so no inversions." : ""}`
          : options.countInversions
            ? `Merging ${left} and ${right}: ${a[j]} < ${a[i]}, so take ${a[j]} from the right half. ${added === 1 ? `The 1 value still waiting on the left (${waiting}) is bigger than it and came before it: +1 inversion` : `All ${added} values still waiting on the left (${waiting}) are bigger than it and came before it: +${added} inversions at once`} (${inversions} so far).`
            : `Merging ${left} and ${right}: compare the fronts, ${a[i]} > ${a[j]}, so take ${a[j]} from the right half.`,
      });
      // The taken value stays visible (and highlighted) in its own step, then leaves its slot.
      empty.push(taken);
      if (fromLeft) i++;
      else j++;
      k++;
    }
    if (i <= mid || j <= hi) {
      const [restFrom, restTo] = i <= mid ? [i, mid] : [j, hi];
      for (let r = restFrom; r <= restTo; r++) {
        buffer[k++] = a[r];
        source.push(r);
        empty.push(r);
      }
      const rest = show(a.slice(restFrom, restTo + 1));
      steps.push({
        kind: "copy-rest",
        key: false,
        pointers: i <= mid ? { i } : { j },
        ...base(),
        buffer: { from: lo, values: [...buffer], taken: k - 1 },
        ...counter(),
        note: `The ${i <= mid ? "right" : "left"} half is used up, so ${rest} ${restTo > restFrom ? "follow" : "follows"} in order with no more comparisons.`,
      });
    }
    const before = [...a];
    buffer.forEach((v, idx) => (a[lo + idx] = v!));
    segments = segments.flatMap((s) =>
      s.from === lo ? [{ from: lo, to: hi }] : s.from > lo && s.to <= hi ? [] : [s],
    );
    const isLast = lo === 0 && hi === n - 1;
    steps.push({
      kind: isLast ? "done" : "merged",
      key: isLast,
      pointers: {},
      values: [...a],
      moves: source.flatMap((from, idx) => (from !== lo + idx ? [{ from, to: lo + idx }] : [])),
      range: { from: lo, to: hi },
      depth,
      segments: segments.map((s) => ({ ...s })),
      ...counter(),
      ...(isLast ? { sorted: { from: 0, to: n - 1 }, found: a.map((_, idx) => idx) } : {}),
      note: isLast
        ? `The last merge writes ${show(a)} back: the whole array is sorted.${options.countInversions ? ` ${plural(inversions, "inversion")} in total.` : ""}`
        : `${show(before.slice(lo, hi + 1))} becomes ${show(a.slice(lo, hi + 1))}: one sorted run of ${hi - lo + 1}.${options.countInversions ? ` ${plural(inversions, "inversion")} so far.` : ""}`,
    });
  };

  sort(0, n - 1, 0);
  if (n === 1) {
    steps.push({
      kind: "done",
      key: true,
      pointers: {},
      values: [...a],
      segments: [{ from: 0, to: 0 }],
      sorted: { from: 0, to: 0 },
      found: [0],
      ...counter(),
      note: "A single value is already sorted.",
    });
  }
  return { steps, sorted: a, inversions };
}
