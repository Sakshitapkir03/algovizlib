import { z } from "zod";

import type { Trace, TraceDefinition } from "../types";
import { treeArgs, TreeWalk } from "./shared";

/**
 * Carry the sum so far down the tree; at a leaf, compare it with the target. A missing child (of a node with one
 * child) answers false. A call returns `left || right`, so as soon as one side finds the target the rest of that
 * node's subtree is never visited, and the answer travels straight up (an early exit). Key steps: the first call,
 * every leaf check, the first early exit, and the root's answer.
 */
export function pathSum(root: (number | null)[], target: number): Trace {
  const walk = new TreeWalk(root, "has");
  const values: number[] = [];
  let found: number[] | undefined;
  let firstExit = true;

  const has = (id: number, sum: number): boolean => {
    walk.enter(id);
    const total = sum + walk.value(id);
    values.push(walk.value(id));
    walk.badge(id, `sum ${total}`);
    if (walk.isLeaf(id)) {
      const hit = total === target;
      if (hit) found = [...walk.subtree(0).filter((n) => onPath(n, id))];
      walk.leave(String(hit), {
        kind: hit ? "hit" : "miss",
        key: true,
        note: hit
          ? `${walk.value(id)} is a leaf and the path adds up to ${total}, exactly ${target}: this leaf answers true.`
          : `${walk.value(id)} is a leaf, but the path adds up to ${total}, not ${target}: this leaf answers false.`,
        equation: {
          terms: [...values],
          operator: "+",
          result: total,
          comparison: { op: total < target ? "<" : total > target ? ">" : "=", target },
          tone: hit ? "positive" : "negative",
        },
        ...(found && hit ? { found } : {}),
      });
      values.pop();
      return hit;
    }
    walk.record({
      kind: "visit",
      key: id === 0,
      note:
        id === 0
          ? `Start at ${walk.value(id)} with sum ${total}. Only a leaf can finish a path, so keep going down.`
          : `${walk.value(id)} brings the sum to ${total}; it isn't a leaf, so ask its children.`,
    });
    let answer = false;
    for (const side of ["left", "right"] as const) {
      const child = walk.child(id, side);
      if (child === null) {
        walk.base(id, side, "false", {
          kind: "base",
          key: false,
          note: `${walk.value(id)} has no ${side} child: no path ends there, so that call answers false.`,
        });
        continue;
      }
      if (has(child, total)) {
        answer = true;
        // `left || right`: the right side is never asked.
        const rest = side === "left" ? walk.subtree(walk.child(id, "right")) : [];
        walk.skip(rest);
        const exit = rest.length > 0 && firstExit;
        if (exit) firstExit = false;
        walk.leave("true", {
          kind: id === 0 ? "done" : "pass-up",
          key: id === 0 || exit,
          note:
            rest.length > 0
              ? `${walk.value(id)} heard true from its ${side} side, so it answers true without visiting ${rest.map((n) => walk.value(n)).join(", ")}: an early exit.`
              : `${walk.value(id)} heard true, so it answers true too.`,
          ...(found ? { found } : {}),
        });
        values.pop();
        return true;
      }
    }
    walk.leave(String(answer), {
      kind: id === 0 ? "done" : "pass-up",
      key: id === 0,
      note: `Neither side of ${walk.value(id)} reached ${target}, so it answers false.`,
    });
    values.pop();
    return answer;
  };
  // Whether `node` lies on the path from the root to `leaf`.
  const onPath = (node: number, leaf: number): boolean => {
    for (let at: number | undefined = leaf; at !== undefined; at = walk.parentOf(at)?.parent)
      if (at === node) return true;
    return false;
  };

  let answer = false;
  if (walk.nodes.length === 0) {
    walk.steps.push({
      kind: "done",
      key: true,
      pointers: {},
      note: "The tree is empty, so there's no root-to-leaf path at all: false.",
      tree: { path: [], done: [] },
      stack: [{ label: "has(∅)", node: null, returns: "false" }],
    });
  } else answer = has(0, 0);

  return {
    problem: "trees-dfs/path-sum",
    row: { values: walk.values(), display: "tree" },
    tree: { nodes: walk.nodes },
    pointerNames: [],
    steps: walk.steps,
    answer,
    answerDisplay: String(answer),
  };
}

export const pathSumTrace: TraceDefinition<[(number | null)[], number]> = {
  problem: "trees-dfs/path-sum",
  exampleIndex: 0,
  exampleSource: "analogy",
  args: z.tuple([treeArgs, z.number().int().min(-999).max(999)]),
  run: pathSum,
};
