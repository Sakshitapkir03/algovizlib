import { z } from "zod";

import type { Trace, TraceDefinition, TraceStep } from "../types";
import { treeArgs, TreeWalk } from "./shared";

/**
 * Carry the largest value on the path so far down the tree. A node is good when it's at least that large; it then
 * raises the maximum for everything under it. Each call returns how many good nodes its subtree holds (its own 1 or
 * 0 plus both children's counts), and a missing child returns 0. Key steps: the root, the first node that isn't
 * good, a good node under a parent that isn't, the first inner node handing its count up, and the root's total. Comparing with the maximum is
 * neutral when the node isn't good (nothing went wrong) and positive when it is.
 */
export function countGoodNodes(root: (number | null)[]): Trace {
  const walk = new TreeWalk(root, "good");
  const good: number[] = [];
  let firstNotGood = true;
  let firstReturn = true;

  const count = (id: number, max: number | null, parentGood: boolean): number => {
    walk.enter(id);
    const value = walk.value(id);
    const isGood = max === null || value >= max;
    if (isGood) good.push(id);
    const nextMax = max === null ? value : Math.max(max, value);
    walk.badge(id, `max ${max ?? "–"}`);
    // Worth a scene: the root, the first node that isn't good, and a good node under one that isn't (the maximum
    // came from higher up, not from the parent).
    const key = max === null || (!isGood && firstNotGood) || (isGood && !parentGood);
    if (!isGood) firstNotGood = false;
    const step: Omit<TraceStep, "pointers" | "tree" | "stack"> = {
      kind: isGood ? "good" : "not-good",
      key,
      note:
        max === null
          ? `The root, ${value}, has nothing above it, so it's good. The largest value on the path is now ${value}.`
          : isGood
            ? `${value} ≥ ${max}, the largest value above it: good.${nextMax !== max ? ` The path's maximum rises to ${nextMax}.` : ""}`
            : `${value} < ${max}, a larger value sits above it: not good. The maximum stays ${max}.`,
      ...(max !== null
        ? {
            equation: {
              terms: [value],
              operator: "+" as const,
              result: value,
              comparison: {
                op: value < max ? ("<" as const) : value > max ? (">" as const) : ("=" as const),
                target: max,
              },
              tone: isGood ? ("positive" as const) : ("neutral" as const),
            },
          }
        : {}),
      found: [...good].sort((a, b) => a - b),
      counter: { value: good.length, ...(isGood ? { delta: 1 } : {}) },
    };
    walk.record(step);
    let total = isGood ? 1 : 0;
    const parts: number[] = [total];
    for (const side of ["left", "right"] as const) {
      const child = walk.child(id, side);
      if (child === null) {
        walk.base(id, side, "0", {
          kind: "base",
          key: false,
          note: `${value} has no ${side} child: an empty subtree holds 0 good nodes.`,
          found: [...good].sort((a, b) => a - b),
          counter: { value: good.length },
        });
        parts.push(0);
        continue;
      }
      const sub = count(child, nextMax, isGood);
      parts.push(sub);
      total += sub;
    }
    // The first inner node to hand its count up shows counts adding up on the way back.
    const shown = id === 0 || (firstReturn && !walk.isLeaf(id));
    if (!walk.isLeaf(id)) firstReturn = false;
    walk.leave(String(total), {
      kind: id === 0 ? "done" : "return",
      key: shown,
      note:
        id === 0
          ? `The root adds it all up: ${parts.join(" + ")} = ${total} good nodes.`
          : `${value}'s subtree holds ${parts.join(" + ")} = ${total} good ${total === 1 ? "node" : "nodes"}; that goes up to its parent.`,
      equation: { terms: parts, operator: "+", result: total },
      found: [...good].sort((a, b) => a - b),
      counter: { value: good.length },
    });
    return total;
  };

  let answer = 0;
  if (walk.nodes.length === 0) {
    walk.steps.push({
      kind: "done",
      key: true,
      pointers: {},
      note: "The tree is empty: there are no good nodes.",
      tree: { path: [], done: [] },
      stack: [{ label: "good(∅)", node: null, returns: "0" }],
    });
  } else answer = count(0, null, true);

  return {
    problem: "trees-dfs/count-good-nodes-in-binary-tree",
    row: { values: walk.values(), display: "tree" },
    tree: { nodes: walk.nodes },
    pointerNames: [],
    steps: walk.steps,
    answer,
    answerDisplay: String(answer),
  };
}

export const countGoodNodesInBinaryTreeTrace: TraceDefinition<[(number | null)[]]> = {
  problem: "trees-dfs/count-good-nodes-in-binary-tree",
  exampleIndex: 0,
  exampleSource: "analogy",
  args: z.tuple([treeArgs]),
  run: countGoodNodes,
};
