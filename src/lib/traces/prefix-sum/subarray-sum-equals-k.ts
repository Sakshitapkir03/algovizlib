import { z } from "zod";

import { RecordedMap } from "../arrays-hashing/shared";
import type { Trace, TraceDefinition, TraceStep } from "../types";
import { PrefixRow } from "./shared";

/**
 * A subarray l…r sums to k exactly when prefix[r + 1] − prefix[l] = k, so at each r the question is "how many earlier
 * prefixes equal prefix[r + 1] − k?": one lookup in a map from each prefix seen to how often, seeded with {0: 1} (the
 * empty prefix, for subarrays starting at 0). Not found is neutral ("not yet"); found is positive. Key steps: the seed,
 * the first three items, any item whose prefix was seen before, and the last.
 */
export function subarraySumEqualsK(nums: number[], k: number): Trace {
  const n = nums.length;
  const prefix = new PrefixRow("prefix", "+", "prefix", n);
  prefix.set(0, 0);
  const seen = new RecordedMap("map", "cells");
  seen.set(0, 1);
  const steps: TraceStep[] = [
    {
      kind: "seed",
      key: true,
      pointers: {},
      note: "Before any item the total is 0, seen once: the map starts as {0: 1}, so a subarray starting at 0 can be found.",
      prefix: [prefix.snapshot({ current: 0 })],
      map: seen.snapshot(),
      counter: { value: 0 },
    },
  ];
  let count = 0;
  for (let r = 0; r < n; r++) {
    const sum = prefix.get(r) + nums[r];
    prefix.set(r + 1, sum);
    const need = sum - k;
    const hits = Number(seen.get(need) ?? 0);
    count += hits;
    const before = seen.has(sum) && Number(seen.get(sum)) > 0;
    // The latest earlier boundary whose prefix is `need`: the shortest of the matching subarrays.
    let l = -1;
    for (let j = r; j >= 0; j--)
      if (prefix.get(j) === need) {
        l = j;
        break;
      }
    seen.set(sum, Number(seen.get(sum) ?? 0) + 1);
    // set() recorded the insert or update; the lookup this step answers is `need`.
    const map = seen.snapshot();
    map.lookup = { key: String(need), found: hits > 0 };
    steps.push({
      kind: hits > 0 ? "found" : "store",
      key: r < 3 || r === n - 1 || before,
      pointers: { r },
      active: [r],
      ...(hits > 0 ? { found: Array.from({ length: r - l + 1 }, (_, x) => l + x) } : {}),
      note:
        hits > 0
          ? `Prefix ${sum}; ${sum} − ${k} = ${need} was seen ${hits} time${hits === 1 ? "" : "s"}: ${hits} subarray${hits === 1 ? "" : "s"} ending here sum to ${k} (count ${count}). Record ${sum}.`
          : `Prefix ${sum}; ${sum} − ${k} = ${need} hasn't been seen: no subarray ending here sums to ${k}. Record ${sum}.`,
      equation: { terms: [sum, k], operator: "-", result: need, tone: hits > 0 ? "positive" : "neutral" },
      prefix: [
        prefix.snapshot({
          current: r + 1,
          ...(hits > 0 ? { reads: [l, r + 1], spans: [{ from: l, to: r + 1, value: k }] } : {}),
        }),
      ],
      map,
      counter: { value: count, delta: hits },
    });
  }
  return {
    problem: "prefix-sum/subarray-sum-equals-k",
    row: { values: nums, display: "cards" },
    pointerNames: ["r"],
    steps,
    answer: count,
    answerDisplay: String(count),
  };
}

export const subarraySumEqualsKTrace: TraceDefinition<[number[], number]> = {
  problem: "prefix-sum/subarray-sum-equals-k",
  exampleIndex: 0,
  exampleSource: "analogy",
  // Six items at most: a scene per key item, and the map stays one row.
  args: z.tuple([z.array(z.number().int().min(-9).max(9)).min(1).max(6), z.number().int().min(-50).max(50)]),
  run: subarraySumEqualsK,
};
