import { z } from "zod";

import { Pile } from "../stack/shared";
import { compare, type Trace, type TraceDefinition, type TraceStep } from "../types";
import { Calls, opStep } from "./shared";

/**
 * A stack of pairs (value, the minimum of everything at or below it). push stores min(value, the minimum under it);
 * the minimum is always the top pair's second half, so getMin is O(1), and pop restores the previous minimum for free
 * because it was stored with the pair underneath. Pairs are shown as "(6, 6)". One step per call. Key steps: the first
 * push, the first push that sets a new minimum and the first that doesn't, the first getMin, the first pop that
 * removes the minimum, and the last call. Tones: a new minimum is positive, keeping the old one neutral.
 */
export function minStack(operations: string[], args: number[][]): Trace {
  const calls = new Calls(operations, args);
  let pile = new Pile();
  let pairs: [number, number][] = [];
  const steps: TraceStep[] = [];
  const shown = new Set<string>();
  const first = (what: string) => (shown.has(what) ? false : (shown.add(what), true));
  const record = (step: Omit<TraceStep, "pointers" | "op" | "pile">) =>
    steps.push({ ...opStep(calls, step), pile: pile.snapshot() });

  operations.forEach((op, k) => {
    calls.run(k);
    const last = k === operations.length - 1;
    if (op === "MinStack") {
      pile = new Pile();
      pairs = [];
      calls.returns(null);
      record({ kind: "create", key: false, note: "A new stack: no pairs yet." });
      return;
    }
    if (op === "push") {
      const val = args[k][0];
      const below = pairs.at(-1)?.[1];
      const min = below === undefined ? val : Math.min(val, below);
      pairs.push([val, min]);
      pile.push({ label: `(${val}, ${min})` });
      calls.returns(null);
      const lower = below !== undefined && val < below;
      record({
        kind: below === undefined ? "push-first" : lower ? "push-new-min" : "push-keep-min",
        key:
          last ||
          first("push") ||
          (lower && first("lower")) ||
          (!lower && below !== undefined && first("keep")),
        note:
          below === undefined
            ? `push(${val}) on an empty stack: the minimum so far is ${val} itself, stored as (${val}, ${min}).`
            : lower
              ? `push(${val}): ${val} < ${below}, the minimum under it, so this pair records a new minimum: (${val}, ${min}).`
              : `push(${val}): ${val} ≥ ${below}, the minimum under it, so the pair keeps ${below}: (${val}, ${min}).`,
        ...(below !== undefined
          ? {
              equation: {
                terms: [val],
                operator: "+" as const,
                result: val,
                comparison: { op: compare(val, below), target: below },
                tone: lower ? ("positive" as const) : ("neutral" as const),
              },
            }
          : {}),
      });
      return;
    }
    if (op === "pop") {
      const [val, min] = pairs.pop()!;
      pile.pop();
      calls.returns(null);
      const restored = pairs.at(-1)?.[1];
      const wasMin = restored !== undefined && min < restored;
      record({
        kind: "pop",
        key: last || (wasMin && first("pop-min")),
        note:
          restored === undefined
            ? `pop() removes (${val}, ${min}); the stack is empty again.`
            : wasMin
              ? `pop() removes (${val}, ${min}), the minimum itself; the pair underneath already knows the minimum without it: ${restored}.`
              : `pop() removes (${val}, ${min}); the minimum stays ${restored}, stored in the pair underneath.`,
      });
      return;
    }
    const [val, min] = pairs.at(-1)!;
    calls.returns(op === "top" ? val : min);
    record({
      kind: op,
      key: last || (op === "getMin" && first("getMin")),
      note:
        op === "top"
          ? `top() reads the top pair's value: ${val}.`
          : `getMin() reads the top pair's minimum: ${min}, with no search through the stack.`,
    });
  });

  return {
    problem: "design/min-stack",
    row: { values: [], display: "cards" },
    pointerNames: [],
    ops: calls.ops(),
    steps,
    answer: calls.answer(),
    answerDisplay: calls.answerDisplay(),
  };
}

export const minStackTrace: TraceDefinition<[string[], number[][]]> = {
  problem: "design/min-stack",
  exampleIndex: 0,
  exampleSource: "analogy",
  args: z
    .tuple([
      z
        .array(z.enum(["MinStack", "push", "pop", "top", "getMin"]))
        .min(2)
        .max(11),
      z.array(z.array(z.number().int().min(-9).max(99)).max(1)),
    ])
    .refine(([ops]) => ops[0] === "MinStack" && !ops.slice(1).includes("MinStack"), "one stack, made first")
    .refine(([ops]) => {
      let size = 0;
      return ops.every((o) =>
        o === "push" ? ++size <= 6 : o === "pop" ? size-- > 0 : o === "MinStack" || size > 0,
      );
    }, "pop, top, and getMin on a non-empty stack, at most 6 pairs"),
  run: minStack,
};
