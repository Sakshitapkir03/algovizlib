import { z } from "zod";

import type { Trace, TraceDefinition } from "../types";
import { gapEquation, Race } from "./shared";

const signed = (v: number) => (v > 0 ? `+${v}` : `−${-v}`);

/**
 * Each position jumps `nums[i]` around the ring, so position i points to one next position: a linked list drawn in
 * index order (node i shows its index and jump, "3:+3" or "4:−1"). From each start that isn't ruled out, slow (1 jump) and fast (2
 * jumps) race, but a pointer may only jump from a position with the start's direction onto another one, and never
 * onto itself. If a pointer is refused, the start fails, and every position on its same-direction path is ruled out
 * (they can never be in a valid loop). If slow and fast meet, that loop is valid: true. Key steps: each failed start
 * (with what it rules out), every round of the start that finds a loop, and the meeting.
 */
export function circularArrayLoop(input: number[]): Trace {
  const nums = [...input];
  const n = nums.length;
  const race = new Race();
  // Each stone shows its index and its jump, "2:+1".
  const ids = race.addNodes(input.map((v, i) => `${i}:${signed(v)}`));
  const jump = (i: number) => (((i + input[i]) % n) + n) % n;
  ids.forEach((i) => race.link(i, jump(i)));
  const dead: number[] = [];
  let answer = false;

  for (let start = 0; start < n && !answer; start++) {
    if (nums[start] === 0) continue;
    const forward = nums[start] > 0;
    // A jump is allowed from a live position with the start's direction onto another such position, never onto itself.
    const live = (i: number) => nums[i] !== 0 && nums[i] > 0 === forward;
    const allowed = (from: number, to: number) => live(from) && to !== from && live(to);
    race.pointers.slow = start;
    race.pointers.fast = start;
    let gap: number | null = null;
    const firstStart = dead.length === 0;
    race.record({
      kind: "start",
      key: !firstStart,
      ...(dead.length ? { rejected: [...dead] } : {}),
      note: `Start at index ${start} (${signed(input[start])}): only ${forward ? "forward" : "backward"} jumps count from here.`,
    });
    for (let round = 1; ; round++) {
      const moves = [race.move("slow", 1, allowed), race.move("fast", 2, allowed)];
      const refused = moves.find((m) => m.blocked !== undefined || m.hops < (m.pointer === "slow" ? 1 : 2));
      const slow = race.pointers.slow!;
      const fast = race.pointers.fast!;
      if (refused) {
        // Rule out the same-direction path from the start.
        for (let i = start; live(i);) {
          const j = jump(i);
          nums[i] = 0;
          dead.push(i);
          i = j;
        }
        const at = refused.to!;
        const onto = refused.blocked!;
        race.record({
          kind: "fail",
          key: true,
          moved: moves,
          rejected: [...dead],
          note:
            onto === at
              ? `Index ${at} jumps onto itself, which doesn't count, so this start fails.`
              : `Index ${at} (${signed(input[at])}) would jump to index ${onto} (${signed(input[onto])}), which goes the other way. This start fails, and every index on its ${forward ? "forward" : "backward"} path is ruled out.`,
        });
        break;
      }
      const after = race.distance(fast, slow);
      const met = slow === fast;
      race.record({
        kind: met ? "meet" : "round",
        key: true,
        moved: moves,
        ...(dead.length ? { rejected: [...dead] } : {}),
        ...(met
          ? {
              meet: slow,
              found: [slow],
              loop: {
                from: [...ids].find((i) => jump(i) === slow && race.distance(slow, i) !== null)!,
                to: slow,
              },
            }
          : {}),
        ...(gap !== null && after !== null ? { equation: gapEquation(gap, after) } : {}),
        counter: { value: round, delta: 1 },
        note: met
          ? `slow jumps to index ${slow} and fast jumps twice to index ${fast}: they meet, so this ${forward ? "forward" : "backward"} loop is valid.`
          : `slow jumps to index ${slow} and fast jumps twice to index ${fast}, every jump ${forward ? "forward" : "backward"}.`,
      });
      // Both are on the loop once slow can reach itself again (fast is then always on it too).
      gap = race.distance(slow, fast) !== null && race.distance(fast, slow) !== null ? after : null;
      if (met) {
        answer = true;
        break;
      }
    }
  }
  if (!answer)
    race.record({
      kind: "done",
      key: true,
      rejected: [...dead],
      note: "Every start was ruled out: no valid loop.",
    });

  return {
    problem: "fast-slow-pointers/circular-array-loop",
    row: { values: race.list.values(), display: "list" },
    pointerNames: ["slow", "fast"],
    steps: race.steps,
    answer,
    answerDisplay: String(answer),
  };
}

export const circularArrayLoopTrace: TraceDefinition<[number[]]> = {
  problem: "fast-slow-pointers/circular-array-loop",
  exampleIndex: 0,
  exampleSource: "analogy",
  args: z.tuple([
    z
      .array(
        z
          .number()
          .int()
          .min(-9)
          .max(9)
          .refine((v) => v !== 0, "jumps are non-zero"),
      )
      .min(1)
      .max(7),
  ]),
  run: circularArrayLoop,
};
