import { z } from "zod";

import type { Trace, TraceDefinition, TraceStep } from "../types";
import { cell, Table } from "./shared";

const show = (v: number) => (v === Infinity ? "∞" : v);

/**
 * fewest[a] is the fewest coins making amount a. For each amount, try every coin c ≤ a: one coin plus the fewest for
 * a - c (already in the table). The best try wins; an amount no coin can reach stays ∞. The coin row marks the
 * winning coin. Key steps: amount 0, the first amount, the first amount where a bigger coin beats a stack of small
 * ones, and the answer (in the example, two 4s beat the greedy 5 + 1 + 1 + 1).
 */
export function coinChange(coins: number[], amount: number): Trace {
  const table = new Table(1, amount + 1);
  const fewest: number[] = new Array<number>(amount + 1).fill(Infinity);
  fewest[0] = 0;
  table.set(0, 0, 0);
  const steps: TraceStep[] = [];
  steps.push({
    kind: "base",
    key: true,
    pointers: {},
    note: "Amount 0 needs no coins at all.",
    table: table.snapshot(amount === 0 ? { answer: cell(0, 0) } : {}),
  });
  let firstBig = true;
  for (let a = 1; a <= amount; a++) {
    const usable = coins.map((c, k) => ({ c, k })).filter(({ c }) => c <= a);
    let best: { c: number; k: number } | undefined;
    for (const option of usable)
      if (fewest[a - option.c] + 1 < fewest[a]) {
        fewest[a] = fewest[a - option.c] + 1;
        best = option;
      }
    table.set(0, a, show(fewest[a]));
    const bigWins = best !== undefined && best.c > coins[0] && firstBig;
    if (bigWins) firstBig = false;
    const reads = usable.map(({ c }) => ({ at: cell(0, a - c), label: `coin ${c}` }));
    steps.push({
      kind: best ? "fill" : "unreachable",
      key: a === 1 || a === amount || bigWins,
      pointers: {},
      note: best
        ? `Amount ${a}: try each coin up to ${a}: ${usable.map(({ c }) => `${c} leaves ${a - c} (${show(fewest[a - c])})`).join(", ")}. Coin ${best.c} wins: 1 + ${fewest[a - best.c]} = ${fewest[a]}.`
        : `Amount ${a}: no coin fits, so it can't be made: ∞.`,
      ...(best
        ? {
            equation: { terms: [1, fewest[a - best.c]], operator: "+" as const, result: fewest[a] },
            active: [best.k],
          }
        : {}),
      table: table.snapshot({
        current: cell(0, a),
        reads,
        chosen: best ? [usable.findIndex((u) => u.c === best!.c)] : [],
        choice: best ? `coin ${best.c}` : "none",
        ...(a === amount ? { answer: cell(0, a) } : {}),
      }),
    });
  }
  const answer = fewest[amount] === Infinity ? -1 : fewest[amount];
  return {
    problem: "dynamic-programming/coin-change",
    row: { values: coins, display: "cards" },
    dp: {
      rows: 1,
      cols: amount + 1,
      rowHeaders: ["coins"],
      colHeaders: Array.from({ length: amount + 1 }, (_, a) => String(a)),
    },
    pointerNames: [],
    steps,
    answer,
    answerDisplay: String(answer),
  };
}

export const coinChangeTrace: TraceDefinition<[number[], number]> = {
  problem: "dynamic-programming/coin-change",
  exampleIndex: 0,
  exampleSource: "problem-native",
  // Amounts 0…amount must fit across the stage.
  args: z.tuple([
    z
      .array(z.number().int().min(1).max(20))
      .min(1)
      .max(4)
      .refine((c) => c.every((v, i) => i === 0 || v > c[i - 1]), "coins ascending"),
    z.number().int().min(0).max(10),
  ]),
  run: coinChange,
};
