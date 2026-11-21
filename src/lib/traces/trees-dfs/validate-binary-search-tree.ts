import { z } from "zod";

import type { TraceEquation, Trace, TraceDefinition } from "../types";
import { treeArgs, TreeWalk } from "./shared";

const bound = (value: number | null, side: "low" | "high") =>
  value === null ? (side === "low" ? "-∞" : "∞") : String(value);

/**
 * Every node must sit strictly between a lower and an upper bound inherited from its ancestors: going left, the
 * node's value becomes the upper bound; going right, the lower. A missing child is valid. The first value outside
 * its bounds answers false, and `left && right` stops there, so the rest of the tree is skipped (an early exit). Key
 * steps: the root, the first node checked against a bound, the first node outside its bounds (or, in a valid tree,
 * the last check), and the root's answer.
 */
export function validateBinarySearchTree(root: (number | null)[]): Trace {
  const walk = new TreeWalk(root, "valid");
  let firstBounded = true;
  let failed = false;

  /** The bound that matters: the one broken, else the tighter finite one. */
  const check = (value: number, low: number | null, high: number | null): TraceEquation | undefined => {
    const cmp = (target: number) => (value < target ? "<" : value > target ? ">" : "=") as "<" | "=" | ">";
    const at = (target: number, ok: boolean): TraceEquation => ({
      terms: [value],
      operator: "+",
      result: value,
      comparison: { op: cmp(target), target },
      tone: ok ? "positive" : "negative",
    });
    if (low !== null && value <= low) return at(low, false);
    if (high !== null && value >= high) return at(high, false);
    if (high !== null) return at(high, true);
    if (low !== null) return at(low, true);
    return undefined;
  };

  const valid = (id: number, low: number | null, high: number | null): boolean => {
    walk.enter(id);
    const value = walk.value(id);
    walk.badge(id, `(${bound(low, "low")}, ${bound(high, "high")})`);
    const equation = check(value, low, high);
    const inside = (low === null || value > low) && (high === null || value < high);
    if (!inside) {
      const first = !failed;
      failed = true;
      walk.leave("false", {
        kind: "outside",
        key: first,
        note: `${value} must be between ${bound(low, "low")} and ${bound(high, "high")}, but it isn't: ${value} ${equation!.comparison!.op === "=" ? "equals" : value <= (low ?? -Infinity) ? "is below" : "is above"} ${equation!.comparison!.target}. This call answers false.`,
        equation,
      });
      return false;
    }
    const bounded = low !== null || high !== null;
    const key = id === 0 || (bounded && firstBounded);
    if (bounded) firstBounded = false;
    walk.record({
      kind: "inside",
      key,
      note:
        id === 0
          ? `The root, ${value}, has no bounds yet. Everything on its left must be below ${value}, everything on its right above it.`
          : `${value} fits between ${bound(low, "low")} and ${bound(high, "high")}. Its left side inherits the upper bound ${value}, its right side the lower bound ${value}.`,
      ...(equation ? { equation } : {}),
    });
    for (const side of ["left", "right"] as const) {
      const child = walk.child(id, side);
      if (child === null) {
        walk.base(id, side, "true", {
          kind: "base",
          key: false,
          note: `${value} has no ${side} child: an empty subtree is always valid.`,
        });
        continue;
      }
      const ok = side === "left" ? valid(child, low, value) : valid(child, value, high);
      if (!ok) {
        // `left && right`: a false left side means the right side is never checked.
        const rest = side === "left" ? walk.subtree(walk.child(id, "right")) : [];
        walk.skip(rest);
        walk.leave("false", {
          kind: id === 0 ? "done" : "pass-up",
          key: id === 0,
          note:
            rest.length > 0
              ? `${value} heard false, so it answers false without checking ${rest.map((n) => walk.value(n)).join(", ")}: an early exit.`
              : `${value} heard false from its ${side} side, so it answers false too.`,
        });
        return false;
      }
    }
    walk.leave("true", {
      kind: id === 0 ? "done" : "return",
      key: id === 0,
      note:
        id === 0
          ? "Every node fit its bounds: the tree is a valid search tree."
          : `Everything under ${value} fits, so it answers true.`,
    });
    return true;
  };

  let answer = true;
  if (walk.nodes.length === 0) {
    walk.steps.push({
      kind: "done",
      key: true,
      pointers: {},
      note: "An empty tree is a valid search tree.",
      tree: { path: [], done: [] },
      stack: [{ label: "valid(∅)", node: null, returns: "true" }],
    });
  } else answer = valid(0, null, null);

  return {
    problem: "trees-dfs/validate-binary-search-tree",
    row: { values: walk.values(), display: "tree" },
    tree: { nodes: walk.nodes },
    pointerNames: [],
    steps: walk.steps,
    answer,
    answerDisplay: String(answer),
  };
}

export const validateBinarySearchTreeTrace: TraceDefinition<[(number | null)[]]> = {
  problem: "trees-dfs/validate-binary-search-tree",
  exampleIndex: 1,
  exampleSource: "analogy",
  args: z.tuple([treeArgs]),
  run: validateBinarySearchTree,
};
