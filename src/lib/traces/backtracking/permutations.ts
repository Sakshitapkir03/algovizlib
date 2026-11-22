import { z } from "zod";

import type { Trace, TraceDefinition } from "../types";
import { listText, Search } from "./shared";

/**
 * Fill the positions one by one with any number not used yet; when every position is filled, record the ordering,
 * then undo the last choice and try the next unused number. Nodes show the number just placed. Key steps: the first
 * choice, the first two orderings recorded, the first undo, a new first number, and the end.
 */
export function permutations(nums: number[]): Trace {
  const search = new Search("∅");
  const used = new Array<boolean>(nums.length).fill(false);
  let firstUndo = true;
  let switchedFirst = false;
  const dfs = () => {
    if (search.items.length === nums.length) {
      search.solve(listText(search.items));
      const n = search.found.length;
      search.record({
        kind: "record",
        key: n <= 2,
        note: `Every position is filled: record ${listText(search.items)}. ${n} so far.`,
      });
      return;
    }
    for (let i = 0; i < nums.length; i++) {
      if (used[i]) continue;
      used[i] = true;
      const depth = search.items.length;
      search.choose(String(nums[i]), `+${nums[i]}`, String(nums[i]));
      const newFirst = depth === 0 && i > 0 && !switchedFirst;
      if (newFirst) switchedFirst = true;
      search.record({
        kind: "choose",
        key: (depth === 0 && i === 0) || newFirst,
        note:
          depth === 0
            ? `Position 1: try ${nums[i]} first.`
            : `Position ${depth + 1}: ${nums[i]} isn't used yet, so place it: ${listText(search.items)}.`,
      });
      dfs();
      search.undo();
      used[i] = false;
      search.record({
        kind: "undo",
        key: firstUndo,
        note: `Undo: take ${nums[i]} back off position ${depth + 1}, free to use again.`,
      });
      firstUndo = false;
    }
  };
  dfs();
  search.record({
    kind: "done",
    key: true,
    note: `Every choice at every position was tried: ${search.found.length} orderings.`,
  });
  return {
    problem: "backtracking/permutations",
    row: { values: nums, display: "cards" },
    searchTree: { nodes: search.nodes },
    pointerNames: [],
    steps: search.steps,
    answer: search.found.map((f) => f.slice(1, -1).split(", ").map(Number)),
    answerDisplay: `${search.found.length} orderings`,
  };
}

export const permutationsTrace: TraceDefinition<[number[]]> = {
  problem: "backtracking/permutations",
  exampleIndex: 0,
  exampleSource: "analogy",
  args: z.tuple([z.array(z.number().int().min(-9).max(9)).min(1).max(3)]),
  run: permutations,
};
