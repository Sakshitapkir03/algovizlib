import { z } from "zod";

import { compare, type Trace, type TraceDefinition, type TraceStep } from "../types";

/**
 * Binary search on the answer: speeds 1…max(piles) are the candidates, and a speed that works means every faster
 * one works too. Test the middle candidate by adding up the hours each pile takes at that speed: within h, it
 * works (keep it and everything slower: high = mid); over h, it's too slow (drop it and everything slower:
 * low = mid + 1). When low meets high, that's the slowest speed that works. Every step is key.
 */
export function kokoEatingBananas(piles: number[], h: number): Trace {
  const max = Math.max(...piles);
  const steps: TraceStep[] = [];
  let low = 1;
  let high = max;
  steps.push({
    kind: "start",
    key: true,
    pointers: {},
    answers: { min: 1, max, low, high },
    note: `Koko's speed is somewhere from 1 to ${max} bananas an hour. At ${max} every pile takes one hour, ${piles.length} hours in all, so ${max} always works.`,
  });

  while (low < high) {
    const mid = low + Math.floor((high - low) / 2);
    const hours = piles.map((pile) => Math.ceil(pile / mid));
    const total = hours.reduce((a, b) => a + b, 0);
    const fits = total <= h;
    if (fits) high = mid;
    else low = mid + 1;
    steps.push({
      kind: fits ? "fits" : "too-slow",
      key: true,
      pointers: {},
      answers: { min: 1, max, low, high, mid },
      // Under or exactly h is good news whatever the sign; over h means too slow.
      equation: {
        terms: hours,
        operator: "+",
        result: total,
        comparison: { op: compare(total, h), target: h },
        tone: fits ? "positive" : "negative",
      },
      note:
        `Try ${mid} an hour: the piles take ${hours.join(" + ")} = ${total} hours. ` +
        (fits
          ? `That's within ${h}, so ${mid} works; anything faster works too, so drop everything above it (high = ${mid}).`
          : `That's more than ${h}, so ${mid} is too slow, and so is anything slower (low = ${low}).`),
    });
  }

  steps.push({
    kind: "done",
    key: true,
    pointers: {},
    answers: { min: 1, max, low, high },
    note: `low and high meet at ${low}: ${low - 1 >= 1 ? `${low - 1} is too slow and ` : ""}${low} works, so ${low} bananas an hour is the slowest speed that finishes in ${h} hours.`,
  });

  return {
    problem: "binary-search/koko-eating-bananas",
    row: { values: piles, display: "cards" },
    pointerNames: [],
    steps,
    answer: low,
    answerDisplay: String(low),
  };
}

export const kokoEatingBananasTrace: TraceDefinition<[number[], number]> = {
  problem: "binary-search/koko-eating-bananas",
  exampleIndex: 0,
  exampleSource: "problem-native",
  // At most 16 candidate speeds so every one gets a readable tick on the number line.
  args: z
    .tuple([z.array(z.number().int().min(1).max(16)).min(1).max(6), z.number().int().positive().max(99)])
    .refine(([piles, h]) => h >= piles.length, "h must be at least the number of piles"),
  run: kokoEatingBananas,
};
