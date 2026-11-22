import { z } from "zod";

import type { Trace, TraceDefinition } from "../types";
import { listText, Search } from "./shared";

/**
 * At each number, take it and explore, undo, then skip it and explore. Every leaf is a complete subset, recorded as
 * found. Nodes show the subset so far ("5·1" is {5, 1}). Key steps: the first take, the first
 * subset recorded, the first undo, the first skip, the last subset, and the end.
 */
export function subsets(nums: number[]): Trace {
  const search = new Search("∅");
  let firstLeaf = true;
  let firstUndo = true;
  let firstSkip = true;
  // "5·1" is {5, 1}: a separator so it can't read as fifty-one, one character wide so it fits on a phone.
  const label = () => (search.items.length ? search.items.join("·") : "∅");
  const dfs = (i: number) => {
    if (i === nums.length) {
      search.solve(listText(search.items));
      const n = search.found.length;
      search.record({
        kind: "record",
        key: firstLeaf || n === 2 ** nums.length,
        note: `Every number is decided: record ${listText(search.items)}. That's ${n} ${n === 1 ? "subset" : "subsets"} so far.`,
      });
      firstLeaf = false;
      return;
    }
    search.choose("", `+${nums[i]}`, String(nums[i]));
    search.nodes[search.current].label = label();
    search.record({
      kind: "take",
      key: i === 0,
      note: `Take ${nums[i]}: the subset is ${listText(search.items)}.`,
    });
    dfs(i + 1);
    search.undo();
    search.record({
      kind: "undo",
      key: firstUndo,
      note: `Undo: take ${nums[i]} back out, so the other branch can leave it out.`,
    });
    firstUndo = false;
    search.choose(label(), `skip`);
    search.record({
      kind: "skip",
      key: firstSkip,
      note: `Skip ${nums[i]}: the subset stays ${listText(search.items)}.`,
    });
    firstSkip = false;
    dfs(i + 1);
    search.undo(false);
  };
  dfs(0);
  search.record({
    kind: "done",
    key: true,
    note: `Each number was taken or skipped on every path: ${search.found.length} subsets.`,
  });
  return {
    problem: "backtracking/subsets",
    row: { values: nums, display: "cards" },
    searchTree: { nodes: search.nodes },
    pointerNames: [],
    steps: search.steps,
    answer: search.found.map((f) => (f === "[]" ? [] : f.slice(1, -1).split(", ").map(Number))),
    answerDisplay: `${search.found.length} subsets`,
  };
}

export const subsetsTrace: TraceDefinition<[number[]]> = {
  problem: "backtracking/subsets",
  exampleIndex: 0,
  exampleSource: "analogy",
  args: z.tuple([z.array(z.number().int().min(0).max(9)).min(1).max(3)]),
  run: subsets,
};
