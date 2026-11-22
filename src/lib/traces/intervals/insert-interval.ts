import { z } from "zod";

import { compare, type Trace, type TraceDefinition, type TraceStep } from "../types";
import { axis, show, Timeline } from "./shared";

const NEW = 50;

/**
 * The list is sorted and non-overlapping, so one pass in three parts: ranges that end before the new one starts are
 * copied as they are; ranges that start at or before its end overlap it and are absorbed (it grows to cover them);
 * then it is placed, and the rest are copied. Lanes: the list on top, the new range under it, the result at the
 * bottom. No tones (an overlap here means absorb, not bad news). Every step is key.
 */
export function insertInterval(intervals: number[][], newInterval: number[]): Trace {
  const n = intervals.length;
  const timeline = new Timeline();
  intervals.forEach(([s, e], i) => timeline.add(i, s, e, 0));
  timeline.add(NEW, newInterval[0], newInterval[1], 1, "current");
  const input = timeline.list();
  const steps: TraceStep[] = [];
  const result: number[][] = [];
  const out = (r: number[], state: "result" = "result") => {
    result.push([...r]);
    timeline.add(100 + result.length - 1, r[0], r[1], 2, state);
  };
  let [start, end] = newInterval;
  let i = 0;
  const finish = (id: number) => timeline.set(id, { state: "done" });
  while (i < n && intervals[i][1] < start) {
    const r = intervals[i];
    out(r);
    finish(i);
    steps.push({
      kind: "before",
      key: true,
      pointers: {},
      note: `${show(r)} ends at ${r[1]}, before the new range starts at ${start}: copy it unchanged.`,
      equation: {
        terms: [r[1]],
        operator: "+",
        result: r[1],
        comparison: { op: compare(r[1], start), target: start },
      },
      timeline: timeline.snapshot(),
    });
    i++;
  }
  while (i < n && intervals[i][0] <= end) {
    const r = intervals[i];
    const before = [start, end];
    start = Math.min(start, r[0]);
    end = Math.max(end, r[1]);
    timeline.set(i, { state: "absorbed" });
    timeline.set(NEW, { start, end });
    steps.push({
      kind: "absorb",
      key: true,
      pointers: {},
      note: `${show(r)} starts at ${r[0]}, not after the new range ends at ${before[1]}: they overlap, so absorb it. The new range grows to ${show([start, end])}.`,
      equation: {
        terms: [r[0]],
        operator: "+",
        result: r[0],
        comparison: { op: compare(r[0], before[1]), target: before[1] },
      },
      timeline: timeline.snapshot({
        overlap: { start: Math.max(r[0], before[0]), end: Math.min(r[1], before[1]) },
        grow: { id: NEW, start: before[0], end: before[1] },
      }),
    });
    i++;
  }
  out([start, end]);
  finish(NEW);
  const rest = intervals.slice(i);
  for (let k = i; k < n; k++) {
    out(intervals[k]);
    finish(k);
  }
  steps.push({
    kind: "place",
    key: true,
    pointers: {},
    note: `Place ${show([start, end])}${rest.length ? `, then copy the rest: ${rest.map(show).join(", ")}` : ""}. Result: ${result.map(show).join(", ")}.`,
    timeline: timeline.snapshot(),
  });
  const { min, max } = axis([...intervals, newInterval]);
  return {
    problem: "intervals/insert-interval",
    row: { values: [], display: "cards" },
    timeline: { min, max, lanes: 3, input },
    pointerNames: [],
    steps,
    answer: result,
    answerDisplay: `[${result.map(show).join(", ")}]`,
  };
}

export const insertIntervalTrace: TraceDefinition<[number[][], number[]]> = {
  problem: "intervals/insert-interval",
  exampleIndex: 0,
  exampleSource: "analogy",
  args: z.tuple([
    z.array(z.tuple([z.number().int().min(0).max(30), z.number().int().min(0).max(30)])).max(5),
    z.tuple([z.number().int().min(0).max(30), z.number().int().min(0).max(30)]),
  ]),
  run: insertInterval,
};
