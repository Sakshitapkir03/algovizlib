import { z } from "zod";

import type { Trace, TraceDefinition, TraceStep } from "../types";
import { RecordedMap } from "./shared";

/**
 * One pass with a map from each value seen to its position. For each value, the partner it needs is target − value:
 * one lookup says whether that partner has already appeared (and where), instead of rescanning everything before it.
 * Not found isn't bad news, just "not yet" (neutral); found ends the search (positive). Key steps: every value until
 * the pair is found.
 */
export function twoSum(nums: number[], target: number): Trace {
  const seen = new RecordedMap("map", "rows");
  const steps: TraceStep[] = [];
  let answer: number[] = [];
  for (let j = 0; j < nums.length; j++) {
    const need = target - nums[j];
    const i = seen.get(need);
    const found = i !== undefined;
    if (!found) seen.set(nums[j], `#${j}`);
    steps.push({
      kind: found ? "found" : "store",
      key: j <= 2 || found,
      pointers: { j },
      active: [j],
      ...(found ? { found: [Number(i!.slice(1)), j] } : {}),
      note: found
        ? `${nums[j]} needs ${target} − ${nums[j]} = ${need}. The map has ${need} at position ${i!.slice(1)}: the pair is found in one look.`
        : `${nums[j]} needs ${target} − ${nums[j]} = ${need}. One look: ${need} isn't in the map yet. Store ${nums[j]} → position ${j}.`,
      equation: {
        terms: [target, nums[j]],
        operator: "-",
        result: need,
        tone: found ? "positive" : "neutral",
      },
      map: seen.snapshot(),
    });
    if (found) {
      answer = [Number(i!.slice(1)), j];
      break;
    }
  }
  return {
    problem: "arrays-hashing/two-sum",
    row: { values: nums, display: "cards" },
    pointerNames: ["j"],
    steps,
    answer,
    answerDisplay: `[${answer.join(", ")}]`,
    answerIndices: answer,
  };
}

export const twoSumTrace: TraceDefinition<[number[], number]> = {
  problem: "arrays-hashing/two-sum",
  exampleIndex: 0,
  exampleSource: "analogy",
  args: z.tuple([
    z.array(z.number().int().min(-99).max(99)).min(2).max(7),
    z.number().int().min(-198).max(198),
  ]),
  run: twoSum,
};
