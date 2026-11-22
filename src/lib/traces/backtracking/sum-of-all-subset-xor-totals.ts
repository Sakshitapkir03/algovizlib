import { z } from "zod";

import type { Trace, TraceDefinition } from "../types";
import { listText, Search } from "./shared";

/**
 * Walk the include/skip tree: at each number, first take it (XOR it in), then skip it. Each leaf is one subset; its
 * XOR total joins the running sum. Nodes show the XOR so far. Key steps: the first take, the first subset recorded,
 * the first undo, the first skip, and the final sum.
 */
export function subsetXorSum(nums: number[]): Trace {
  const search = new Search("0");
  let sum = 0;
  let firstLeaf = true;
  let firstUndo = true;
  let firstSkip = true;
  const dfs = (i: number, xor: number) => {
    if (i === nums.length) {
      sum += xor;
      search.solve(`${listText(search.items)}=${xor}`);
      search.record({
        kind: "leaf",
        key: firstLeaf,
        note: `Subset ${listText(search.items)}: its XOR total is ${xor}. The sum so far is ${sum}.`,
        counter: { value: sum, ...(xor ? { delta: xor } : {}) },
      });
      firstLeaf = false;
      return;
    }
    search.choose(String(xor ^ nums[i]), `+${nums[i]}`, String(nums[i]));
    search.record({
      kind: "take",
      key: i === 0,
      note: `Take ${nums[i]}: the XOR so far becomes ${xor} ^ ${nums[i]} = ${xor ^ nums[i]}.`,
      counter: { value: sum },
    });
    dfs(i + 1, xor ^ nums[i]);
    search.undo();
    search.record({
      kind: "undo",
      key: firstUndo,
      note: `Back up: take ${nums[i]} out again, so the next branch can skip it.`,
      counter: { value: sum },
    });
    firstUndo = false;
    search.choose(String(xor), "skip");
    search.record({
      kind: "skip",
      key: firstSkip,
      note: `Skip ${nums[i]}: the XOR so far stays ${xor}.`,
      counter: { value: sum },
    });
    firstSkip = false;
    dfs(i + 1, xor);
    search.undo(false);
  };
  dfs(0, 0);
  search.record({
    kind: "done",
    key: true,
    note: `All ${2 ** nums.length} subsets are counted: the XOR totals add up to ${sum}.`,
    counter: { value: sum },
  });
  return {
    problem: "backtracking/sum-of-all-subset-xor-totals",
    row: { values: nums, display: "cards" },
    searchTree: { nodes: search.nodes },
    pointerNames: [],
    steps: search.steps,
    answer: sum,
    answerDisplay: String(sum),
  };
}

export const sumOfAllSubsetXorTotalsTrace: TraceDefinition<[number[]]> = {
  problem: "backtracking/sum-of-all-subset-xor-totals",
  exampleIndex: 0,
  exampleSource: "analogy",
  args: z.tuple([z.array(z.number().int().min(0).max(20)).min(1).max(3)]),
  run: subsetXorSum,
};
