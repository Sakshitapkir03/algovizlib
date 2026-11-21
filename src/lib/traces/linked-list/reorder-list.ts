import { z } from "zod";

import type { Trace, TraceDefinition, TraceStep } from "../types";
import { listDisplay, ListState, listStep, nodeValues } from "./shared";

/** Lanes: the front half (the original list) and the back half while it's split off. */
const FRONT = 0;
const BACK = 1;

/**
 * Three moves, all in place. (1) Find the middle: `slow` steps once and `fast` twice until fast can't take two more.
 * (2) Cut after the middle and reverse the back half (it moves to its own lane, then flips). (3) Weave: point each
 * front node at the next back node and that back node at the following front node, two links per round, until the
 * back half is used up. The last step slides the nodes into their new reading order. Key steps: the start, the
 * middle, the cut, the reversed back half, the first weave, and the result.
 */
export function reorderList(values: number[]): Trace {
  const list = new ListState();
  const ids = list.addList(values, FRONT);
  const value = (id: number) => list.nodes[id].value as number;
  const steps: TraceStep[] = [];
  const head = ids[0];

  if (ids.length <= 2) {
    steps.push(
      listStep(list, {
        kind: "done",
        key: true,
        pointers: { head: head ?? null },
        note: "With two nodes or fewer, the order is already front, back, front: nothing moves.",
      }),
    );
    return finish(list, head, steps);
  }

  let slow = head;
  let fast = head;
  steps.push(
    listStep(list, {
      kind: "start",
      key: true,
      pointers: { slow, fast },
      note: `To alternate front and back, first find the middle: slow steps once and fast twice, both from ${value(head)}.`,
    }),
  );
  while (list.next(fast) !== null && list.next(list.next(fast)!) !== null) {
    slow = list.next(slow)!;
    fast = list.next(list.next(fast)!)!;
    const atMiddle = !(list.next(fast) !== null && list.next(list.next(fast)!) !== null);
    steps.push(
      listStep(list, {
        kind: atMiddle ? "middle" : "step",
        key: atMiddle,
        pointers: { slow, fast },
        note: atMiddle
          ? `fast can't take two more steps, so slow (${value(slow)}) is the middle: the front half ends there.`
          : `slow moves to ${value(slow)}, fast to ${value(fast)}.`,
      }),
    );
  }

  // Cut after the middle; the back half gets its own lane.
  let curr = list.next(slow);
  list.link(slow, null);
  const backIds: number[] = [];
  for (let id = curr; id !== null; id = list.next(id)) backIds.push(id);
  backIds.forEach((id, i) => list.place(id, BACK, i));
  steps.push(
    listStep(list, {
      kind: "cut",
      key: true,
      pointers: { slow, curr },
      note: `Cut after ${value(slow)}: it now points at null, and the back half (${backIds.map(value).join(", ")}) stands on its own.`,
    }),
  );

  let prev: number | null = null;
  while (curr !== null) {
    const next: number | null = list.next(curr);
    list.link(curr, prev);
    prev = curr;
    curr = next;
  }
  // The reversed back half, read left to right.
  for (let id = prev, slot = 0; id !== null; id = list.next(id), slot++) list.place(id, BACK, slot);
  steps.push(
    listStep(list, {
      kind: "reversed",
      key: true,
      pointers: { back: prev },
      note: `Reverse the back half one link at a time: it now runs ${list.walk(prev).join(" → ")}, so its first node is the original last one.`,
    }),
  );

  let front: number | null = head;
  let back: number | null = prev;
  let round = 0;
  while (front !== null && back !== null) {
    const frontNext: number | null = list.next(front);
    const backNext: number | null = list.next(back);
    list.link(front, back);
    list.link(back, frontNext);
    round++;
    steps.push(
      listStep(list, {
        kind: "weave",
        key: round === 1,
        pointers: { front, back },
        active: [front, back],
        note: `Point ${value(front)} at ${value(back)}, and ${value(back)} at ${frontNext === null ? "null" : value(frontNext)}: one front node, then one back node.`,
      }),
    );
    front = frontNext;
    back = backNext;
  }

  for (let id: number | null = head, slot = 0; id !== null; id = list.next(id), slot++)
    list.place(id, FRONT, slot);
  steps.push(
    listStep(list, {
      kind: "done",
      key: true,
      pointers: { head },
      note: `The back half is woven in: ${list.walk(head).join(" → ")}.`,
    }),
  );
  return finish(list, head, steps);
}

function finish(list: ListState, head: number | undefined, steps: TraceStep[]): Trace {
  const answer = list.walk(head ?? null);
  return {
    problem: "linked-list/reorder-list",
    row: { values: list.values(), display: "list" },
    pointerNames: ["head", "slow", "fast", "curr", "back", "front"],
    steps,
    answer,
    answerDisplay: listDisplay(answer),
  };
}

export const reorderListTrace: TraceDefinition<[number[]]> = {
  problem: "linked-list/reorder-list",
  exampleIndex: 0,
  exampleSource: "analogy",
  args: z.tuple([nodeValues(6)]),
  run: reorderList,
};
