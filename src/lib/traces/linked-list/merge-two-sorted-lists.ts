import { z } from "zod";

import { compare, type Trace, type TraceDefinition, type TraceStep } from "../types";
import { listDisplay, ListState, listStep, nodeValues } from "./shared";

/** Lanes on screen: list A, list B, and the merged list (which starts with the dummy). */
const A = 0;
const B = 1;
const MERGED = 2;

/**
 * Merge with a dummy node: `tail` starts at a placeholder so the first node needs no special case. While both lists
 * have nodes, compare their heads, link the smaller one after `tail` (ties take A's, keeping the merge stable), and
 * advance that list and `tail`. A taken node moves into the merged lane; until the next link it still points into
 * its old list. When one list runs out, a single link attaches the rest of the other. The answer starts at
 * `dummy.next`. Key steps: the start, the first takes, a tie, and the final attach (some middle takes are off-screen
 * so the video fits).
 */
export function mergeTwoSortedLists(a: number[], b: number[]): Trace {
  const list = new ListState();
  const aIds = list.addList(a, A);
  const bIds = list.addList(b, B);
  const dummy = list.add("dummy", MERGED, 0, true);
  const value = (id: number) => list.nodes[id].value as number;
  const steps: TraceStep[] = [];
  let pa: number | null = aIds[0] ?? null;
  let pb: number | null = bIds[0] ?? null;
  let tail = dummy;
  let slot = 1;
  let takes = 0;

  steps.push(
    listStep(list, {
      kind: "start",
      key: true,
      pointers: { a: pa, b: pb, tail },
      note: "A dummy node starts the merged list, and tail points at it, so every node is linked the same way.",
    }),
  );

  while (pa !== null && pb !== null) {
    const [av, bv] = [value(pa), value(pb)];
    const takeA = av <= bv;
    const taken: number = takeA ? pa : pb;
    const other: number = takeA ? pb : pa;
    list.link(tail, taken);
    list.place(taken, MERGED, slot++);
    tail = taken;
    if (takeA) pa = list.next(taken);
    else pb = list.next(taken);
    takes++;
    const tie = value(taken) === value(other);
    steps.push(
      listStep(list, {
        kind: tie ? "tie" : "take",
        // The first two takes show the idea, a tie shows stability; later ones play off-screen.
        key: takes <= 2 || tie,
        pointers: { a: pa, b: pb, tail },
        active: [taken],
        // A's head against B's head. Neither sign is good or bad news: the smaller one is taken either way.
        equation: {
          terms: [av],
          operator: "+",
          result: av,
          comparison: { op: compare(av, bv), target: bv },
          tone: "neutral",
        },
        note: tie
          ? `Both heads are ${value(taken)}: take A's first (ties keep their order), link it after tail, and move tail onto it.`
          : `${value(taken)} is smaller than ${value(other)}, so link ${value(taken)} after tail and move tail onto it.`,
      }),
    );
  }

  const rest = pa ?? pb;
  list.link(tail, rest);
  for (let id = rest; id !== null; id = list.next(id)) list.place(id, MERGED, slot++);
  const merged = list.walk(list.next(dummy));
  steps.push(
    listStep(list, {
      kind: "attach",
      key: true,
      pointers: { tail, head: list.next(dummy) },
      ...(rest !== null ? { active: [rest] } : {}),
      note:
        rest === null
          ? "Both lists are empty, so the merged list is empty too."
          : `${pa === null ? "A" : "B"} is out of nodes, so one link attaches the rest of ${pa === null ? "B" : "A"} (from ${value(rest)}). The answer starts at dummy.next: ${merged.join(" → ")}.`,
    }),
  );

  return {
    problem: "linked-list/merge-two-sorted-lists",
    row: { values: list.values(), display: "list" },
    pointerNames: ["a", "b", "tail", "head"],
    steps,
    answer: merged,
    answerDisplay: listDisplay(merged),
  };
}

export const mergeTwoSortedListsTrace: TraceDefinition<[number[], number[]]> = {
  problem: "linked-list/merge-two-sorted-lists",
  exampleIndex: 0,
  exampleSource: "analogy",
  // The merged lane holds the dummy plus every node, so at most 8 nodes in all.
  args: z
    .tuple([nodeValues(4), nodeValues(4)])
    .refine(([a, b]) => a.length + b.length <= 8, "too many nodes"),
  run: mergeTwoSortedLists,
};
