import { z } from "zod";

import type { Trace, TraceDefinition, TraceStep } from "../types";
import { Pile } from "./shared";

const OPENER: Record<string, string> = { ")": "(", "]": "[", "}": "{" };

/**
 * Push every opener. A closer must match the opener on top, the most recent one still open: pop it and link the pair.
 * A closer with nothing to match, or the wrong kind on top, fails at once; anything left open at the end fails too.
 * Key steps: the first push, the stack at its deepest, the first match of each kind of bracket, any failure, and
 * the end.
 */
export function validParentheses(s: string): Trace {
  const pile = new Pile();
  const steps: TraceStep[] = [];
  const chars = [...s];
  // How deep the stack gets: the first time it gets there is worth a scene.
  let depth = 0;
  let deepest = 0;
  for (const ch of chars) {
    depth += OPENER[ch] ? -1 : 1;
    deepest = Math.max(deepest, depth);
  }
  let reachedDeepest = false;
  const matchedKinds = new Set<string>();
  let answer = true;
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const opener = OPENER[ch];
    if (opener === undefined) {
      pile.push({ label: ch, ref: i });
      const deepestNow = pile.size === deepest && !reachedDeepest;
      if (deepestNow) reachedDeepest = true;
      steps.push({
        kind: "push",
        key: i === 0 || deepestNow,
        pointers: { i },
        active: [i],
        note: `"${ch}" opens a box: push it. ${pile.size} still open.`,
        pile: pile.snapshot(),
      });
      continue;
    }
    const top = pile.top();
    if (!top || top.label !== opener) {
      if (top) pile.pop();
      answer = false;
      steps.push({
        kind: "mismatch",
        key: true,
        pointers: { i },
        active: [i],
        note: top
          ? `"${ch}" needs "${opener}" on top, but "${top.label}" is there: unbalanced.`
          : `"${ch}" has nothing open to close: unbalanced.`,
        pile: pile.snapshot(),
      });
      break;
    }
    pile.pop();
    pile.resolve(top.ref!, i, "match");
    const uncovers = pile.size > 0;
    steps.push({
      kind: "match",
      // The first match of each kind of bracket.
      key: !matchedKinds.has(ch),
      pointers: { i },
      active: [i],
      found: [top.ref!, i],
      note: `"${ch}" matches "${top.label}" on top: pop it.${uncovers ? ` Now "${pile.top()!.label}" is on top again.` : " Nothing is open."}`,
      pile: pile.snapshot(),
    });
    matchedKinds.add(ch);
  }
  if (answer && pile.size > 0) answer = false;
  steps.push({
    kind: "done",
    key: true,
    pointers: {},
    note: answer
      ? "Every closer matched the most recent opener, and the stack is empty: balanced."
      : pile.size > 0 && steps.at(-1)!.kind !== "mismatch"
        ? `${pile.size} ${pile.size === 1 ? "opener is" : "openers are"} never closed: unbalanced.`
        : "The string is unbalanced.",
    pile: pile.snapshot(),
  });
  return {
    problem: "stack/valid-parentheses",
    row: { values: chars, display: "cards" },
    pointerNames: ["i"],
    steps,
    answer,
    answerDisplay: String(answer),
  };
}

export const validParenthesesTrace: TraceDefinition<[string]> = {
  problem: "stack/valid-parentheses",
  exampleIndex: 0,
  exampleSource: "analogy",
  args: z.tuple([z.string().regex(/^[()[\]{}]{0,10}$/)]),
  run: validParentheses,
};
