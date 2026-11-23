import { z } from "zod";

import type { Trace, TraceDefinition, TraceStep } from "../types";
import { binary, changedBits } from "./shared";

const WIDTH = 4;

/**
 * XOR everything into one accumulator. x ^ x = 0 and x ^ 0 = x, and XOR doesn't care about order, so every number that
 * appears twice cancels itself out wherever its two copies are, and only the single number is left. Each step shows
 * acc, x, and their XOR bit by bit, with the bits that flipped. No comparisons, so no tones. Every step is key.
 */
export function singleNumber(nums: number[]): Trace {
  let acc = 0;
  const steps: TraceStep[] = nums.map((x, i) => {
    const next = acc ^ x;
    const step: TraceStep = {
      kind: "xor",
      key: true,
      pointers: { i },
      active: [i],
      note: `acc ^ ${x}: ${binary(acc, WIDTH)} ^ ${binary(x, WIDTH)} = ${binary(next, WIDTH)}, so acc is ${next}. Each 1 in ${x} flips that bit of acc.`,
      bits: {
        width: WIDTH,
        rows: [
          { name: "acc", value: acc },
          { name: "x", value: x, op: "^" },
          { name: "acc", value: next, rule: true, changed: changedBits(acc, next, WIDTH) },
        ],
      },
    };
    acc = next;
    return step;
  });
  return {
    problem: "bit-manipulation/single-number",
    row: { values: nums, display: "cards" },
    pointerNames: ["i"],
    steps,
    answer: acc,
    answerDisplay: String(acc),
  };
}

export const singleNumberTrace: TraceDefinition<[number[]]> = {
  problem: "bit-manipulation/single-number",
  exampleIndex: 0,
  exampleSource: "analogy",
  // Four bits, and at most seven numbers: one scene each.
  args: z.tuple([z.array(z.number().int().min(0).max(15)).min(1).max(7)]),
  run: singleNumber,
};
