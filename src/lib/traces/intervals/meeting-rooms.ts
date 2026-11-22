import { z } from "zod";

import { compare, type Trace, type TraceDefinition, type TraceStep } from "../types";
import { axis, show, Timeline } from "./shared";

/**
 * Sort the meetings by start (lanes follow the sorted order); then only neighbors can clash, so one pass compares each
 * meeting's start with the previous meeting's end. Starting at or after it is fine (positive, even "=": back to back);
 * starting before it is a clash (negative), and the answer is false. Every step is key.
 */
export function meetingRooms(intervals: number[][]): Trace {
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
      note: `Sort by start: ${order.map((id) => show(intervals[id])).join(", ")}. Now only neighbors can clash.`,
      timeline: timeline.snapshot(),
    },
  ];
  let answer = true;
  for (let k = 1; k < n; k++) {
    const prev = intervals[order[k - 1]];
    const cur = intervals[order[k]];
    const clash = cur[0] < prev[1];
    for (let j = 0; j < k - 1; j++) timeline.set(order[j], { state: "done" });
    timeline.set(order[k - 1], { state: "active" });
    timeline.set(order[k], { state: clash ? "removed" : "current" });
    steps.push({
      kind: clash ? "clash" : "fits",
      key: true,
      pointers: {},
      note: clash
        ? `${show(cur)} starts at ${cur[0]}, before ${show(prev)} ends at ${prev[1]}: they clash, so not every meeting can be attended.`
        : `${show(cur)} starts at ${cur[0]}, ${cur[0] === prev[1] ? "just as" : "after"} ${show(prev)} ends at ${prev[1]}: no clash.`,
      equation: {
        terms: [cur[0]],
        operator: "+",
        result: cur[0],
        comparison: { op: compare(cur[0], prev[1]), target: prev[1] },
        tone: clash ? "negative" : "positive",
      },
      timeline: timeline.snapshot(
        clash ? { overlap: { start: cur[0], end: Math.min(cur[1], prev[1]) } } : {},
      ),
    });
    if (clash) {
      answer = false;
      break;
    }
  }
  const { min, max } = axis(intervals.length ? intervals : [[0, 1]]);
  return {
    problem: "intervals/meeting-rooms",
    row: { values: [], display: "cards" },
    timeline: { min, max, lanes: Math.max(1, n), input },
    pointerNames: [],
    steps,
    answer,
    answerDisplay: String(answer),
  };
}

export const meetingRoomsTrace: TraceDefinition<[number[][]]> = {
  problem: "intervals/meeting-rooms",
  exampleIndex: 0,
  exampleSource: "problem-native",
  args: z.tuple([
    z
      .array(z.tuple([z.number().int().min(0).max(24), z.number().int().min(0).max(24)]))
      .min(2)
      .max(6),
  ]),
  run: meetingRooms,
};
