import { z } from "zod";

import { cell, Table } from "../dynamic-programming/shared";
import type { Trace, TraceDefinition, TraceStep } from "../types";

/**
 * Split the two-sided rule into two one-sided passes over a two-row table. Left to right, row "left" gives each child
 * the fewest candies that beat a lower-rated left neighbor: one more than that neighbor on a rise, otherwise 1.
 * Right to left, row "both" takes the larger of that and one more than the right neighbor's final count (on a rise
 * toward the right): the smallest count that satisfies both rules, and nothing smaller could. The total is the
 * answer. A rise is not bad news (no tones). Key steps: the first rise and the first drop in the left pass, the first
 * child the right rule raises, the first child where both rules agree on more than 1, and the total.
 */
export function candy(ratings: number[]): Trace {
  const n = ratings.length;
  const table = new Table(2, n);
  const steps: TraceStep[] = [];
  let sawRise = false;
  let sawDrop = false;
  for (let i = 0; i < n; i++) {
    const rise = i > 0 && ratings[i] > ratings[i - 1];
    const value = rise ? table.get(0, i - 1) + 1 : 1;
    table.set(0, i, value);
    const key = (rise && !sawRise) || (!rise && i > 0 && sawRise && !sawDrop);
    if (rise) sawRise = true;
    else if (i > 0 && sawRise) sawDrop = true;
    steps.push({
      kind: rise ? "left-rise" : "left-min",
      key,
      pointers: { i },
      active: [i],
      note: rise
        ? `Rated ${ratings[i]} beats the left neighbor's ${ratings[i - 1]}: one more than its ${value - 1}, so ${value}.`
        : i === 0
          ? "The first child has no left neighbor: 1 candy."
          : `Rated ${ratings[i]}, not above the left neighbor's ${ratings[i - 1]}: the minimum, 1.`,
      ...(rise ? { equation: { terms: [value - 1, 1], operator: "+" as const, result: value } } : {}),
      choice: rise
        ? { chosen: `${value}: beat left`, rejected: `${value - 1}: a tie` }
        : { chosen: "1: the minimum" },
      table: table.snapshot({
        current: cell(0, i),
        ...(rise ? { reads: [{ at: cell(0, i - 1), label: "+1" }], chosen: [0], choice: "+1" } : {}),
      }),
    });
  }
  let sawRaise = false;
  let sawAgree = false;
  for (let i = n - 1; i >= 0; i--) {
    const left = table.get(0, i);
    const rise = i < n - 1 && ratings[i] > ratings[i + 1];
    const right = rise ? table.get(1, i + 1) + 1 : 1;
    const value = Math.max(left, right);
    table.set(1, i, value);
    const raised = right > left;
    const agree = rise && right === left && value > 1;
    const key = (raised && !sawRaise) || (agree && !sawAgree);
    if (raised) sawRaise = true;
    if (agree) sawAgree = true;
    const reads = [{ at: cell(0, i), label: "left" }, ...(rise ? [{ at: cell(1, i + 1), label: "+1" }] : [])];
    const chosen = !rise ? [0] : raised ? [1] : left > right ? [0] : [0, 1];
    steps.push({
      kind: raised ? "right-raise" : "right-keep",
      key,
      pointers: { i },
      active: [i],
      note: rise
        ? `Rated ${ratings[i]} beats the right neighbor's ${ratings[i + 1]}: it needs ${right}; the left rule needs ${left}. The larger, ${value}, keeps both rules.`
        : `Rated ${ratings[i]}, not above the right neighbor: only the left rule's ${left} applies.`,
      ...(rise
        ? {
            equation: {
              terms: [right],
              operator: "+" as const,
              result: right,
              comparison: {
                op: right > left ? (">" as const) : right < left ? ("<" as const) : ("=" as const),
                target: left,
              },
              tone: "neutral" as const,
            },
          }
        : {}),
      choice: raised
        ? { chosen: `${value}: both rules`, rejected: `${left}: left only` }
        : rise && right < left
          ? { chosen: `${value}: both rules`, rejected: `${right}: right only` }
          : { chosen: `${value}: both rules` },
      table: table.snapshot({
        current: cell(1, i),
        reads,
        chosen,
        choice: raised ? "right+1" : chosen.length === 2 ? "tie" : "left",
      }),
    });
  }
  const counts = table.cells[1] as number[];
  const total = counts.reduce((a, b) => a + b, 0);
  steps.push({
    kind: "total",
    key: true,
    pointers: {},
    note: `Add up the final row: ${counts.join(" + ")} = ${total} candies, the fewest that keep both rules.`,
    ...(n > 1
      ? { equation: { terms: counts, operator: "+" as const, result: total, tone: "positive" as const } }
      : {}),
    table: table.snapshot(),
  });
  return {
    problem: "greedy/candy",
    row: { values: ratings, display: "cards" },
    dp: { rows: 2, cols: n, rowHeaders: ["left", "both"], colHeaders: ratings.map((_, i) => String(i)) },
    pointerNames: ["i"],
    steps,
    answer: total,
    answerDisplay: String(total),
  };
}

export const candyTrace: TraceDefinition<[number[]]> = {
  problem: "greedy/candy",
  exampleIndex: 0,
  exampleSource: "problem-native",
  args: z.tuple([z.array(z.number().int().min(0).max(99)).min(1).max(6)]),
  run: candy,
};
