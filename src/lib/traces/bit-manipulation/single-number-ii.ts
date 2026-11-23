import { z } from "zod";

import type { Trace, TraceDefinition, TraceStep } from "../types";
import { binary, changedBits } from "./shared";

const WIDTH = 3;

/**
 * Two masks count each bit position modulo 3: `ones` has the bits seen once so far, `twos` the bits seen twice. For
 * each x, ones = (ones ^ x) & ~twos (a bit seen for the first time joins ones; for the second time, leaves it), then
 * twos = (twos ^ x) & ~ones (it moves to twos; a third time clears it from both). Bits of numbers that appear three
 * times end at zero, so ones holds the single number. No comparisons, so no tones. Every step is key.
 */
export function singleNumberII(nums: number[]): Trace {
  let ones = 0;
  let twos = 0;
  const steps: TraceStep[] = nums.map((x, i) => {
    const nextOnes = (ones ^ x) & ~twos;
    const nextTwos = (twos ^ x) & ~nextOnes;
    const step: TraceStep = {
      kind: "count",
      key: true,
      pointers: { i },
      active: [i],
      note: `x = ${binary(x, WIDTH)}. ones = (${binary(ones, WIDTH)} ^ x) & ~twos = ${binary(nextOnes, WIDTH)}; twos = (${binary(twos, WIDTH)} ^ x) & ~ones = ${binary(nextTwos, WIDTH)}.`,
      bits: {
        width: WIDTH,
        rows: [
          { name: "x", value: x },
          {
            name: "ones",
            value: nextOnes,
            op: "^x &~twos",
            rule: true,
            changed: changedBits(ones, nextOnes, WIDTH),
          },
          { name: "twos", value: nextTwos, op: "^x &~ones", changed: changedBits(twos, nextTwos, WIDTH) },
        ],
      },
    };
    ones = nextOnes;
    twos = nextTwos;
    return step;
  });
  return {
    problem: "bit-manipulation/single-number-ii",
    row: { values: nums, display: "cards" },
    pointerNames: ["i"],
    steps,
    answer: ones,
    answerDisplay: String(ones),
  };
}

export const singleNumberIITrace: TraceDefinition<[number[]]> = {
  problem: "bit-manipulation/single-number-ii",
  exampleIndex: 0,
  exampleSource: "analogy",
  // Three bits, at most seven numbers (one scene each).
  args: z.tuple([z.array(z.number().int().min(0).max(7)).min(1).max(7)]),
  run: singleNumberII,
};
