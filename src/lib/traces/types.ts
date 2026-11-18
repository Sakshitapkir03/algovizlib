import type { z } from "zod";

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
