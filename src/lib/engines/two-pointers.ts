import type { ComparisonOp } from "@/lib/storyboard";

export type TwoPointersStep = {
  left: number;
  right: number;
  leftValue: number;
  rightValue: number;
  sum: number;
  /** How `sum` compares to the target. */
  comparison: ComparisonOp;
  /** What the algorithm does next because of that comparison. */
  action: "move-left" | "move-right" | "found";
};

export type TwoPointersState = { left: number; right: number };

export type TwoPointersResult = {
  steps: TwoPointersStep[];
  /** Every pointer position visited, in order (one more than `steps` when no pair is found). */
  states: TwoPointersState[];
  pair: [number, number] | null;
};

export function isSortedAscending(values: readonly number[]): boolean {
  return values.every((v, i) => i === 0 || values[i - 1] <= v);
}

/**
 * Pair sum on a sorted array. Returns the exact sequence of moves:
 * sum too small → advance `left`; too big → retreat `right`; equal → done.
 */
export function twoPointers(values: readonly number[], target: number): TwoPointersResult {
  if (!isSortedAscending(values)) {
    throw new Error("twoPointers requires values sorted in ascending order");
  }
  const steps: TwoPointersStep[] = [];
  const states: TwoPointersState[] = [];
  let left = 0;
  let right = values.length - 1;

  while (left < right) {
    states.push({ left, right });
    const sum = values[left] + values[right];
    const comparison: ComparisonOp = sum < target ? "<" : sum > target ? ">" : "=";
    const action = comparison === "<" ? "move-left" : comparison === ">" ? "move-right" : "found";
    steps.push({ left, right, leftValue: values[left], rightValue: values[right], sum, comparison, action });
    if (action === "found") return { steps, states, pair: [left, right] };
    if (action === "move-left") left++;
    else right--;
  }
  if (values.length > 0) states.push({ left, right });
  return { steps, states, pair: null };
}
