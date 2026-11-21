import { z } from "zod";

import type { Trace, TraceDefinition } from "../types";
import { treeArgs, TreeWalk } from "./shared";

/**
 * gain(node) is the best sum of a chain going down from `node`. Each node takes its children's gains, dropping a
 * negative one (it would only lower the sum: count it as 0), and does two things: it checks the path that bends at
 * it, left + node + right, against the best so far, and it hands up node + the larger side, since a path through its
 * parent can use only one side. A missing child's gain is 0. Key steps: the first call, a node handing up a negative
 * gain or dropping one, every new best that uses a child, and the root's check. A new best is positive news whatever
 * the sign; a worse path is neutral.
 */
export function binaryTreeMaximumPathSum(root: (number | null)[]): Trace {
  const walk = new TreeWalk(root, "gain");
  let best: number | null = null;
  let bestPath: number[] = [];
  let firstNegative = true;
  /** The best downward chain from each finished node (nodes in it). */
  const chains = new Map<number, number[]>();

  const gain = (id: number): number => {
    walk.enter(id);
    const value = walk.value(id);
    walk.record({
      kind: "visit",
      key: id === 0,
      note:
        id === 0
          ? `Start at the root, ${value}. Before it can decide anything, it needs the best chain from each child.`
          : `Call gain on ${value}; it asks its own children first.`,
      ...(best !== null ? { counter: { value: best } } : {}),
    });
    const kept = (["left", "right"] as const).map((side) => {
      const child = walk.child(id, side);
      if (child === null) {
        walk.base(id, side, "0", {
          kind: "base",
          key: false,
          note: `${value} has no ${side} child: a missing child adds 0.`,
          ...(best !== null ? { counter: { value: best } } : {}),
        });
        return { gain: 0, raw: 0, chain: [] as number[] };
      }
      const raw = gain(child);
      // A negative chain would only lower the sum: leave it out.
      return { gain: Math.max(0, raw), raw, chain: raw > 0 ? chains.get(child)! : [] };
    });
    const [left, right] = kept;
    const through = left.gain + value + right.gain;
    const before = best;
    const newBest = before === null || through > before;
    if (newBest) {
      best = through;
      bestPath = [...left.chain, id, ...right.chain].sort((a, b) => a - b);
    }
    const up = value + Math.max(left.gain, right.gain);
    chains.set(id, [id, ...(left.gain >= right.gain ? left.chain : right.chain)]);
    const dropped = (["left", "right"] as const).filter((_, k) => kept[k].raw < 0);
    const negative = up < 0 && firstNegative;
    if (up < 0) firstNegative = false;
    walk.leave(String(up), {
      kind: id === 0 ? "done" : "return",
      // A new best that uses a child (a leaf's own value says little), handing up a negative chain, or dropping one.
      key: id === 0 || (newBest && through > value) || negative || dropped.length > 0,
      note: [
        dropped.length > 0
          ? `${value}'s ${dropped.join(" and ")} side would lower the sum, so it counts as 0.`
          : "",
        `The path bending at ${value} sums to ${left.gain} + ${value} + ${right.gain} = ${through}${
          before === null
            ? ", the first candidate"
            : newBest
              ? `, a new best (was ${before})`
              : `, not better than ${before}`
        }.`,
        id === 0
          ? `The best path sums to ${best}.`
          : `${value} hands up ${value} + ${Math.max(left.gain, right.gain)} = ${up}${up < 0 ? ", a negative chain" : ""}.`,
      ]
        .filter(Boolean)
        .join(" "),
      equation: {
        terms: [left.gain, value, right.gain],
        operator: "+",
        result: through,
        ...(before !== null
          ? { comparison: { op: through < before ? "<" : through > before ? ">" : "=", target: before } }
          : {}),
        tone: newBest ? "positive" : "neutral",
      },
      counter: { value: best!, ...(newBest && before !== null ? { delta: through - before } : {}) },
      ...(id === 0 ? { found: bestPath } : {}),
    });
    return up;
  };

  gain(0);
  return {
    problem: "trees-dfs/binary-tree-maximum-path-sum",
    row: { values: walk.values(), display: "tree" },
    tree: { nodes: walk.nodes },
    pointerNames: [],
    steps: walk.steps,
    answer: best,
    answerDisplay: String(best),
  };
}

export const binaryTreeMaximumPathSumTrace: TraceDefinition<[(number | null)[]]> = {
  problem: "trees-dfs/binary-tree-maximum-path-sum",
  exampleIndex: 0,
  exampleSource: "analogy",
  // The tree is non-empty.
  args: z.tuple([
    treeArgs.refine((values) => values[0] !== null && values[0] !== undefined, "the tree is empty"),
  ]),
  run: binaryTreeMaximumPathSum,
};
