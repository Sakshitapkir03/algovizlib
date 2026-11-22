import { z } from "zod";

import { compare, type Trace, type TraceDefinition, type TraceStep } from "../types";
import { axis, show, Timeline } from "./shared";

/**
 * Greedy: sort by end (lanes follow the sorted order) and keep a range whenever it starts at or after the last kept
 * range's end; otherwise remove it. Keeping the range that ends first is safe: it leaves the most room for everything
 * after it, so no other choice could keep more. Keeping is positive, removing negative. Every step is key.
 */
export function nonOverlappingIntervals(intervals: number[][]): Trace {
  const order = intervals.map((_, i) => i).sort((a, b) => intervals[a][1] - intervals[b][1]);
  const timeline = new Timeline();
  intervals.forEach(([s, e], i) => timeline.add(i, s, e, i));
  const input = timeline.list();
  order.forEach((id, lane) => timeline.set(id, { lane, fromLane: id }));
  const steps: TraceStep[] = [
    {
      kind: "sort",
      key: true,
      pointers: {},
      note: `Sort by end: ${order.map((id) => show(intervals[id])).join(", ")}. The one that ends first leaves the most room.`,
      timeline: timeline.snapshot(),
      counter: { value: 0 },
    },
  ];
  let removed = 0;
  let lastEnd = -Infinity;
  let lastKept: number | undefined;
  for (const id of order) {
    const [s, e] = intervals[id];
    const keep = s >= lastEnd;
    if (lastKept !== undefined) timeline.set(lastKept, { state: keep ? "done" : "active" });
    if (keep) {
      const prevEnd = lastEnd;
      lastEnd = e;
      lastKept = id;
      timeline.set(id, { state: "result" });
      steps.push({
        kind: "keep",
        key: true,
        pointers: {},
        note:
          prevEnd === -Infinity
            ? `${show([s, e])} ends first: keep it. Nothing after ${e} is blocked yet.`
            : `${show([s, e])} starts at ${s}, not before the last kept range ends at ${prevEnd}: keep it. Now free from ${e}.`,
        ...(prevEnd === -Infinity
          ? {}
          : {
              equation: {
                terms: [s],
                operator: "+" as const,
                result: s,
                comparison: { op: compare(s, prevEnd), target: prevEnd },
                tone: "positive" as const,
              },
            }),
        timeline: timeline.snapshot({ sweep: { at: e, label: `free from ${e}` } }),
        counter: { value: removed, delta: 0 },
      });
    } else {
      removed++;
      timeline.set(id, { state: "removed" });
      const kept = intervals[lastKept!];
      steps.push({
        kind: "remove",
        key: true,
        pointers: {},
        note: `${show([s, e])} starts at ${s}, before ${show(kept)} ends at ${lastEnd}: they overlap. Remove ${show([s, e])}, which ends later, and keep ${show(kept)}.`,
        equation: {
          terms: [s],
          operator: "+",
          result: s,
          comparison: { op: compare(s, lastEnd), target: lastEnd },
          tone: "negative",
        },
        choice: { chosen: `keep ${show(kept)}`, rejected: `keep ${show([s, e])}` },
        timeline: timeline.snapshot({
          overlap: { start: Math.max(s, kept[0]), end: Math.min(e, lastEnd) },
          sweep: { at: lastEnd, label: `free from ${lastEnd}` },
        }),
        counter: { value: removed, delta: 1 },
      });
    }
  }
  const { min, max } = axis(intervals);
  return {
    problem: "intervals/non-overlapping-intervals",
    row: { values: [], display: "cards" },
    timeline: { min, max, lanes: intervals.length, input },
    pointerNames: [],
    steps,
    answer: removed,
    answerDisplay: String(removed),
  };
}

export const nonOverlappingIntervalsTrace: TraceDefinition<[number[][]]> = {
  problem: "intervals/non-overlapping-intervals",
  exampleIndex: 0,
  exampleSource: "analogy",
  args: z.tuple([
    z
      .array(z.tuple([z.number().int().min(0).max(30), z.number().int().min(0).max(30)]))
      .min(1)
      .max(6),
  ]),
  run: nonOverlappingIntervals,
};
