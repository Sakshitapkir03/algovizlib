import { z } from "zod";

import type { Trace, TraceDefinition } from "../types";
import { gapEquation, Race, restartEquation } from "./shared";

/**
 * Read the array as a linked list: index `i` points to index `nums[i]`. Index 0 is never pointed to (values start at
 * 1), and the duplicate value has two arrows into it, so it's where the walk from 0 enters a loop. Floyd's two phases
 * find it: slow (`i = nums[i]`) and fast (`i = nums[nums[i]]`) meet inside the loop; then slow restarts at 0 and both
 * move one jump until they meet at the loop's start, the duplicate. The list shows only the indices the walk from 0
 * reaches, in the order it reaches them; each node is labeled with its index. Key steps: the start, every round of
 * phase 1 where both are in the loop, the meeting, the restart, and every phase-2 round.
 */
export function findTheDuplicateNumber(nums: number[]): Trace {
  const race = new Race();
  // The walk from 0 (it repeats once it reaches the loop).
  const order: number[] = [];
  for (let i = 0; !order.includes(i); i = nums[i]) order.push(i);
  const ids = race.addNodes(order);
  const idOf = (index: number) => ids[order.indexOf(index)];
  order.forEach((index, k) => race.link(ids[k], idOf(nums[index])));
  const last = ids[ids.length - 1];
  const loop = { from: last, to: race.next(last)! };

  race.pointers.slow = idOf(0);
  race.pointers.fast = idOf(0);
  race.record({
    kind: "start",
    key: true,
    loop,
    note: "Index i points to index nums[i]. slow and fast both start at index 0, which nothing points to.",
  });
  let gap: number | null = null;
  for (let round = 1; ; round++) {
    const moves = [race.move("slow", 1), race.move("fast", 2)];
    const slow = race.pointers.slow!;
    const fast = race.pointers.fast!;
    const inLoop = race.distance(slow, loop.to) !== null && race.distance(loop.to, slow) !== null;
    const after = race.distance(fast, slow);
    const met = slow === fast;
    race.record({
      kind: met ? "meet" : "round",
      // The first round shows the idea; after that, the round before they meet and the meeting itself.
      key: met || round === 1 || after === 1,
      moved: moves,
      loop,
      ...(met ? { meet: slow } : {}),
      ...(gap !== null && after !== null ? { equation: gapEquation(gap, after) } : {}),
      counter: { value: round, delta: 1 },
      note: met
        ? `slow jumps to index ${order[slow]} and fast jumps twice to index ${order[fast]}: they meet inside the loop.`
        : `slow jumps to index ${order[slow]}, fast jumps twice to index ${order[fast]}${inLoop ? `; fast is ${after} behind slow in the loop` : ""}.`,
    });
    gap = inLoop ? after : null;
    if (met) break;
  }

  const meet = race.pointers.slow!;
  race.phase = 2;
  race.pointers.slow = idOf(0);
  const toEntry = race.distance(idOf(0), loop.to)!;
  const fromMeet = race.distance(meet, loop.to)!;
  const { equation, laps } = restartEquation(toEntry, fromMeet, race.distance(loop.to, loop.from)! + 1);
  race.record({
    kind: "restart",
    key: true,
    meet,
    loop,
    equation,
    note:
      laps === 0
        ? `slow goes back to index 0; fast stays at index ${order[meet]}. Both are ${toEntry} ${toEntry === 1 ? "jump" : "jumps"} from the loop's start, so one jump each brings them there together.`
        : `slow goes back to index 0, ${toEntry} ${toEntry === 1 ? "jump" : "jumps"} from the loop's start; fast at index ${order[meet]} is ${fromMeet} from it plus ${laps} ${laps === 1 ? "lap" : "laps"} of the loop, also ${toEntry}. So one jump each brings them there together.`,
  });
  while (race.pointers.slow !== race.pointers.fast) {
    const moves = [race.move("slow", 1), race.move("fast", 1)];
    const slow = race.pointers.slow!;
    const met = slow === race.pointers.fast;
    race.record({
      kind: met ? "entry" : "walk",
      key: true,
      moved: moves,
      meet,
      loop,
      ...(met ? { entry: slow, found: [slow] } : {}),
      note: met
        ? `Both land on index ${order[slow]}: two indices point there, so ${order[slow]} is the duplicate.`
        : `Both jump once: slow to index ${order[slow]}, fast to index ${order[race.pointers.fast!]}.`,
    });
  }
  const answer = order[race.pointers.slow!];
  return {
    problem: "fast-slow-pointers/find-the-duplicate-number",
    row: { values: race.list.values(), display: "list" },
    pointerNames: ["slow", "fast"],
    steps: race.steps,
    answer,
    answerDisplay: String(answer),
  };
}

export const findTheDuplicateNumberTrace: TraceDefinition<[number[]]> = {
  problem: "fast-slow-pointers/find-the-duplicate-number",
  exampleIndex: 0,
  exampleSource: "analogy",
  // n + 1 values from 1 to n; a walk of at most 8 indices fits on screen.
  args: z.tuple([
    z
      .array(z.number().int().min(1).max(7))
      .min(2)
      .max(8)
      .refine((nums) => nums.every((v) => v < nums.length), "values must be valid indices"),
  ]),
  run: findTheDuplicateNumber,
};
