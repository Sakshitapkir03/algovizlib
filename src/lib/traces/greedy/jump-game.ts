import { z } from "zod";

import { compare, type Trace, type TraceDefinition, type TraceStep } from "../types";

/**
 * Scan left to right keeping `farthest`, the largest index any route reaches so far. Reachable indices always form
 * one unbroken stretch from 0, so that single number says everything: an index past it can't be reached (false),
 * otherwise `i + nums[i]` may push it further, and once it covers the last index the answer is true. A jump that
 * doesn't beat the reach isn't bad news (neutral); a farther reach is (positive). Every step is key.
 */
export function jumpGame(nums: number[]): Trace {
  const n = nums.length;
  const last = n - 1;
  const steps: TraceStep[] = [];
  let farthest = 0;
  let answer = true;
  for (let i = 0; i < n; i++) {
    if (i > farthest) {
      answer = false;
      steps.push({
        kind: "stuck",
        key: true,
        pointers: { i },
        rejected: Array.from({ length: n - i }, (_, k) => i + k),
        note: `Index ${i} lies past the reach (${farthest}): no route gets here, so the last index is out of reach.`,
        reach: { from: 0, to: farthest, value: farthest },
      });
      break;
    }
    const before = farthest;
    const reach = i + nums[i];
    farthest = Math.max(farthest, reach);
    const done = farthest >= last;
    const better = reach > before;
    steps.push({
      kind: done ? "done" : better ? "extend" : "keep",
      key: true,
      pointers: { i },
      active: [i],
      ...(done ? { found: [last] } : {}),
      note: done
        ? `From ${i}, a jump of up to ${nums[i]} reaches ${reach}: the reach covers the last index (${last}).`
        : better
          ? `From ${i}, a jump of up to ${nums[i]} reaches ${reach}, farther than ${before}: the reach grows to ${farthest}.`
          : nums[i] === 0
            ? `${i} holds 0, a dead end on its own, but the reach is already ${farthest}: other routes pass it.`
            : `From ${i}, a jump of up to ${nums[i]} reaches only ${reach}; the reach stays ${farthest}.`,
      equation: {
        terms: [i, nums[i]],
        operator: "+",
        result: reach,
        comparison: { op: compare(reach, before), target: before },
        tone: better ? "positive" : "neutral",
      },
      choice: better
        ? { chosen: `reach ${reach}`, rejected: `reach ${before}` }
        : { chosen: `keep reach ${farthest}`, ...(reach < before ? { rejected: `reach ${reach}` } : {}) },
      reach: {
        from: 0,
        to: Math.min(farthest, last),
        value: farthest,
        ...(nums[i] > 0 ? { jump: { from: i, to: Math.min(reach, last), label: `+${nums[i]}` } } : {}),
      },
    });
    if (done) break;
  }
  return {
    problem: "greedy/jump-game",
    row: { values: nums, display: "cards" },
    pointerNames: ["i"],
    steps,
    answer,
    answerDisplay: String(answer),
  };
}

export const jumpGameTrace: TraceDefinition<[number[]]> = {
  problem: "greedy/jump-game",
  exampleIndex: 0,
  exampleSource: "problem-native",
  // Seven squares at most: every step is a scene.
  args: z.tuple([z.array(z.number().int().min(0).max(9)).min(1).max(7)]),
  run: jumpGame,
};
