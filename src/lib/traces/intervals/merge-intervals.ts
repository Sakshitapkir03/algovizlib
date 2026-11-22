import { z } from "zod";

import { compare, type Trace, type TraceDefinition, type TraceStep } from "../types";
import { axis, show, Timeline } from "./shared";

/**
 * Sort by start (lanes follow the sorted order) and sweep once, keeping the merged ranges in a bottom lane. A range
 * that starts at or before the last merged range's end overlaps it: the merged range's end grows to cover it. One that
 * starts after it begins a new merged range. Overlap here isn't bad news, so tones are neutral. Every step is key.
 */
export function mergeIntervals(intervals: number[][]): Trace {
  const n = intervals.length;
  const order = intervals.map((_, i) => i).sort((a, b) => intervals[a][0] - intervals[b][0]);
  const timeline = new Timeline();
  intervals.forEach(([s, e], i) => timeline.add(i, s, e, i));
  const input = timeline.list();
  order.forEach((id, lane) => timeline.set(id, { lane, fromLane: id }));
  const steps: TraceStep[] = [
    {
      kind: "sort",
      key: true,
      pointers: {},
      note: `Sort by start: ${order.map((id) => show(intervals[id])).join(", ")}. Overlapping ranges are now next to each other.`,
      timeline: timeline.snapshot(),
    },
  ];
  const merged: number[][] = [];
  order.forEach((id, k) => {
    const [s, e] = intervals[id];
    const last = merged.at(-1);
    for (let j = 0; j < k; j++)
      if (timeline.get(order[j]).state === "current") timeline.set(order[j], { state: "done" });
    if (last && s <= last[1]) {
      const before = [...last];
      last[1] = Math.max(last[1], e);
      const resultId = 100 + merged.length - 1;
      timeline.set(id, { state: "absorbed" });
      timeline.set(resultId, { end: last[1] });
      steps.push({
        kind: "merge",
        key: true,
        pointers: {},
        note: `${show([s, e])} starts at ${s}, not after ${show(before)} ends at ${before[1]}: they overlap. ${last[1] > before[1] ? `The merged range grows to ${show(last)}.` : `It already lies inside ${show(last)}.`}`,
        equation: {
          terms: [s],
          operator: "+",
          result: s,
          comparison: { op: compare(s, before[1]), target: before[1] },
          tone: "neutral",
        },
        timeline: timeline.snapshot({
          overlap: { start: s, end: Math.min(e, before[1]) },
          grow: { id: resultId, start: before[0], end: before[1] },
        }),
      });
    } else {
      merged.push([s, e]);
      timeline.set(id, { state: "current" });
      timeline.add(100 + merged.length - 1, s, e, n, "result");
      steps.push({
        kind: "start",
        key: true,
        pointers: {},
        note: last
          ? `${show([s, e])} starts at ${s}, after ${show(last)} ends at ${last[1]}: a gap, so it starts a new merged range.`
          : `The first range, ${show([s, e])}, starts the first merged range.`,
        ...(last
          ? {
              equation: {
                terms: [s],
                operator: "+" as const,
                result: s,
                comparison: { op: compare(s, last[1]), target: last[1] },
                tone: "neutral" as const,
              },
            }
          : {}),
        timeline: timeline.snapshot(),
      });
    }
  });
  const { min, max } = axis(intervals);
  return {
    problem: "intervals/merge-intervals",
    row: { values: [], display: "cards" },
    timeline: { min, max, lanes: n + 1, input },
    pointerNames: [],
    steps,
    answer: merged,
    answerDisplay: `[${merged.map(show).join(", ")}]`,
  };
}

export const mergeIntervalsTrace: TraceDefinition<[number[][]]> = {
  problem: "intervals/merge-intervals",
  exampleIndex: 0,
  exampleSource: "analogy",
  args: z.tuple([
    z
      .array(z.tuple([z.number().int().min(0).max(30), z.number().int().min(0).max(30)]))
      .min(1)
      .max(5),
  ]),
  run: mergeIntervals,
};
