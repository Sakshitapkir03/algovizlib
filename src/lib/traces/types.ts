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
  /**
   * Positions already in their final place when they don't form one range (quick sort places pivots anywhere).
   * Takes precedence over `sorted`.
   */
  final?: number[];
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
  /**
   * Sliding window: the positions it covers (inclusive; `to = from - 1` when it's empty) and the value it's labeled
   * with (its sum, its length…).
   */
  window?: { from: number; to: number; value?: number | string };
  /**
   * Character counts in the window (sliding-window string problems). `need` is how many the target requires
   * (Minimum Window Substring); `active` is the key that just changed.
   */
  freq?: { entries: { key: string; count: number; need?: number }[]; active?: string };
  /**
   * Monotonic deque of positions, front first (Sliding Window Maximum), what this step removed from each end, and
   * the answer written so far.
   */
  deque?: { indices: number[]; poppedBack?: number[]; poppedFront?: number[]; output: number[] };
  /**
   * Binary search over the row: the positions still in play (inclusive; `to = from - 1` once it's empty, which marks
   * the gap before `from`), the position just checked, and (rotated arrays) the half known to be sorted.
   */
  search?: { from: number; to: number; mid?: number; sorted?: { from: number; to: number } };
  /**
   * Binary search on the answer: candidates `min`…`max`. Everything below `low` is ruled out, everything from `high`
   * up is known to work, and `mid` is the candidate just tested.
   */
  answers?: { min: number; max: number; low: number; high: number; mid?: number };
  /** Two-list partition (Median of Two Sorted Arrays): how many values sit left of the cut in each list. */
  cuts?: { first: number; second: number };
  /**
   * Linked lists: every node after this step (its `next`, and where it's drawn), plus the links this step rewired.
   * Pointers, highlights, and `trace.row.values` refer to nodes by id (see `TraceLinks`).
   */
  links?: TraceLinks;
  /** A min-heap's array after this step (Merge K Sorted Lists' heads), drawn by a heap-tree. */
  heap?: number[];
  /** A binary tree's walk after this step (the tree's shape is `trace.tree`). See `TraceTreeWalk`. */
  tree?: TraceTreeWalk;
  /** The recursion's open calls, bottom (the first call) to top (the running one). */
  stack?: TraceFrame[];
};

/**
 * A binary tree's node. Ids are positions in level order counting only real nodes (0 = the root), never change,
 * and `trace.row.values[id]` is the node's value; pointers and highlights refer to nodes by id.
 */
export type TraceTreeNode = { id: number; value: number; left: number | null; right: number | null };

export type TreeSide = "left" | "right";

/** Where a recursive walk is: which call runs, which calls are open, finished, or never made. */
export type TraceTreeWalk = {
  /** The node whose call is running (it may be returning in this step). */
  current?: number;
  /** A call on a missing child (the base case): the child of `parent` on `side`, drawn as a "null" stub. */
  nullVisit?: { parent: number; side: TreeSide };
  /** Nodes with an open call, root first (the path from the root to the running call). */
  path: number[];
  /** Nodes whose call has returned. */
  done: number[];
  /** Nodes never visited because an answer came early (an early exit skips their whole subtree). */
  skipped?: number[];
  /** A value handed up this step: from the child of `to` on `side` (a node or a missing child) to `to`. */
  returned?: { to: number; side: TreeSide; value: string };
  /** What each finished call returned, shown beside its node. */
  results?: { node: number; value: string }[];
  /** Running state carried down to a node (the sum so far, the bounds, the best on the path). */
  badges?: { node: number; text: string }[];
};

/** One open call: `label` reads like the call ("depth(5)", "depth(∅)"), `waiting` names the child it's waiting on. */
export type TraceFrame = {
  label: string;
  node: number | null;
  waiting?: TreeSide;
  /** Set in the step where the call returns (the frame pops after it). */
  returns?: string;
};

/**
 * Linked-list state. Node ids are 0…n-1 and never change; `trace.row.values[id]` is node `id`'s value. A node sits
 * in a lane (one horizontal list on screen: an input list, the merged list…) at a slot (left to right); nodes slide
 * when their lane or slot changes between bound steps.
 */
export type TraceListNode = {
  id: number;
  value: TraceValue;
  /** The node this one links to, or null (the end of a list). */
  next: number | null;
  lane: number;
  slot: number;
  /** A placeholder node in front of the real list (the dummy-node trick). */
  dummy?: boolean;
};

export type TraceLinks = {
  nodes: TraceListNode[];
  /** Links this step changed: `node` used to point at `from` and now points at `to`. */
  rewired?: { node: number; from: number | null; to: number | null }[];
};

export type Trace = {
  /** "pattern/slug" of the catalog problem. */
  problem: string;
  /** The values the video animates, in display order. */
  row: { values: TraceValue[]; display: "cards" | "bars" | "list" | "tree" };
  /** A binary tree's shape (display "tree"); it never changes, steps record the walk over it. */
  tree?: { nodes: TraceTreeNode[] };
  /** A second list shown under the first (an item-row with `traceRow: "second"`), e.g. Median's `nums2`. */
  secondRow?: { values: TraceValue[] };
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

/** The positions a step marks as final: its `final` set, else its `sorted` range. */
export function finalPositions(step: TraceStep): number[] | undefined {
  if (step.final) return step.final;
  if (!step.sorted) return undefined;
  return Array.from({ length: step.sorted.to - step.sorted.from + 1 }, (_, k) => step.sorted!.from + k);
}

/** Numbers in this list, ascending (for set-like index lists). */
export const sortedIndices = (indices: Iterable<number>) => [...indices].sort((a, b) => a - b);
