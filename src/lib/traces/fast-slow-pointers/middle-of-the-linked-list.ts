import { z } from "zod";

import { listDisplay, nodeValues } from "../linked-list/shared";
import type { Trace, TraceDefinition } from "../types";
import { Race } from "./shared";

/**
 * Slow moves 1 node and fast 2 per round, both from the head, while fast and the node after it exist. Fast has always
 * walked twice as far (`fast = 2 × slow`, counting nodes from the head), so when it can't move again slow is halfway:
 * the middle (the second middle for an even length). Key steps: the start, every round, and the middle.
 */
export function middleOfTheLinkedList(values: number[]): Trace {
  const race = new Race();
  const ids = race.addNodes(values);
  ids.forEach((id, i) => race.link(id, ids[i + 1] ?? null));
  race.pointers.slow = ids[0];
  race.pointers.fast = ids[0];
  race.record({
    kind: "start",
    key: true,
    note: `slow and fast both start at the head, ${values[0]}.`,
  });
  for (let round = 1; ; round++) {
    const fastAt = race.pointers.fast;
    if (fastAt === null || race.next(fastAt) === null) break;
    const slowMove = race.move("slow", 1);
    const fastMove = race.move("fast", 2);
    const slow = race.pointers.slow!;
    const fast = race.pointers.fast;
    race.record({
      kind: "round",
      key: true,
      moved: [slowMove, fastMove],
      // Positions counted from the head (0): fast is always twice as far along.
      ...(fast !== null ? { equation: { terms: [2, slow], operator: "×" as const, result: fast } } : {}),
      counter: { value: round, delta: 1 },
      note:
        fast === null
          ? `slow steps to ${values[slow]}; fast jumps two and runs off the end.`
          : `slow steps to ${values[slow]} and fast jumps two to ${values[fast]}: fast is twice as far from the head.`,
    });
  }
  const middle = race.pointers.slow!;
  const answer = values.slice(middle);
  const fast = race.pointers.fast;
  race.record({
    kind: "middle",
    key: true,
    found: [middle],
    note:
      fast === null
        ? `fast has run off the end, so slow, at ${values[middle]}, is the second middle.`
        : `fast is on the last node and can't jump two, so slow, at ${values[middle]}, is the middle.`,
  });
  return {
    problem: "fast-slow-pointers/middle-of-the-linked-list",
    row: { values: race.list.values(), display: "list" },
    pointerNames: ["slow", "fast"],
    steps: race.steps,
    answer,
    answerDisplay: listDisplay(answer),
  };
}

export const middleOfTheLinkedListTrace: TraceDefinition<[number[]]> = {
  problem: "fast-slow-pointers/middle-of-the-linked-list",
  exampleIndex: 0,
  exampleSource: "analogy",
  // A round per two nodes, plus the start and the middle.
  args: z.tuple([nodeValues(8).min(1)]),
  run: middleOfTheLinkedList,
};
