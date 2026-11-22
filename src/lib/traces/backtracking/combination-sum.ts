import { z } from "zod";

import type { Trace, TraceDefinition } from "../types";
import { listText, Search } from "./shared";

/**
 * Candidates sorted ascending. From a node, try each candidate from the one last used onward (so a combination is
 * built in one order only): add it if it fits in what's left; the first one that's too big cuts that branch and every
 * bigger one after it (pruning). Reaching 0 left records a combination. Nodes show the amount left. Key steps: the first
 * choice, the first pruned branch, the first combination, an undo out of a finished branch, the next combination, and
 * the end.
 */
export function combinationSum(candidates: number[], target: number): Trace {
  const sorted = [...candidates].sort((a, b) => a - b);
  const search = new Search(String(target));
  let firstPrune = true;
  let firstUndo = true;
  const dfs = (start: number, remaining: number) => {
    if (remaining === 0) {
      search.solve(listText(search.items));
      search.record({
        kind: "record",
        key: true,
        note: `Nothing left to fill: record ${listText(search.items)}.`,
      });
      return;
    }
    for (let i = start; i < sorted.length; i++) {
      const v = sorted[i];
      if (v > remaining) {
        search.prune(`+${v}`, `${v} > ${remaining}`);
        search.record({
          kind: "prune",
          key: firstPrune,
          note: `${v} is more than the ${remaining} left, and every candidate after it is bigger still: cut this branch.`,
          equation: {
            terms: [v],
            operator: "+",
            result: v,
            comparison: { op: ">", target: remaining },
            tone: "negative",
          },
        });
        firstPrune = false;
        break;
      }
      search.choose(String(remaining - v), `+${v}`, String(v));
      search.record({
        kind: "choose",
        key: search.found.length === 0 && search.items.length === 1,
        note: `Add ${v}: ${remaining} − ${v} = ${remaining - v} left. ${listText(search.items)}.`,
        equation: { terms: [remaining, v], operator: "-", result: remaining - v },
      });
      dfs(i, remaining - v);
      search.undo();
      search.record({
        kind: "undo",
        key: firstUndo && search.found.length > 0,
        note: `Undo: take the ${v} back out (${remaining} left again) and try the next candidate.`,
      });
      if (search.found.length > 0) firstUndo = false;
    }
  };
  dfs(0, target);
  search.record({
    kind: "done",
    key: true,
    note: `Every branch is finished: ${search.found.length} ${search.found.length === 1 ? "combination" : "combinations"}, ${search.found.join(" and ")}.`,
  });
  return {
    problem: "backtracking/combination-sum",
    row: { values: sorted, display: "cards" },
    searchTree: { nodes: search.nodes },
    pointerNames: [],
    steps: search.steps,
    answer: search.found.map((f) => f.slice(1, -1).split(", ").map(Number)),
    answerDisplay: search.found.join(" "),
  };
}

export const combinationSumTrace: TraceDefinition<[number[], number]> = {
  problem: "backtracking/combination-sum",
  exampleIndex: 1,
  exampleSource: "analogy",
  // Keep the tree small: few candidates, a small target.
  args: z.tuple([z.array(z.number().int().min(1).max(20)).min(1).max(3), z.number().int().min(1).max(14)]),
  run: combinationSum,
};
