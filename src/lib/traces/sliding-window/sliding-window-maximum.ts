import { z } from "zod";

import type { Trace, TraceDefinition, TraceStep } from "../types";

/**
 * Keep a deque of positions whose values decrease from front to back. A new value first removes every smaller value
 * from the back (they can never be a maximum again), then the front leaves once it slides out of the window; the
 * front is always the window's maximum. Key steps: the first removal from the back, the first full window, every
 * step that removes from the front or removes two or more from the back, and the result.
 */
export function slidingWindowMaximum(nums: number[], k: number): Trace {
  const steps: TraceStep[] = [];
  const deque: number[] = [];
  const output: number[] = [];
  let sawBackPop = false;

  nums.forEach((value, right) => {
    const poppedBack: number[] = [];
    while (deque.length && nums[deque.at(-1)!] <= value) poppedBack.push(deque.pop()!);
    deque.push(right);
    const left = Math.max(0, right - k + 1);
    const poppedFront: number[] = [];
    while (deque[0] < left) poppedFront.push(deque.shift()!);
    const full = right >= k - 1;
    if (full) output.push(nums[deque[0]]);
    const removed = [...poppedBack, ...poppedFront];

    const parts = [
      poppedBack.length
        ? `${value} pushes out ${poppedBack.map((i) => nums[i]).join(" and ")} from the back (no bigger than ${value}, so never a maximum again)`
        : `${value} joins the back`,
      poppedFront.length
        ? `${poppedFront.map((i) => nums[i]).join(" and ")} at the front slid out of the window`
        : "",
      full ? `the front, ${nums[deque[0]]}, is this window's maximum` : "the window isn't full yet",
    ].filter(Boolean);
    steps.push({
      kind: full ? "record" : "fill",
      key:
        (poppedBack.length > 0 && !sawBackPop) ||
        (full && output.length === 1) ||
        poppedFront.length > 0 ||
        poppedBack.length >= 2,
      pointers: { left, right },
      active: [right],
      ...(removed.length ? { rejected: removed } : {}),
      window: { from: left, to: right, ...(full ? { value: nums[deque[0]] } : {}) },
      deque: {
        indices: [...deque],
        ...(poppedBack.length ? { poppedBack } : {}),
        ...(poppedFront.length ? { poppedFront } : {}),
        output: [...output],
      },
      note: `${parts.join("; ")}.`.replace(/^./, (c) => c.toUpperCase()),
    });
    if (poppedBack.length) sawBackPop = true;
  });

  const last = nums.length - 1;
  steps.push({
    kind: "done",
    key: true,
    pointers: { left: Math.max(0, last - k + 1), right: last },
    window: { from: Math.max(0, last - k + 1), to: last, value: output.at(-1) },
    deque: { indices: [...deque], output: [...output] },
    note: `Every window has its maximum: [${output.join(", ")}].`,
  });

  return {
    problem: "sliding-window/sliding-window-maximum",
    row: { values: nums, display: "cards" },
    pointerNames: ["left", "right"],
    steps,
    answer: output,
    answerDisplay: `[${output.join(", ")}]`,
  };
}

export const slidingWindowMaximumTrace: TraceDefinition<[number[], number]> = {
  problem: "sliding-window/sliding-window-maximum",
  exampleIndex: 0,
  exampleSource: "analogy",
  args: z
    .tuple([z.array(z.number().int().min(-99).max(99)).min(1).max(9), z.number().int().positive().max(4)])
    .refine(([nums, k]) => k <= nums.length, "k must be at most nums.length"),
  run: slidingWindowMaximum,
};
