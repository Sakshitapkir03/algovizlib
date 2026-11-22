import { z } from "zod";

import { type Trace, type TraceDefinition, type TraceStep } from "../types";

/**
 * One lap of bookkeeping instead of trying every start. Keep a running tank from the current candidate start; when it
 * drops below zero leaving stop i, no stop from the start to i can work (each was reached with fuel to spare and the
 * car still ran dry, so starting there empty is only worse): rule them all out, make i + 1 the candidate, and reset
 * the tank. At the end the candidate works exactly when total gas covers total cost. The tank going down isn't bad
 * news until it's below zero (negative); the final check (total gas − total cost) is positive when it's at least 0. Key steps: the
 * first stop, running dry, each restart, the last stop, and the check.
 */
export function gasStation(gas: number[], cost: number[]): Trace {
  const n = gas.length;
  const steps: TraceStep[] = [];
  const ruledOut: number[] = [];
  let start = 0;
  let tank = 0;
  let total = 0;
  const pointers = (i?: number) => ({ ...(start < n ? { start } : {}), ...(i !== undefined ? { i } : {}) });
  for (let i = 0; i < n; i++) {
    const diff = gas[i] - cost[i];
    total += diff;
    const before = tank;
    tank += diff;
    if (tank < 0) {
      for (let k = start; k <= i; k++) ruledOut.push(k);
      steps.push({
        kind: "dry",
        key: true,
        pointers: pointers(i),
        active: [i],
        rejected: [...ruledOut],
        note: `Stop ${i}: ${before} + ${gas[i]} fuel − ${cost[i]} to reach the next stop = ${tank}. The tank runs dry, so start ${start} fails, and so does every stop up to ${i}.`,
        counter: { value: tank, delta: diff },
      });
      const failed = start;
      start = i + 1;
      tank = 0;
      steps.push({
        kind: "restart",
        key: true,
        pointers: pointers(),
        rejected: [...ruledOut],
        note:
          start < n
            ? `Try stop ${start} next with an empty tank. Stops ${failed}–${i} are skipped: each was reached with fuel to spare and still ran dry.`
            : "No stop is left to try.",
        counter: { value: 0 },
        choice: {
          chosen: start < n ? `start at ${start}` : "no start left",
          ...(i > failed
            ? { rejected: i - failed === 1 ? `start at ${i}` : `start at ${failed + 1}–${i}` }
            : {}),
        },
      });
      continue;
    }
    steps.push({
      kind: "drive",
      key: i === 0 || i === n - 1,
      pointers: pointers(i),
      active: [i],
      ...(ruledOut.length ? { rejected: [...ruledOut] } : {}),
      note: `Stop ${i}: ${before} + ${gas[i]} fuel − ${cost[i]} to reach the next stop leaves ${tank}.`,
      counter: { value: tank, delta: diff },
    });
  }
  const sumGas = gas.reduce((a, b) => a + b, 0);
  const sumCost = cost.reduce((a, b) => a + b, 0);
  const ok = total >= 0 && start < n;
  const answer = ok ? start : -1;
  steps.push({
    kind: "check",
    key: true,
    pointers: pointers(),
    rejected: [...ruledOut],
    ...(ok ? { found: [start] } : {}),
    note: ok
      ? `All the fuel (${sumGas}) covers the whole lap (${sumCost}), and every stop before ${start} is ruled out: ${start} is the start.`
      : `All the fuel (${sumGas}) can't cover the lap (${sumCost}): no start works.`,
    equation: {
      terms: [sumGas, sumCost],
      operator: "-",
      result: total,
      tone: total >= 0 ? "positive" : "negative",
    },
    counter: { value: tank },
  });
  return {
    problem: "greedy/gas-station",
    row: { values: gas, display: "cards" },
    secondRow: { values: cost },
    pointerNames: ["start", "i"],
    steps,
    answer,
    answerDisplay: String(answer),
    ...(ok ? { answerIndices: [start] } : {}),
  };
}

export const gasStationTrace: TraceDefinition<[number[], number[]]> = {
  problem: "greedy/gas-station",
  exampleIndex: 0,
  exampleSource: "problem-native",
  args: z
    .tuple([
      z.array(z.number().int().min(0).max(99)).min(1).max(6),
      z.array(z.number().int().min(0).max(99)).min(1).max(6),
    ])
    .refine(([g, c]) => g.length === c.length, "gas and cost need the same length"),
  run: gasStation,
};
