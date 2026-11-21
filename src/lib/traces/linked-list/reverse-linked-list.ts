import { z } from "zod";

import type { Trace, TraceDefinition, TraceStep } from "../types";
import { listDisplay, ListState, listStep, nodeValues } from "./shared";

/**
 * Reverse in place with three pointers: `prev` (the reversed part so far), `curr` (the node being flipped), and
 * `next` (saved first, because flipping `curr.next` would lose the rest of the list). Each node's arrow is turned to
 * point back at `prev`, then all three step forward. When `curr` runs off the end, `prev` is the new head; the last
 * step slides the nodes into their new reading order. Key steps: the start, every flip, and the new head.
 */
export function reverseLinkedList(values: number[]): Trace {
  const list = new ListState();
  const ids = list.addList(values, 0);
  const steps: TraceStep[] = [];
  let prev: number | null = null;
  let curr: number | null = ids[0] ?? null;

  steps.push(
    listStep(list, {
      kind: "start",
      key: true,
      pointers: { head: curr, curr },
      note:
        curr === null
          ? "The list is empty, so there's nothing to reverse."
          : `prev starts at null (nothing is reversed yet) and curr at the head, ${values[0]}.`,
    }),
  );

  while (curr !== null) {
    const next: number | null = list.next(curr);
    list.link(curr, prev);
    const value = values[curr];
    steps.push(
      listStep(list, {
        kind: "flip",
        key: true,
        pointers: { prev, curr, next },
        active: [curr],
        note:
          prev === null
            ? `Save next (${next === null ? "null" : values[next]}), then point ${value} at prev, which is null: ${value} becomes the new tail.`
            : `Save next (${next === null ? "null" : values[next]}), then turn ${value}'s arrow around to point at ${values[prev]}.`,
      }),
    );
    prev = curr;
    curr = next;
  }

  // Read the reversed list left to right: slide every node into its new place.
  const reversed = list.walk(prev);
  for (let id = prev, slot = 0; id !== null; id = list.next(id), slot++) list.place(id, 0, slot);
  steps.push(
    listStep(list, {
      kind: "done",
      key: true,
      pointers: { head: prev },
      note:
        prev === null
          ? "Nothing to reverse: the answer is the empty list."
          : `curr ran off the end, so prev (${values[prev]}) is the new head: ${reversed.join(" → ")}.`,
    }),
  );

  return {
    problem: "linked-list/reverse-linked-list",
    row: { values: list.values(), display: "list" },
    pointerNames: ["head", "prev", "curr", "next"],
    steps,
    answer: reversed,
    answerDisplay: listDisplay(reversed),
  };
}

export const reverseLinkedListTrace: TraceDefinition<[number[]]> = {
  problem: "linked-list/reverse-linked-list",
  exampleIndex: 0,
  exampleSource: "analogy",
  // One flip per node, plus the start and the new head: at most 7 key steps.
  args: z.tuple([nodeValues(5)]),
  run: reverseLinkedList,
};
