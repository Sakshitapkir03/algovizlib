import { z } from "zod";

import type { Trace, TraceDefinition, TraceStep } from "../types";
import { cell, Table } from "./shared";

/**
 * lcs[i][j] is the longest common subsequence of a's first i characters and b's first j. Row 0 and column 0 (an
 * empty prefix) are 0. The table fills row by row: when a[i - 1] = b[j - 1], the cell is the diagonal + 1 (both
 * characters join the shared sequence); otherwise it keeps the larger of the cell above (drop a's character) and the
 * cell to the left (drop b's). A mismatch isn't bad news: it just carries the best so far. Key steps: the zero row and
 * column, the first match, the first mismatch that carries a nonzero value, a match that extends a sequence, and the
 * answer in the bottom-right cell.
 */
export function longestCommonSubsequence(a: string, b: string): Trace {
  const table = new Table(a.length + 1, b.length + 1);
  for (let i = 0; i <= a.length; i++) table.set(i, 0, 0);
  for (let j = 0; j <= b.length; j++) table.set(0, j, 0);
  const steps: TraceStep[] = [];
  const last = cell(a.length, b.length);
  steps.push({
    kind: "init",
    key: true,
    pointers: {},
    note: "An empty prefix shares nothing with anything: row 0 and column 0 are all 0.",
    table: table.snapshot(a.length === 0 || b.length === 0 ? { answer: last } : {}),
  });
  let firstMatch = true;
  let firstCarry = true;
  let firstExtend = true;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const isLast = i === a.length && j === b.length;
      if (a[i - 1] === b[j - 1]) {
        const diag = table.get(i - 1, j - 1);
        table.set(i, j, diag + 1);
        const extends_ = diag > 0 && firstExtend;
        const key = firstMatch || extends_ || isLast;
        if (firstMatch) firstMatch = false;
        if (extends_) firstExtend = false;
        steps.push({
          kind: "match",
          key,
          pointers: {},
          note: `"${a[i - 1]}" = "${b[j - 1]}": both join the shared sequence. Diagonal ${diag} + 1 = ${diag + 1}.`,
          equation: { terms: [diag, 1], operator: "+", result: diag + 1 },
          table: table.snapshot({
            current: cell(i, j),
            reads: [{ at: cell(i - 1, j - 1), label: "match" }],
            chosen: [0],
            choice: "match",
            ...(isLast ? { answer: last } : {}),
          }),
        });
      } else {
        const up = table.get(i - 1, j);
        const left = table.get(i, j - 1);
        const value = Math.max(up, left);
        table.set(i, j, value);
        const carry = value > 0 && firstCarry;
        if (carry) firstCarry = false;
        steps.push({
          kind: "carry",
          key: carry || isLast,
          pointers: {},
          note: `"${a[i - 1]}" ≠ "${b[j - 1]}": keep the better of dropping one character: above ${up}, left ${left}. ${value}.`,
          table: table.snapshot({
            current: cell(i, j),
            reads: [
              { at: cell(i - 1, j), label: "up" },
              { at: cell(i, j - 1), label: "left" },
            ],
            chosen: [up >= left ? 0 : 1],
            choice: up >= left ? "up" : "left",
            ...(isLast ? { answer: last } : {}),
          }),
        });
      }
    }
  }
  const answer = table.get(a.length, b.length);
  return {
    problem: "dynamic-programming/longest-common-subsequence",
    row: { values: [], display: "cards" },
    dp: { rows: a.length + 1, cols: b.length + 1, rowHeaders: ["", ...a], colHeaders: ["", ...b] },
    pointerNames: [],
    steps,
    answer,
    answerDisplay: String(answer),
  };
}

export const longestCommonSubsequenceTrace: TraceDefinition<[string, string]> = {
  problem: "dynamic-programming/longest-common-subsequence",
  exampleIndex: 1,
  exampleSource: "analogy",
  // At most 6 × 6 cells (plus the empty prefixes) stay readable on a phone.
  args: z.tuple([z.string().regex(/^[a-z]{0,5}$/), z.string().regex(/^[a-z]{0,5}$/)]),
  run: longestCommonSubsequence,
};
