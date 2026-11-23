import { z } from "zod";

import { cell, Table } from "../dynamic-programming/shared";
import type { Trace, TraceDefinition, TraceStep } from "../types";
import { binary } from "./shared";

const WIDTH = 3;

/**
 * ones[i] = ones[i >> 1] + (i & 1). Shifting i right by one drops its last bit, giving a smaller number whose ones are
 * already counted; the dropped bit (i & 1) adds one more if it was a 1. The table fills left to right, each cell
 * reading the cell at i >> 1. No comparisons, so no tones. Key steps: 0 through 3, and the last two.
 */
export function countingBits(n: number): Trace {
  const table = new Table(1, n + 1);
  const steps: TraceStep[] = [];
  table.set(0, 0, 0);
  steps.push({
    kind: "base",
    key: true,
    pointers: {},
    note: "0 has no 1 bits: ones[0] = 0.",
    bits: { width: WIDTH, rows: [{ name: "i", value: 0 }] },
    table: table.snapshot({ current: cell(0, 0) }),
  });
  for (let i = 1; i <= n; i++) {
    const half = i >> 1;
    const low = i & 1;
    table.set(0, i, table.get(0, half) + low);
    steps.push({
      kind: "count",
      key: i <= 3 || i >= n - 1,
      pointers: {},
      note: `${i} = ${binary(i, WIDTH)}. Shift right: ${binary(half, WIDTH)} = ${half}, already counted (${table.get(0, half)}). The dropped bit ${i} & 1 = ${low}. ones[${i}] = ${table.get(0, half)} + ${low} = ${table.get(0, i)}.`,
      equation: { terms: [table.get(0, half), low], operator: "+", result: table.get(0, i) },
      bits: {
        width: WIDTH,
        rows: [
          { name: "i", value: i },
          { name: "i >> 1", value: half, op: ">> 1", from: { value: i, shift: -1 } },
          { name: "i & 1", value: low, op: "& 1" },
        ],
      },
      table: table.snapshot({
        current: cell(0, i),
        reads: [{ at: cell(0, half), label: "i>>1" }],
        chosen: [0],
      }),
    });
  }
  const answer = table.cells[0] as number[];
  return {
    problem: "bit-manipulation/counting-bits",
    row: { values: [], display: "cards" },
    dp: { rows: 1, cols: n + 1, rowHeaders: ["ones"], colHeaders: answer.map((_, i) => String(i)) },
    pointerNames: [],
    steps,
    answer,
    answerDisplay: `[${answer.join(", ")}]`,
  };
}

export const countingBitsTrace: TraceDefinition<[number]> = {
  problem: "bit-manipulation/counting-bits",
  exampleIndex: 0,
  exampleSource: "analogy",
  // Three bits: up to 7.
  args: z.tuple([z.number().int().min(0).max(7)]),
  run: countingBits,
};
