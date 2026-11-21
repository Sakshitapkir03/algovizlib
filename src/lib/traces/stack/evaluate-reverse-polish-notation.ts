import { z } from "zod";

import type { Trace, TraceDefinition, TraceEquation, TraceStep } from "../types";
import { Pile } from "./shared";

const OPS = new Set(["+", "-", "*", "/"]);

/**
 * Numbers go on the stack. An operator pops the top two (the right operand first), combines them, and pushes the
 * result, so the stack always holds the values still waiting for an operator. At the end one value is left: the
 * answer. Key steps: the first numbers waiting, every operator, and the answer.
 */
export function evaluateRpn(tokens: string[]): Trace {
  const pile = new Pile();
  const steps: TraceStep[] = [];
  let firstPush = true;
  tokens.forEach((token, i) => {
    if (!OPS.has(token)) {
      pile.push({ label: token, ref: i });
      const waiting = pile.size >= 2 && firstPush;
      if (waiting) firstPush = false;
      steps.push({
        kind: "push",
        key: waiting,
        pointers: { i },
        active: [i],
        note: `${token} is a number: push it. It waits for an operator.`,
        pile: pile.snapshot(),
      });
      return;
    }
    const right = Number(pile.pop().label);
    const left = Number(pile.pop().label);
    const value =
      token === "+"
        ? left + right
        : token === "-"
          ? left - right
          : token === "*"
            ? left * right
            : Math.trunc(left / right);
    pile.push({ label: String(value), ref: i });
    // Division has no equation operator: its arithmetic is in the note.
    const equation: TraceEquation | undefined =
      token === "/"
        ? undefined
        : { terms: [left, right], operator: token === "*" ? "×" : (token as "+" | "-"), result: value };
    steps.push({
      kind: "apply",
      key: true,
      pointers: { i },
      active: [i],
      note: `"${token}" pops ${right} and then ${left}, and pushes ${left} ${token === "*" ? "×" : token} ${right} = ${value}.`,
      ...(equation ? { equation } : {}),
      pile: pile.snapshot(),
    });
  });
  const answer = Number(pile.top()!.label);
  steps.push({
    kind: "done",
    key: true,
    pointers: {},
    note: `One value is left on the stack: ${answer}.`,
    pile: pile.snapshot(),
  });
  return {
    problem: "stack/evaluate-reverse-polish-notation",
    row: { values: tokens, display: "cards" },
    pointerNames: ["i"],
    steps,
    answer,
    answerDisplay: String(answer),
  };
}

export const evaluateReversePolishNotationTrace: TraceDefinition<[string[]]> = {
  problem: "stack/evaluate-reverse-polish-notation",
  exampleIndex: 0,
  exampleSource: "analogy",
  args: z.tuple([
    z
      .array(z.string().regex(/^(-?\d{1,3}|[+\-*/])$/))
      .min(1)
      .max(9),
  ]),
  run: evaluateRpn,
};
