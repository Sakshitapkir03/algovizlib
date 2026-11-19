import { bubbleSortTrace } from "./sorting/bubble-sort";
import { countingSortTrace } from "./sorting/counting-sort";
import { insertionSortTrace } from "./sorting/insertion-sort";
import { selectionSortTrace } from "./sorting/selection-sort";
import { containerWithMostWaterTrace } from "./two-pointers/container-with-most-water";
import { pairWithTargetSumTrace } from "./two-pointers/pair-with-target-sum";
import { threeSumTrace } from "./two-pointers/three-sum";
import { trappingRainWaterTrace } from "./two-pointers/trapping-rain-water";
import { validPalindromeTrace } from "./two-pointers/valid-palindrome";
import type { Trace, TraceDefinition } from "./types";

export * from "./types";

/**
 * Every problem that can be animated, keyed by "pattern/slug". A problem becomes generatable by adding its trace
 * here (see "How to make a problem generatable" in CLAUDE.md).
 */
const definitions = [
  pairWithTargetSumTrace,
  validPalindromeTrace,
  containerWithMostWaterTrace,
  threeSumTrace,
  trappingRainWaterTrace,
  bubbleSortTrace,
  selectionSortTrace,
  insertionSortTrace,
  countingSortTrace,
] as const;

// Each definition is typed with its own argument tuple; the registry erases that behind `runTrace`, which
// validates args first.
type AnyTraceDefinition = Omit<TraceDefinition, "run" | "args"> & {
  args: TraceDefinition["args"];
  run: (...args: never[]) => Trace;
};

export const traceRegistry: Readonly<Record<string, AnyTraceDefinition>> = Object.fromEntries(
  definitions.map((d) => [d.problem, d as unknown as AnyTraceDefinition]),
);

export function getTraceDefinition(problem: string): AnyTraceDefinition | undefined {
  return traceRegistry[problem];
}

/** Run a problem's trace on positional JSON args. Throws a readable error on unknown problems or bad args. */
export function runTrace(problem: string, args: unknown[]): Trace {
  const def = getTraceDefinition(problem);
  if (!def) throw new Error(`No trace is registered for "${problem}"`);
  const parsed = def.args.safeParse(args);
  if (!parsed.success) {
    throw new Error(
      `Invalid args for "${problem}": ${parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"} ${i.message}`).join("; ")}`,
    );
  }
  return def.run(...(parsed.data as never[]));
}
