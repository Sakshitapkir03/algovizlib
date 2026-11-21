import { z } from "zod";

import type { Trace, TraceDefinition } from "../types";
import { treeArgs, TreeWalk } from "./shared";

/**
 * depth(node) = 0 for a missing child, else 1 + the deeper of its two subtrees. The walk goes down the left side
 * first; every finished call hands its depth up to its caller, which keeps the larger of its two answers. Key steps:
 * the first call, the first base case (a missing child is depth 0), every node that
 * combines two different answers, the root's right subtree answering, and the root's answer.
 */
export function maximumDepthOfBinaryTree(root: (number | null)[]): Trace {
  const walk = new TreeWalk(root, "depth");
  let firstBase = true;

  const depth = (id: number): number => {
    walk.enter(id);
    walk.record({
      kind: "visit",
      key: id === 0,
      note:
        id === 0
          ? `Start at the root, ${walk.value(id)}: its depth is 1 plus the deeper of its two subtrees, so ask both.`
          : `Call depth on ${walk.value(id)}; its caller waits for the answer.`,
    });
    const answers = (["left", "right"] as const).map((side) => {
      const child = walk.child(id, side);
      if (child !== null) return depth(child);
      walk.base(id, side, "0", {
        kind: "base",
        key: firstBase,
        note: `${walk.value(id)} has no ${side} child: a missing child is the base case, depth 0, returned at once.`,
      });
      firstBase = false;
      return 0;
    });
    const [left, right] = answers;
    const result = 1 + Math.max(left, right);
    const leaf = walk.isLeaf(id);
    const up = walk.parentOf(id);
    // A node whose two answers differ shows the max at work (a missing side loses to a real subtree).
    const combines = !leaf && left !== right;
    walk.leave(String(result), {
      kind: id === 0 ? "done" : leaf ? "leaf" : "combine",
      // The root's other subtree reporting back is the last answer the root waits for.
      key: id === 0 || combines || (up?.parent === 0 && up.side === "right"),
      note:
        id === 0
          ? `The root takes 1 + max(${left}, ${right}) = ${result}: the deepest path has ${result} nodes.`
          : leaf
            ? `${walk.value(id)} is a leaf: 1 + max(0, 0) = 1, handed up to ${walk.value(walk.parentOf(id)!.parent)}.`
            : `${walk.value(id)} heard ${left} from the left and ${right} from the right: 1 + max(${left}, ${right}) = ${result}.`,
      equation: { terms: [1, Math.max(left, right)], operator: "+", result },
    });
    return result;
  };

  let answer = 0;
  if (walk.nodes.length === 0) {
    walk.steps.push({
      kind: "done",
      key: true,
      pointers: {},
      note: "The tree is empty: depth(null) is 0.",
      tree: { path: [], done: [] },
      stack: [{ label: "depth(∅)", node: null, returns: "0" }],
    });
  } else answer = depth(0);

  return {
    problem: "trees-dfs/maximum-depth-of-binary-tree",
    row: { values: walk.values(), display: "tree" },
    tree: { nodes: walk.nodes },
    pointerNames: [],
    steps: walk.steps,
    answer,
    answerDisplay: String(answer),
  };
}

export const maximumDepthOfBinaryTreeTrace: TraceDefinition<[(number | null)[]]> = {
  problem: "trees-dfs/maximum-depth-of-binary-tree",
  exampleIndex: 0,
  exampleSource: "analogy",
  args: z.tuple([treeArgs]),
  run: maximumDepthOfBinaryTree,
};
