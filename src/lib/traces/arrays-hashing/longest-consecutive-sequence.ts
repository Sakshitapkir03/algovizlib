import { z } from "zod";

import type { Trace, TraceDefinition, TraceStep } from "../types";
import { RecordedMap } from "./shared";

/**
 * Put every value in a set. A value starts a run only if value − 1 isn't in the set (one lookup); a value that isn't a
 * start is skipped, so each run is walked once, from its start, one lookup per next value. The longest run is the
 * answer. A missing neighbor isn't bad news (neutral); a new longest run is (positive). Key steps: the set, the first
 * value that isn't a start, the first run walked from its start, the lookup that ends the longest run, a shorter run,
 * and the answer.
 */
export function longestConsecutive(nums: number[]): Trace {
  const set = new RecordedMap("set", "cells");
  const steps: TraceStep[] = [];
  for (const x of nums) set.set(x);
  set.snapshot();
  const values = [...new Set(nums)];
  const index = (v: number) => nums.indexOf(v);
  steps.push({
    kind: "build",
    key: true,
    pointers: {},
    note: `Put every value in a set: ${values.length} values, each found in one lookup from now on.`,
    map: set.snapshot(),
  });
  let best = 0;
  let firstSkip = true;
  let firstWalk = true;
  let shownShorter = false;
  for (const x of values) {
    if (set.has(x - 1)) {
      steps.push({
        kind: "skip",
        key: firstSkip,
        pointers: { i: index(x) },
        active: [index(x)],
        note: `${x}: ${x - 1} is in the set, so ${x} isn't the start of a run. Skip it; its run is walked from its start.`,
        counter: { value: best },
        map: set.snapshot(),
      });
      firstSkip = false;
      continue;
    }
    // The first start with a neighbor above it: the first run actually walked.
    const walks = values.includes(x + 1) && firstWalk;
    if (walks) firstWalk = false;
    steps.push({
      kind: "start",
      key: walks,
      pointers: { i: index(x) },
      active: [index(x)],
      note: `${x}: ${x - 1} isn't in the set, so a run starts at ${x}. Walk up.`,
      counter: { value: best },
      map: set.snapshot(),
    });
    let length = 1;
    for (;;) {
      const next = x + length;
      const found = set.has(next);
      if (found) {
        length++;
        steps.push({
          kind: "extend",
          key: false,
          pointers: { i: index(next) },
          active: [index(next)],
          note: `${next} is in the set: the run from ${x} is ${length} long.`,
          counter: { value: best },
          map: set.snapshot(),
        });
        continue;
      }
      const before = best;
      const better = length > best;
      best = Math.max(best, length);
      const shorter = !better && length > 1 && !shownShorter;
      if (shorter) shownShorter = true;
      steps.push({
        kind: "end",
        key: (better && length > 1) || shorter,
        pointers: { i: index(x) },
        note: `${next} isn't in the set: the run from ${x} ends at length ${length}${better ? `, the longest so far` : `, not longer than ${best}`}.`,
        equation: {
          terms: [length],
          operator: "+",
          result: length,
          comparison: { op: length < before ? "<" : length > before ? ">" : "=", target: before },
          tone: better ? "positive" : "neutral",
        },
        counter: { value: best, ...(better && before ? { delta: length - before } : {}) },
        map: set.snapshot(),
      });
      break;
    }
  }
  steps.push({
    kind: "done",
    key: true,
    pointers: {},
    note: `Every value was checked once: the longest run has ${best} values.`,
    counter: { value: best },
    map: set.snapshot(),
  });
  return {
    problem: "arrays-hashing/longest-consecutive-sequence",
    row: { values: nums, display: "cards" },
    pointerNames: ["i"],
    steps,
    answer: best,
    answerDisplay: String(best),
  };
}

export const longestConsecutiveSequenceTrace: TraceDefinition<[number[]]> = {
  problem: "arrays-hashing/longest-consecutive-sequence",
  exampleIndex: 0,
  exampleSource: "analogy",
  args: z.tuple([z.array(z.number().int().min(-99).max(999)).max(8)]),
  run: longestConsecutive,
};
