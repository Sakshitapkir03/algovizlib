import { z } from "zod";

import { Pile } from "../stack/shared";
import type { Trace, TraceDefinition, TraceStep } from "../types";
import { Calls, opStep } from "./shared";

/**
 * Two stacks make a queue: `in` takes every push; `out` serves pop and peek from its top. Only when `out` is empty and
 * the front is needed, every value is poured from `in` to `out` (pop, push), which reverses them, so the oldest ends on
 * top. Each value is poured at most once, so every call is amortized O(1). One step per call; a pour happens inside
 * the pop or peek that needs it. Key steps: the first push, every pour, the first pop that needs no pour, the first
 * push while `out` still holds values, and the last call.
 */
export function implementQueueUsingStacks(operations: string[], args: number[][]): Trace {
  const calls = new Calls(operations, args);
  let input = new Pile();
  let output = new Pile();
  const steps: TraceStep[] = [];
  const shown = new Set<string>();
  const first = (what: string) => (shown.has(what) ? false : (shown.add(what), true));
  const record = (step: Omit<TraceStep, "pointers" | "op" | "pile" | "secondPile">) =>
    steps.push({ ...opStep(calls, step), pile: input.snapshot(), secondPile: output.snapshot() });
  const item = (x: number) => ({ label: String(x) });

  // Pour everything from in to out when out is empty; returns how many moved.
  const refill = () => {
    if (output.size > 0) return 0;
    let moved = 0;
    while (input.size > 0) {
      output.push(input.pop());
      moved++;
    }
    return moved;
  };

  operations.forEach((op, k) => {
    calls.run(k);
    const last = k === operations.length - 1;
    if (op === "MyQueue") {
      input = new Pile();
      output = new Pile();
      calls.returns(null);
      record({ kind: "create", key: false, note: "A new queue: both stacks start empty." });
      return;
    }
    if (op === "push") {
      const x = args[k][0];
      input.push(item(x));
      calls.returns(null);
      const waiting = output.size > 0;
      record({
        kind: "push",
        key: last || first("push") || (waiting && first("push-waiting")),
        note: waiting
          ? `push(${x}) goes on top of in; out still holds older values, so ${x} waits behind them.`
          : `push(${x}) goes on top of in: one step, nothing else moves.`,
      });
      return;
    }
    if (op === "empty") {
      const empty = input.size === 0 && output.size === 0;
      calls.returns(empty);
      record({
        kind: "empty",
        key: last,
        note: empty
          ? "empty(): both stacks are empty, so the queue is empty: true."
          : `empty(): the stacks still hold ${input.size + output.size}, so false.`,
      });
      return;
    }
    // pop and peek both need the front: the top of out, after a pour if out is empty.
    const moved = refill();
    const front = Number(output.top()!.label);
    if (op === "pop") output.pop();
    calls.returns(front);
    const verb = op === "pop" ? "removes and returns" : "returns";
    record({
      kind: moved ? `${op}-pour` : op,
      key: last || moved > 0 || (op === "pop" && first("pop")),
      note: moved
        ? `${op}(): out is empty, so all ${moved} values pour from in to out, reversed; the oldest, ${front}, is now on top, and ${op} ${verb} it.`
        : `${op}(): out isn't empty, so its top, ${front}, is the front of the queue; ${op} ${verb} it without moving anything.`,
    });
  });

  return {
    problem: "design/implement-queue-using-stacks",
    row: { values: [], display: "cards" },
    pointerNames: [],
    ops: calls.ops(),
    steps,
    answer: calls.answer(),
    answerDisplay: calls.answerDisplay(),
  };
}

export const implementQueueUsingStacksTrace: TraceDefinition<[string[], number[][]]> = {
  problem: "design/implement-queue-using-stacks",
  exampleIndex: 0,
  exampleSource: "analogy",
  args: z
    .tuple([
      z
        .array(z.enum(["MyQueue", "push", "pop", "peek", "empty"]))
        .min(2)
        .max(11),
      z.array(z.array(z.number().int().min(1).max(9)).max(1)),
    ])
    .refine(([ops]) => ops[0] === "MyQueue" && !ops.slice(1).includes("MyQueue"), "one queue, made first")
    .refine(([ops]) => {
      let size = 0;
      return ops.every((o) =>
        o === "push" ? ++size <= 6 : o === "pop" ? size-- > 0 : o === "peek" ? size > 0 : true,
      );
    }, "pop and peek on a non-empty queue, at most 6 values held"),
  run: implementQueueUsingStacks,
};
