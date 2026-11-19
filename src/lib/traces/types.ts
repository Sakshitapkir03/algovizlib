import type { z } from "zod";

import type { VerdictTone } from "@/lib/storyboard/elements";

/**
 * A trace is the exact sequence of decisions an algorithm makes on one input, with a state snapshot at every
 * step. Storyboards bind scenes to steps (`scene.traceStep`), and `validateStoryboard` checks every pointer,
 * equation, and highlight against them. Traces are app code: the video needs them at render time.
 */

export type TraceValue = number | string;
export type TraceComparisonOp = "<" | "=" | ">";
export type TraceOperator = "+" | "-" | "×";

export type TraceEquation = {
  terms: number[];
  operator: TraceOperator;
  result: number;
  /** How `result` compares with `target` (e.g. sum vs target, area vs best so far). */
  comparison?: { op: TraceComparisonOp; target: number };
  /**
   * How this step's outcome reads, when the sign alone would mislead (a "new best" is `>` but good news). Bound
   * equations inherit it as `verdictTone`. Omit it to keep the sign-based colors.
   */
  tone?: VerdictTone;
};

export type TraceStep = {
  /** Machine-readable decision, e.g. "compare", "move-left", "skip", "found", "done". */
  kind: string;
  /** Key decisions must be shown by some scene. Others may happen off-screen. */
  key: boolean;
  /** Named pointer positions at this step, e.g. `{ left: 0, right: 6 }`. */
  pointers: Record<string, number>;
  /** One sentence describing the decision and why. Shown to the model and in validation errors. */
  note: string;
  equation?: TraceEquation;
  /** Items being examined now. */
  active?: number[];
  /** Items ruled out so far. */
  rejected?: number[];
  /** Items that form the answer (or the current hit, e.g. a found triplet). */
  found?: number[];
  /** Container between two bars, filled to `level` (bar-row only). */
  fill?: { from: number; to: number; level: number };
  /** Water standing on each bar so far (bar-row only). */
  water?: number[];
  /**
   * The array as it stands after this step, for algorithms that rearrange it (sorting). Omit when the array never
   * changes; rows then show `trace.row.values`.
   */
  values?: TraceValue[];
  /** Bars that moved into new slots during this step (a swap is two moves, a shift is one). */
  moves?: { from: number; to: number }[];
  /** Slots drawn as empty outlines: the gap left by a held value, or output not written yet. */
  empty?: number[];
  /** Positions already in their final place (inclusive range), e.g. the sorted tail in bubble sort. */
  sorted?: { from: number; to: number };
  /** A value lifted out of the array (insertion sort's key), waiting above slot `index`. */
  held?: { value: number; index: number };
  /** A tally per value (counting sort): `counts[i]` is how many times `keys[i]` has been seen. */
  counts?: { keys: number[]; counts: number[]; active?: number };
  /** Divide and conquer: the subarray this step works on (inclusive). */
  range?: { from: number; to: number };
  /** Recursion depth of `range` (0 = the whole array). */
  depth?: number;
  /** How the array is currently split into groups (inclusive ranges covering every position, in order). */
  segments?: { from: number; to: number }[];
  /**
   * Every level of the recursion at once, for an overview: `splitTree[level]` lists the groups' values at that
   * depth, from the whole array down to single values.
   */
  splitTree?: number[][][];
  /** A merge in progress: the output written so far (`null` = not yet), lined up under positions `from`…. */
  buffer?: { from: number; values: (number | null)[]; taken?: number };
  /** Quick sort: the pivot's position and the partition line (positions in `range` before it are < the pivot). */
  pivot?: number;
  boundary?: number;
  /** Heap sort: positions 0…heapSize-1 are the heap (the rest are sorted), and the pair compared in a sift-down. */
  heapSize?: number;
  compare?: [number, number];
  /** A running total (e.g. inversions found so far) and how much this step added. */
  counter?: { value: number; delta?: number };
};

export type Trace = {
  /** "pattern/slug" of the catalog problem. */
  problem: string;
  /** The values the video animates, in display order. */
  row: { values: TraceValue[]; display: "cards" | "bars" };
  pointerNames: string[];
  steps: TraceStep[];
  /** Same shape the reference solution returns. */
  answer: unknown;
  /** How the answer is shown on screen; a `result` with `showsAnswer` must display exactly this. */
  answerDisplay: string;
  /** When the answer is a set of positions in `row`, e.g. the pair of indices. */
  answerIndices?: number[];
};

export type TraceDefinition<A extends unknown[] = unknown[]> = {
  problem: string;
  /** Which of the problem's examples the video uses. */
  exampleIndex: number;
  /**
   * Where the video's real-world example comes from (see "Choosing the example" in CLAUDE.md): "problem-native"
   * when the statement already tells a real-world story the video must keep, "analogy" when it's abstract.
   */
  exampleSource: "problem-native" | "analogy";
  /** Validates the example's positional `args`. */
  args: z.ZodType<A>;
  run: (...args: A) => Trace;
};

export function compare(a: number, b: number): TraceComparisonOp {
  return a < b ? "<" : a > b ? ">" : "=";
}

/** Numbers in this list, ascending (for set-like index lists). */
export const sortedIndices = (indices: Iterable<number>) => [...indices].sort((a, b) => a - b);
