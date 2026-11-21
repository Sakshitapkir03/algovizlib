import { z } from "zod";

import type { Trace, TraceDefinition, TraceStep } from "../types";
import { RecordedHeap } from "./shared";

/**
 * Put every stone in a max-heap, so the root is always the heaviest. Each round pops the two heaviest (each pop moves
 * the last stone to the root and sifts it down), and if they differ pushes the difference back (it sifts up). Equal
 * stones destroy each other, which isn't bad news: neutral. Key steps: the heap built, the first pop, each round's
 * leftover going back in, the round where equal stones vanish, and the last stone.
 */
export function lastStoneWeight(stones: number[]): Trace {
  const heap = new RecordedHeap("max");
  const steps: TraceStep[] = [];
  const record = (step: Omit<TraceStep, "pointers" | "heaps">) =>
    steps.push({ ...step, pointers: {}, heaps: [heap.snapshot()] });
  for (const stone of stones) heap.push({ key: stone, label: String(stone) });
  // The pushes while building aren't the story: the step shows the finished heap.
  heap.snapshot();
  record({
    kind: "build",
    key: true,
    note:
      stones.length > 0
        ? `Put all ${stones.length} stones in a max-heap: the heaviest, ${heap.peek()!.key}, sits at the root.`
        : "There are no stones.",
  });
  let firstPop = true;
  while (heap.size > 1) {
    const y = heap.pop()!.key;
    record({
      kind: "pop",
      key: firstPop,
      note: `Pop the heaviest, ${y}. The last stone moves to the root and sinks until the next heaviest, ${heap.peek()!.key}, is on top.`,
    });
    firstPop = false;
    const x = heap.pop()!.key;
    const diff = y - x;
    record({
      kind: diff === 0 ? "destroy" : "pop",
      key: diff === 0,
      note:
        diff === 0
          ? `Pop ${x}. ${y} and ${x} are equal: both stones are destroyed.`
          : `Pop ${x}, the second heaviest. Smashing ${y} and ${x} leaves a stone of ${diff}.`,
      equation: {
        terms: [y, x],
        operator: "-",
        result: diff,
        ...(diff === 0 ? { tone: "neutral" as const } : {}),
      },
    });
    if (diff !== 0) {
      const leftover = { key: diff, label: String(diff) };
      heap.push(leftover);
      record({
        kind: "push",
        key: true,
        note:
          heap.peek() === leftover
            ? `Push the leftover ${diff} back. It sifts up to the root: it's now the heaviest.`
            : `Push the leftover ${diff} back. It sifts up only while it's heavier than its parent, so ${heap.peek()!.key} is still the heaviest.`,
      });
    }
  }
  const answer = heap.peek()?.key ?? 0;
  record({
    kind: "done",
    key: true,
    note:
      heap.size === 1 ? `One stone is left: it weighs ${answer}.` : "No stones are left: the answer is 0.",
  });
  return {
    problem: "heap/last-stone-weight",
    row: { values: stones, display: "cards" },
    pointerNames: [],
    steps,
    answer,
    answerDisplay: String(answer),
  };
}

export const lastStoneWeightTrace: TraceDefinition<[number[]]> = {
  problem: "heap/last-stone-weight",
  exampleIndex: 0,
  exampleSource: "problem-native",
  // A heap of at most 7 stones fits on screen (three levels).
  args: z.tuple([z.array(z.number().int().min(1).max(99)).min(1).max(7)]),
  run: lastStoneWeight,
};
