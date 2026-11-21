import { z } from "zod";

import type { Trace, TraceDefinition, TraceStep } from "../types";
import { cell, Table } from "./shared";

/**
 * edit[i][j] is the fewest edits turning source's first i characters into target's first j. Row 0 is j inserts and
 * column 0 is i deletes. When the characters match, the cell copies the diagonal (no edit). Otherwise it's 1 plus the
 * cheapest of delete (the cell above), insert (the cell to the left), and replace (the diagonal), tried in that order
 * so ties go to the first. Key steps: the edges, the first replace, the first match, the first insert, the first
 * delete, and the answer in the bottom-right cell.
 */
export function editDistance(source: string, target: string): Trace {
  const table = new Table(source.length + 1, target.length + 1);
  for (let i = 0; i <= source.length; i++) table.set(i, 0, i);
  for (let j = 0; j <= target.length; j++) table.set(0, j, j);
  const last = cell(source.length, target.length);
  const steps: TraceStep[] = [];
  steps.push({
    kind: "init",
    key: true,
    pointers: {},
    note: `From an empty start, building j characters takes j inserts (row 0); erasing i characters takes i deletes (column 0).`,
    table: table.snapshot(source.length === 0 || target.length === 0 ? { answer: last } : {}),
  });
  const shown = new Set<string>();
  for (let i = 1; i <= source.length; i++) {
    for (let j = 1; j <= target.length; j++) {
      const isLast = i === source.length && j === target.length;
      const diag = table.get(i - 1, j - 1);
      if (source[i - 1] === target[j - 1]) {
        table.set(i, j, diag);
        const key = !shown.has("match") || isLast;
        shown.add("match");
        steps.push({
          kind: "match",
          key,
          pointers: {},
          note: `"${source[i - 1]}" = "${target[j - 1]}": no edit needed, copy the diagonal: ${diag}.`,
          table: table.snapshot({
            current: cell(i, j),
            reads: [{ at: cell(i - 1, j - 1), label: "match" }],
            chosen: [0],
            choice: "match",
            ...(isLast ? { answer: last } : {}),
          }),
        });
        continue;
      }
      const options = [
        { label: "delete", at: cell(i - 1, j), cost: table.get(i - 1, j) },
        { label: "insert", at: cell(i, j - 1), cost: table.get(i, j - 1) },
        { label: "replace", at: cell(i - 1, j - 1), cost: diag },
      ];
      const best = options.reduce((m, o, k) => (o.cost < options[m].cost ? k : m), 0);
      const value = 1 + options[best].cost;
      table.set(i, j, value);
      const key = !shown.has(options[best].label) || isLast;
      shown.add(options[best].label);
      steps.push({
        kind: options[best].label,
        key,
        pointers: {},
        note: `"${source[i - 1]}" ≠ "${target[j - 1]}": 1 + the cheapest of delete (${options[0].cost}), insert (${options[1].cost}), replace (${options[2].cost}). ${options[best].label[0].toUpperCase()}${options[best].label.slice(1)} wins: ${value}.`,
        equation: { terms: [1, options[best].cost], operator: "+", result: value },
        table: table.snapshot({
          current: cell(i, j),
          reads: options.map(({ label, at }) => ({ label, at })),
          chosen: [best],
          choice: options[best].label,
          ...(isLast ? { answer: last } : {}),
        }),
      });
    }
  }
  const answer = table.get(source.length, target.length);
  return {
    problem: "dynamic-programming/edit-distance",
    row: { values: [], display: "cards" },
    dp: {
      rows: source.length + 1,
      cols: target.length + 1,
      rowHeaders: ["", ...source],
      colHeaders: ["", ...target],
    },
    pointerNames: [],
    steps,
    answer,
    answerDisplay: String(answer),
  };
}

export const editDistanceTrace: TraceDefinition<[string, string]> = {
  problem: "dynamic-programming/edit-distance",
  exampleIndex: 1,
  exampleSource: "analogy",
  // At most 5 × 5 cells (plus the empty prefixes) stay readable on a phone.
  args: z.tuple([z.string().regex(/^[a-z]{0,4}$/), z.string().regex(/^[a-z]{0,4}$/)]),
  run: editDistance,
};
