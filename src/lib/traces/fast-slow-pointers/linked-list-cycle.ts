import { z } from "zod";

import { nodeValues } from "../linked-list/shared";
import type { Trace, TraceDefinition } from "../types";
import { gapEquation, Race } from "./shared";

/**
 * Floyd's cycle check: slow moves 1 node and fast 2 per round. If fast (or the node after it) runs out, the list ends:
 * no cycle. Once both are inside the loop, fast gains exactly one node per round, so the gap to slow (counted along
 * the links) shrinks by one each round and they land on the same node. Key steps: the start, every round until they
 * meet or fast runs off the end.
 */
export function linkedListCycle(values: number[], pos: number): Trace {
  const race = new Race();
  const ids = race.addNodes(values);
  ids.forEach((id, i) => race.link(id, ids[i + 1] ?? (i === ids.length - 1 && pos >= 0 ? ids[pos] : null)));
  const loop = pos >= 0 && ids.length > 0 ? { from: ids[ids.length - 1], to: ids[pos] } : undefined;
  const head = ids[0] ?? null;
  race.pointers.slow = head;
  race.pointers.fast = head;
  race.record({
    kind: "start",
    key: true,
    loop,
    note:
      head === null
        ? "The list is empty: there's nothing to loop."
        : `slow and fast both start at the head, ${values[0]}.`,
  });

  let answer = false;
  let gap: number | null = null;
  for (let round = 1; head !== null; round++) {
    const fastAt = race.pointers.fast!;
    if (race.next(fastAt) === null || race.next(race.next(fastAt)!) === null) {
      const fastMove = race.move("fast", 2);
      race.record({
        kind: "end",
        key: true,
        moved: [fastMove],
        loop,
        note: `fast runs off the end after ${values[fastMove.path.at(-1) ?? fastMove.from]}: the list ends, so there's no cycle.`,
      });
      break;
    }
    const slowMove = race.move("slow", 1);
    const fastMove = race.move("fast", 2);
    const slow = race.pointers.slow!;
    const fast = race.pointers.fast!;
    const after = race.distance(fast, slow);
    const inLoop =
      loop !== undefined && race.distance(slow, loop.to) !== null && race.distance(loop.to, slow) !== null;
    const met = slow === fast;
    race.record({
      kind: met ? "meet" : "round",
      key: true,
      moved: [slowMove, fastMove],
      loop,
      ...(met ? { meet: slow } : {}),
      ...(gap !== null && after !== null ? { equation: gapEquation(gap, after) } : {}),
      counter: { value: round, delta: 1 },
      note: met
        ? `slow steps to ${values[slow]} and fast jumps two to ${values[fast]}: they meet, so the list loops.`
        : `slow steps to ${values[slow]}, fast jumps two to ${values[fast]}${inLoop && after !== null ? `; both are in the loop, fast is ${after} behind slow` : ""}.`,
    });
    gap = inLoop ? after : null;
    if (met) {
      answer = true;
      break;
    }
  }

  return {
    problem: "fast-slow-pointers/linked-list-cycle",
    row: { values: race.list.values(), display: "list" },
    pointerNames: ["slow", "fast"],
    steps: race.steps,
    answer,
    answerDisplay: String(answer),
  };
}

export const linkedListCycleTrace: TraceDefinition<[number[], number]> = {
  problem: "fast-slow-pointers/linked-list-cycle",
  exampleIndex: 0,
  exampleSource: "analogy",
  // One round per node at most before they meet: up to 6 nodes keeps it within 10 scenes.
  args: z.tuple([nodeValues(6), z.number().int().min(-1).max(5)]),
  run: linkedListCycle,
};
