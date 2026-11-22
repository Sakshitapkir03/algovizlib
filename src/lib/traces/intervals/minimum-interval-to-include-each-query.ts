import { z } from "zod";

import { RecordedHeap } from "../heap/shared";
import type { Trace, TraceDefinition, TraceStep } from "../types";
import { axis, show, Timeline } from "./shared";

/**
 * Sort the ranges by left end (lanes follow that order) and answer the queries from smallest to largest, sweeping a
 * marker right. Each range that has started by the query joins a min-heap keyed by size ("size·right"). Ranges on top
 * that ended before the query are popped (they can't cover this query or any later one); the top is then the
 * smallest range covering it, or there's none (-1). Ranges that ended but aren't on top stay until they surface. No
 * comparisons, so no tones. Key steps: the last heap operation of each query (where it's answered), and the first pop.
 */
export function minimumIntervalToIncludeEachQuery(intervals: number[][], queries: number[]): Trace {
  const order = intervals.map((_, i) => i).sort((a, b) => intervals[a][0] - intervals[b][0]);
  const timeline = new Timeline();
  intervals.forEach(([l, r], i) => timeline.add(i, l, r, i));
  const input = timeline.list();
  order.forEach((id, lane) => timeline.set(id, { lane, fromLane: id }));
  const heap = new RecordedHeap("min");
  const byQuery = queries.map((_, j) => j).sort((a, b) => queries[a] - queries[b]);
  const answer = new Array<number>(queries.length).fill(-1);
  const answered: string[] = [];
  const steps: TraceStep[] = [
    {
      kind: "sort",
      key: true,
      pointers: {},
      note: `Sort the ranges by left end and take the queries in order: ${byQuery.map((j) => queries[j]).join(", ")}.`,
      timeline: timeline.snapshot(),
      heaps: [heap.snapshot()],
      partial: { items: [], found: [] },
    },
  ];
  const label = (id: number) => {
    const [l, r] = intervals[id];
    return `${r - l + 1}·${r}`;
  };
  let next = 0;
  let firstPop = true;
  // The interval a heap item stands for: its label (size·right) fixes the range, so any active match will do.
  const idOf = (itemLabel: string) =>
    order.find((k) => label(k) === itemLabel && ["active", "current"].includes(timeline.get(k).state))!;
  for (const j of byQuery) {
    const q = queries[j];
    const sweep = { at: q, label: `query ${q}` };
    const made: TraceStep[] = [];
    const step = (s: TraceStep) => {
      steps.push(s);
      made.push(s);
    };
    // Each heap operation is its own step: push every range that has started by the query...
    while (next < order.length && intervals[order[next]][0] <= q) {
      const id = order[next++];
      for (const k of order) if (timeline.get(k).state === "current") timeline.set(k, { state: "active" });
      heap.push({ key: intervals[id][1] - intervals[id][0] + 1, label: label(id) });
      timeline.set(id, { state: "current" });
      step({
        kind: "push",
        key: false,
        pointers: {},
        note: `${show(intervals[id])} starts at ${intervals[id][0]}, by query ${q}: push it, size ${intervals[id][1] - intervals[id][0] + 1}.`,
        timeline: timeline.snapshot({ sweep }),
        heaps: [heap.snapshot()],
        partial: { items: [...answered], found: [] },
      });
    }
    // ...then pop tops that ended before it.
    while (heap.size > 0) {
      const top = heap.peek()!;
      const right = Number(top.label.split("·")[1]);
      if (right >= q) break;
      const id = idOf(top.label);
      heap.pop();
      for (const k of order) if (timeline.get(k).state === "current") timeline.set(k, { state: "active" });
      timeline.set(id, { state: "removed" });
      step({
        kind: "pop",
        key: firstPop,
        pointers: {},
        note: `The smallest in the heap, ${show(intervals[id])}, ends at ${right}, before query ${q}: pop it. It can't cover this query or any later one.`,
        timeline: timeline.snapshot({ sweep }),
        heaps: [heap.snapshot()],
        partial: { items: [...answered], found: [] },
      });
      firstPop = false;
    }
    const top = heap.peek();
    answer[j] = top ? top.key : -1;
    const answerText = `q${q} → ${answer[j]}`;
    answered.push(answerText);
    const topId = top ? idOf(top.label) : undefined;
    if (topId !== undefined) timeline.set(topId, { state: "result" });
    const note = top
      ? `The heap's top, ${show(intervals[topId!])}, covers ${q}: the smallest range holding query ${q} has size ${top.key}.`
      : `The heap is empty: no range covers query ${q}, so its answer is -1.`;
    // The answer goes on the last step this query made, or on a step of its own.
    const last = made.at(-1);
    if (last) {
      last.key = true;
      last.note = `${last.note} ${note}`;
      last.timeline = timeline.snapshot({ sweep });
      last.partial = { items: [...answered], added: answerText, found: [] };
    } else
      steps.push({
        kind: "answer",
        key: true,
        pointers: {},
        note,
        timeline: timeline.snapshot({ sweep }),
        heaps: [heap.snapshot()],
        partial: { items: [...answered], added: answerText, found: [] },
      });
    for (const k of order)
      if (["current", "result"].includes(timeline.get(k).state)) timeline.set(k, { state: "active" });
  }
  const { min, max } = axis([...intervals, ...queries.map((q) => [q, q])]);
  return {
    problem: "intervals/minimum-interval-to-include-each-query",
    row: { values: [], display: "cards" },
    timeline: { min, max, lanes: intervals.length, input },
    pointerNames: [],
    steps,
    answer,
    answerDisplay: `[${answer.join(", ")}]`,
  };
}

export const minimumIntervalToIncludeEachQueryTrace: TraceDefinition<[number[][], number[]]> = {
  problem: "intervals/minimum-interval-to-include-each-query",
  exampleIndex: 0,
  exampleSource: "analogy",
  args: z.tuple([
    z
      .array(z.tuple([z.number().int().min(0).max(20), z.number().int().min(0).max(20)]))
      .min(1)
      .max(5),
    z.array(z.number().int().min(0).max(20)).min(1).max(4),
  ]),
  run: minimumIntervalToIncludeEachQuery,
};
