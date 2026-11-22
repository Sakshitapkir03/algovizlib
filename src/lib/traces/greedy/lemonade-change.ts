import { z } from "zod";

import type { Trace, TraceDefinition, TraceStep } from "../types";

/**
 * Serve customers in order, keeping a count of $5 and $10 bills (a $20 can never be change). A $10 needs one $5 back;
 * a $20 needs $15, paid with $10 + $5 whenever a $10 is there, and three $5s only otherwise: a $5 can serve any later
 * customer, a $10 can't, so the greedy choice spends the less useful bill. A customer who can't get exact change ends
 * the day (negative); change handed back is neutral. Key steps: the first customer, every $10 or $20, a failure, and
 * the last customer.
 */
export function lemonadeChange(bills: number[]): Trace {
  let fives = 0;
  let tens = 0;
  const steps: TraceStep[] = [];
  const till = (active: string) => ({
    entries: [
      { key: "$5", count: fives },
      { key: "$10", count: tens },
    ],
    active,
  });
  let answer = true;
  for (let i = 0; i < bills.length; i++) {
    const bill = bills[i];
    const change = bill - 5;
    const last = i === bills.length - 1;
    const base = {
      pointers: { i },
      active: [i],
      equation: { terms: [bill, 5], operator: "-" as const, result: change, tone: "neutral" as const },
    };
    if (bill === 5) {
      fives++;
      steps.push({
        ...base,
        kind: "keep",
        key: i === 0 || last,
        note: `A $5 pays exactly: no change, and the till gains a $5 (now ${fives}).`,
        freq: till("$5"),
      });
      continue;
    }
    const fail = (why: string) => {
      answer = false;
      steps.push({
        ...base,
        kind: "fail",
        key: true,
        rejected: [i],
        note: `The $${bill} needs $${change} back, but ${why}. This customer can't get exact change.`,
        equation: { ...base.equation, tone: "negative" },
        freq: till(bill === 10 ? "$5" : "$10"),
      });
    };
    if (bill === 10) {
      if (fives === 0) {
        fail("the till has no $5");
        break;
      }
      fives--;
      tens++;
      steps.push({
        ...base,
        kind: "change",
        key: true,
        note: `The $10 needs $5 back: hand over a $5 and keep the $10 (now ${fives} × $5, ${tens} × $10).`,
        choice: { chosen: "$5 back" },
        freq: till("$10"),
      });
      continue;
    }
    if (tens > 0 && fives > 0) {
      const couldUseFives = fives >= 3;
      tens--;
      fives--;
      steps.push({
        ...base,
        kind: "change",
        key: true,
        note: `The $20 needs $15 back. Give $10 + $5, not three $5s: a $5 can serve any later customer, a $10 can't. Left: ${fives} × $5, ${tens} × $10.`,
        choice: { chosen: "$10 + $5", ...(couldUseFives ? { rejected: "$5 + $5 + $5" } : {}) },
        freq: till("$10"),
      });
    } else if (fives >= 3) {
      fives -= 3;
      steps.push({
        ...base,
        kind: "change",
        key: true,
        note: `The $20 needs $15 back and there's no $10, so it takes three $5s (${fives} left).`,
        choice: { chosen: "$5 + $5 + $5" },
        freq: till("$5"),
      });
    } else {
      fail(tens > 0 ? "there's no $5 to go with the $10" : `the till holds only ${fives} × $5`);
      break;
    }
  }
  return {
    problem: "greedy/lemonade-change",
    row: { values: bills, display: "cards" },
    pointerNames: ["i"],
    steps,
    answer,
    answerDisplay: String(answer),
  };
}

export const lemonadeChangeTrace: TraceDefinition<[number[]]> = {
  problem: "greedy/lemonade-change",
  exampleIndex: 0,
  exampleSource: "problem-native",
  args: z.tuple([
    z
      .array(z.union([z.literal(5), z.literal(10), z.literal(20)]))
      .min(1)
      .max(8),
  ]),
  run: lemonadeChange,
};
