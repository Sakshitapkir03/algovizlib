import { z } from "zod";

import type { Trace, TraceDefinition, TraceStep } from "../types";
import { listDisplay, ListState, listStep, nodeValues } from "./shared";

/**
 * One pass with a fixed gap. A dummy node in front of the head means removing the first node is no special case.
 * `fast` walks n + 1 nodes ahead of `slow` (both start at the dummy); then both walk together until `fast` runs off
 * the end. `slow` is then just before the nth node from the end, and one link (`slow.next = slow.next.next`) skips
 * it. The removed node is set aside below the list in the last step. Key steps: the dummy, the open gap, the first
 * walk together, `fast` past the end, the unlink, and the answer.
 */
export function removeNthNodeFromEnd(values: number[], n: number): Trace {
  const list = new ListState();
  const dummy = list.add("dummy", 0, 0, true);
  const ids = list.addList(values, 0, 1);
  list.link(dummy, ids[0] ?? null);
  list.snapshot(); // building the list isn't a rewire anyone sees
  const value = (id: number) => list.nodes[id].value as number;
  const steps: TraceStep[] = [];
  let fast: number | null = dummy;
  let slow = dummy;

  steps.push(
    listStep(list, {
      kind: "start",
      key: true,
      pointers: { slow, fast },
      note: `Put a dummy node in front of the head, and start slow and fast there. Then removing the node ${n} from the end works the same way, even when it's the head.`,
    }),
  );

  for (let k = 0; k <= n; k++) fast = list.next(fast!);
  steps.push(
    listStep(list, {
      kind: "gap",
      key: true,
      pointers: { slow, fast },
      equation: { terms: [n, 1], operator: "+", result: n + 1 },
      note: `Move fast ${n} + 1 = ${n + 1} nodes ahead. That gap stays fixed from now on.`,
    }),
  );

  let walked = 0;
  while (fast !== null) {
    fast = list.next(fast);
    slow = list.next(slow)!;
    walked++;
    steps.push(
      listStep(list, {
        kind: fast === null ? "end" : "walk",
        key: walked === 1 || fast === null,
        pointers: { slow, fast },
        note:
          fast === null
            ? `fast has run off the end, so slow (${value(slow)}) sits right before the node to remove.`
            : `Move both one step: slow to ${value(slow)}, fast to ${value(fast)}. The gap between them is still ${n + 1}.`,
      }),
    );
  }

  const removed = list.next(slow)!;
  list.link(slow, list.next(removed));
  steps.push(
    listStep(list, {
      kind: "unlink",
      key: true,
      pointers: { slow },
      rejected: [removed],
      note: `Point ${slow === dummy ? "the dummy" : value(slow)} past ${value(removed)}, at ${list.next(removed) === null ? "null" : value(list.next(removed)!)}. Nothing links to ${value(removed)} any more: it's out of the list.`,
    }),
  );

  // Set the removed node aside and close the gap it left.
  list.place(removed, 1, list.nodes[removed].slot);
  for (let id = list.next(dummy), slot = 1; id !== null; id = list.next(id), slot++) list.place(id, 0, slot);
  const answer = list.walk(list.next(dummy));
  steps.push(
    listStep(list, {
      kind: "done",
      key: true,
      pointers: { head: list.next(dummy) },
      rejected: [removed],
      note: `The answer starts at dummy.next: ${answer.length > 0 ? answer.join(" → ") : "an empty list"}.`,
    }),
  );

  return {
    problem: "linked-list/remove-nth-node-from-end",
    row: { values: list.values(), display: "list" },
    pointerNames: ["slow", "fast", "head"],
    steps,
    answer,
    answerDisplay: listDisplay(answer),
  };
}

export const removeNthNodeFromEndTrace: TraceDefinition<[number[], number]> = {
  problem: "linked-list/remove-nth-node-from-end",
  exampleIndex: 0,
  exampleSource: "analogy",
  // The dummy plus up to 6 nodes in one lane; the walk together shows at most 2 key steps.
  args: z
    .tuple([nodeValues(6).min(1), z.number().int().min(1)])
    .refine(([values, n]) => n <= values.length, "n is longer than the list"),
  run: removeNthNodeFromEnd,
};
