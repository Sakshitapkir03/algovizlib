import { z } from "zod";

import { nodeValues } from "../linked-list/shared";
import type { Trace, TraceDefinition } from "../types";
import { gapEquation, Race, restartEquation } from "./shared";

/**
 * Two phases. Phase 1 is the cycle check: slow 1 node, fast 2 per round, until they meet (or fast runs off the end:
 * -1). Phase 2: slow goes back to the head and fast stays at the meeting node; now both move 1 node per round. The
 * head is exactly as far from the loop's start as the meeting node is (going forward, plus whole laps), so they
 * arrive there together. Key steps: the start, the rounds where both are in the loop, the meeting, the restart, and
 * every phase-2 round.
 */
export function linkedListCycleIi(values: number[], pos: number): Trace {
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
    note: `slow and fast both start at the head, ${values[0]}.`,
  });

  let meet: number | null = null;
  let gap: number | null = null;
  for (let round = 1; head !== null; round++) {
    const fastAt = race.pointers.fast!;
    if (race.next(fastAt) === null || race.next(race.next(fastAt)!) === null) {
      race.record({
        kind: "end",
        key: true,
        moved: [race.move("fast", 2)],
        loop,
        note: "fast runs off the end: there's no loop, so the answer is -1.",
      });
      break;
    }
    const moves = [race.move("slow", 1), race.move("fast", 2)];
    const slow = race.pointers.slow!;
    const fast = race.pointers.fast!;
    const inLoop =
      loop !== undefined && race.distance(loop.to, slow) !== null && race.distance(slow, loop.to) !== null;
    const after = race.distance(fast, slow);
    const met = slow === fast;
    race.record({
      kind: met ? "meet" : "round",
      // The rounds before slow reaches the loop happen off-screen.
      key: met || gap !== null,
      moved: moves,
      loop,
      ...(met ? { meet: slow } : {}),
      ...(gap !== null && after !== null ? { equation: gapEquation(gap, after) } : {}),
      counter: { value: round, delta: 1 },
      note: met
        ? `slow steps to ${values[slow]} and fast jumps two to ${values[fast]}: they meet inside the loop.`
        : `slow steps to ${values[slow]}, fast jumps two to ${values[fast]}${inLoop ? `; fast is ${after} behind slow in the loop` : ""}.`,
    });
    gap = inLoop ? after : null;
    if (met) {
      meet = slow;
      break;
    }
  }

  let answer = -1;
  if (meet !== null && head !== null) {
    // Phase 2: restart slow at the head; fast stays at the meeting node, and both move 1.
    race.phase = 2;
    race.pointers.slow = head;
    const toEntry = race.distance(head, loop!.to)!;
    const fromMeet = race.distance(meet, loop!.to)!;
    const { equation, laps } = restartEquation(toEntry, fromMeet, race.distance(loop!.to, loop!.from)! + 1);
    race.record({
      kind: "restart",
      key: true,
      meet,
      loop,
      // head → entry = meeting node → entry, plus whole laps of the loop when fast lapped slow more than once.
      equation,
      note:
        laps === 0
          ? `slow goes back to the head; fast stays at ${values[meet]}. Both are ${toEntry} ${toEntry === 1 ? "node" : "nodes"} from the loop's start, so 1 step each brings them there together.`
          : `slow goes back to the head, ${toEntry} ${toEntry === 1 ? "step" : "steps"} from the loop's start; fast at ${values[meet]} is ${fromMeet} from it plus ${laps} ${laps === 1 ? "lap" : "laps"} of the loop, also ${toEntry}. So 1 step each brings them there together.`,
    });
    while (race.pointers.slow !== race.pointers.fast) {
      const moves = [race.move("slow", 1), race.move("fast", 1)];
      const slow = race.pointers.slow!;
      const fast = race.pointers.fast!;
      const met = slow === fast;
      race.record({
        kind: met ? "entry" : "walk",
        key: true,
        moved: moves,
        meet,
        loop,
        ...(met ? { entry: slow, found: [slow] } : {}),
        note: met
          ? `Both step 1 and land on ${values[slow]}: the loop starts there, at index ${slow}.`
          : `Both step 1: slow to ${values[slow]}, fast to ${values[fast]}.`,
      });
    }
    answer = race.pointers.slow!;
  }

  return {
    problem: "fast-slow-pointers/linked-list-cycle-ii",
    row: { values: race.list.values(), display: "list" },
    pointerNames: ["slow", "fast"],
    steps: race.steps,
    answer,
    answerDisplay: String(answer),
    ...(answer >= 0 ? { answerIndices: [answer] } : {}),
  };
}

export const linkedListCycleIiTrace: TraceDefinition<[number[], number]> = {
  problem: "fast-slow-pointers/linked-list-cycle-ii",
  exampleIndex: 0,
  exampleSource: "analogy",
  args: z.tuple([nodeValues(6), z.number().int().min(-1).max(5)]),
  run: linkedListCycleIi,
};
