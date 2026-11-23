import { z } from "zod";

import type { Trace, TraceDefinition, TraceStep } from "../types";
import { binary, changedBits } from "./shared";

const WIDTH = 5;

/**
 * Add without "+": x ^ y adds each column ignoring carries (1 + 1 leaves 0), and (x & y) << 1 is exactly the carries
 * (a column carries where both bits are 1, into the column to its left). Repeat with the partial sum and the carries
 * until there's nothing left to carry. No comparisons, so no tones. Every round is key.
 */
export function sumOfTwoIntegers(a: number, b: number): Trace {
  let x = a;
  let y = b;
  const steps: TraceStep[] = [];
  while (y !== 0) {
    const sum = x ^ y;
    const both = x & y;
    const carry = both << 1;
    steps.push({
      kind: "round",
      key: true,
      pointers: {},
      note: `x ^ y = ${binary(sum, WIDTH)} adds each column without carrying. x & y = ${binary(both, WIDTH)} marks the columns where both are 1; shifted left, ${binary(carry, WIDTH)} is the carry.`,
      bits: {
        width: WIDTH,
        rows: [
          { name: "x", value: x },
          { name: "y", value: y },
          { name: "x ^ y", value: sum, op: "^", rule: true, changed: changedBits(x, sum, WIDTH) },
          { name: "carry", value: carry, op: "& <<1", from: { value: both, shift: 1 } },
        ],
      },
    });
    x = sum;
    y = carry;
  }
  steps.push({
    kind: "done",
    key: true,
    pointers: {},
    note: `The carry is 0: nothing left to add. ${a} + ${b} = ${x}.`,
    equation: { terms: [a, b], operator: "+", result: x },
    bits: {
      width: WIDTH,
      rows: [
        { name: "x", value: x },
        { name: "y", value: 0 },
      ],
    },
  });
  return {
    problem: "bit-manipulation/sum-of-two-integers",
    row: { values: [], display: "cards" },
    pointerNames: [],
    steps,
    answer: x,
    answerDisplay: String(x),
  };
}

export const sumOfTwoIntegersTrace: TraceDefinition<[number, number]> = {
  problem: "bit-manipulation/sum-of-two-integers",
  exampleIndex: 0,
  exampleSource: "analogy",
  // Five bits: small non-negative numbers whose sum fits.
  args: z
    .tuple([z.number().int().min(0).max(15), z.number().int().min(0).max(15)])
    .refine(([a, b]) => a + b <= 31, "a + b must fit five bits"),
  run: sumOfTwoIntegers,
};
