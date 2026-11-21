import { z } from "zod";

import type { Trace, TraceDefinition, TraceStep } from "../types";
import { listDisplay, ListState, listStep, nodeValues } from "./shared";

/**
 * A min-heap of the lists' current heads (one node per list, never more than k). Pop the smallest, link it after
 * `tail` (a dummy node starts the merged list), and push its successor from the same list. Each pop moves a node
 * into the merged lane. Ties go to the earlier list. Key steps: the first heap, the first three pops, and the last.
 */
export function mergeKSortedLists(lists: number[][]): Trace {
  const list = new ListState();
  const k = lists.length;
  const merged = k; // the merged list's lane, under the inputs
  const heads = lists.map((values, lane) => list.addList(values, lane)[0] ?? null);
  const dummy = list.add("dummy", merged, 0, true);
  const value = (id: number) => list.nodes[id].value as number;
  // Which list each node came from (its lane before it moves into the merged one).
  const origin = new Map(list.nodes.map((n) => [n.id, n.lane]));
  const laneOf = (id: number) => origin.get(id)!;

  // A binary min-heap of node ids, ordered by value, then by list.
  const heap: number[] = [];
  const less = (x: number, y: number) =>
    value(x) < value(y) || (value(x) === value(y) && laneOf(x) < laneOf(y));
  const swap = (i: number, j: number) => ([heap[i], heap[j]] = [heap[j], heap[i]]);
  const push = (id: number) => {
    heap.push(id);
    for (let i = heap.length - 1; i > 0 && less(heap[i], heap[(i - 1) >> 1]); i = (i - 1) >> 1)
      swap(i, (i - 1) >> 1);
  };
  const pop = (): number => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length > 0) {
      heap[0] = last;
      for (let i = 0; ;) {
        const [l, r] = [2 * i + 1, 2 * i + 2];
        let m = i;
        if (l < heap.length && less(heap[l], heap[m])) m = l;
        if (r < heap.length && less(heap[r], heap[m])) m = r;
        if (m === i) break;
        swap(i, m);
        i = m;
      }
    }
    return top;
  };
  const state = () => ({ heap: heap.map(value), ...(heap.length > 0 ? { active: [...heap] } : {}) });

  for (const head of heads) if (head !== null) push(head);
  const steps: TraceStep[] = [];
  steps.push(
    listStep(list, {
      kind: "start",
      key: true,
      pointers: { tail: dummy },
      ...state(),
      counter: { value: 0 },
      note:
        heap.length === 0
          ? "Every list is empty, so the merged list is empty too."
          : `Put each list's first node in a min-heap (${heap.map(value).join(", ")}): the smallest of them is always on top.`,
    }),
  );

  let tail = dummy;
  let slot = 1;
  const total = lists.reduce((n, l) => n + l.length, 0);
  for (let taken = 1; heap.length > 0; taken++) {
    const top = pop();
    const next = list.next(top);
    list.link(tail, top);
    list.place(top, merged, slot++);
    tail = top;
    if (next !== null) push(next);
    const last = taken === total;
    steps.push(
      listStep(list, {
        kind: last ? "done" : "pop",
        key: taken <= 3 || last,
        pointers: { tail, ...(last ? { head: list.next(dummy) } : {}) },
        ...state(),
        counter: { value: taken, delta: 1 },
        note: last
          ? `The heap is empty: every node is linked. The answer starts at dummy.next: ${list.walk(list.next(dummy)).join(" → ")}.`
          : `Pop ${value(top)}, the smallest head, and link it after tail. ${next === null ? `Its list is used up, so nothing replaces it.` : `Its list's next node, ${value(next)}, goes into the heap.`}`,
      }),
    );
  }
  // A list that ended with the last pop still points at null; nothing else to link.
  const answer = list.walk(list.next(dummy));

  return {
    problem: "linked-list/merge-k-sorted-lists",
    row: { values: list.values(), display: "list" },
    pointerNames: ["tail", "head"],
    steps,
    answer,
    answerDisplay: listDisplay(answer),
  };
}

export const mergeKSortedListsTrace: TraceDefinition<[number[][]]> = {
  problem: "linked-list/merge-k-sorted-lists",
  exampleIndex: 0,
  exampleSource: "analogy",
  // Up to 3 lists of 3 nodes on the left, the merged list (dummy + up to 8 nodes) across the bottom.
  args: z
    .tuple([z.array(nodeValues(3)).min(1).max(3)])
    .refine(([lists]) => lists.reduce((n, l) => n + l.length, 0) <= 8, "too many nodes"),
  run: mergeKSortedLists,
};
