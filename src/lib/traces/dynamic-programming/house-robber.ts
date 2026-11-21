import { z } from "zod";

import type { Trace, TraceDefinition, TraceStep } from "../types";
import { cell, Table } from "./shared";

/**
 * best[i] is the most the burglar can take from houses 0…i. At house i there are two options: skip it (keep
 * best[i - 1]) or take it (its cash plus best[i - 2], since the neighbor must be left alone). The bigger one wins.
 * The street shows the plan behind best[i]: the houses it takes and skips. A skip that wins isn't bad news, so the
 * take-vs-skip comparison is positive when taking wins and neutral otherwise. Key steps: each house from the second on
 * (the first decision is trivial), and the answer.
 */
export function houseRobber(money: number[]): Trace {
  const n = money.length;
  const table = new Table(1, n);
  const plans: number[][] = [];
  const steps: TraceStep[] = [];
  const planSteps = (i: number) => ({
    taken: plans[i],
    skipped: Array.from({ length: i + 1 }, (_, k) => k).filter((k) => !plans[i].includes(k)),
  });

  for (let i = 0; i < n; i++) {
    const skip = i >= 1 ? table.get(0, i - 1) : 0;
    const before = i >= 2 ? table.get(0, i - 2) : 0;
    const take = before + money[i];
    const takes = take > skip;
    table.set(0, i, Math.max(take, skip));
    plans[i] = takes ? [...(i >= 2 ? plans[i - 2] : []), i] : [...plans[i - 1]];
    const reads = [
      ...(i >= 1 ? [{ at: cell(0, i - 1), label: "skip" }] : []),
      ...(i >= 2 ? [{ at: cell(0, i - 2), label: "take" }] : []),
    ];
    const chosen = reads.flatMap((r, k) => (r.label === (takes ? "take" : "skip") ? [k] : []));
    steps.push({
      kind: takes ? "take" : "skip",
      key: i >= 1,
      pointers: {},
      note: takes
        ? `House ${i}: taking it gives ${before} + ${money[i]} = ${take}${i >= 1 ? `, more than skipping it (${skip})` : ""}. Best so far: ${take}.`
        : `House ${i}: taking it gives ${before} + ${money[i]} = ${take}, less than skipping it (${skip}). Skip it: best so far stays ${skip}.`,
      equation: {
        terms: [before, money[i]],
        operator: "+",
        result: take,
        comparison: { op: take < skip ? "<" : take > skip ? ">" : "=", target: skip },
        tone: takes ? "positive" : "neutral",
      },
      houses: { current: i, ...planSteps(i) },
      table: table.snapshot({ current: cell(0, i), reads, chosen, choice: takes ? "take" : "skip" }),
    });
  }
  const answer = n > 0 ? table.get(0, n - 1) : 0;
  steps.push({
    kind: "done",
    key: true,
    pointers: {},
    note: `The last cell holds the best for the whole street: ${answer}, from houses ${plans[n - 1].join(" and ")}.`,
    houses: planSteps(n - 1),
    table: table.snapshot({ answer: cell(0, n - 1) }),
  });

  return {
    problem: "dynamic-programming/house-robber",
    row: { values: money, display: "houses" },
    dp: { rows: 1, cols: n, rowHeaders: ["best"], colHeaders: money.map((_, i) => String(i)) },
    pointerNames: [],
    steps,
    answer,
    answerDisplay: String(answer),
  };
}

export const houseRobberTrace: TraceDefinition<[number[]]> = {
  problem: "dynamic-programming/house-robber",
  exampleIndex: 0,
  exampleSource: "problem-native",
  args: z.tuple([z.array(z.number().int().min(0).max(99)).min(1).max(7)]),
  run: houseRobber,
};
