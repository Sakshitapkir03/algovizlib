import { z } from "zod";

import type { Trace, TraceDefinition, TraceQueueItem, TraceStep } from "../types";
import { layers, MAX_NETWORK_NODES, Network } from "./shared";

/**
 * Kahn's algorithm, exactly like the reference solution: count each course's prerequisites (its in-degree, a badge
 * on its node), queue every course with none, and take courses from the front; taking one uses up its outgoing
 * arrows, and a course whose count reaches 0 joins the queue. Queue items carry their round (how many takes deep
 * they were freed). If the queue empties early, the courses left can never reach 0: they sit on a cycle. Key steps:
 * the start, every take, and the verdict. Taking fewer courses than there are is the bad news (negative).
 */
export function courseSchedule(numCourses: number, prerequisites: number[][]): Trace {
  const arrows = prerequisites.map(([course, needed]) => [needed, course] as [number, number]);
  const inDegree = new Array<number>(numCourses).fill(0);
  for (const [, course] of arrows) inDegree[course]++;
  const sources = inDegree.flatMap((d, i) => (d === 0 ? [i] : []));
  const spots = layers(numCourses, arrows, sources.length ? sources : [0]);
  const net = new Network(spots.map((s, i) => ({ label: String(i), ...s })));
  for (const [from, to] of arrows) net.addEdge(from, to);
  const given = net.given();
  const badge = (i: number) => net.setBadge(i, `in ${inDegree[i]}`);
  for (let i = 0; i < numCourses; i++) badge(i);

  const round = new Array<number>(numCourses).fill(0);
  const queue: TraceQueueItem[] = sources.map((id) => ({ id, label: String(id), level: 0 }));
  for (const id of sources) net.setState(id, "ready");
  const order: string[] = [];
  const steps: TraceStep[] = [
    {
      kind: "start",
      key: true,
      pointers: {},
      note: `Count each course's prerequisites; ${sources.length ? `course${sources.length > 1 ? "s" : ""} ${sources.join(", ")} need${sources.length > 1 ? "" : "s"} nothing, so ${sources.length > 1 ? "they start" : "it starts"} the queue` : "every course needs another, so the queue starts empty"}.`,
      network: net.snapshot(),
      queue: { items: [...queue], enqueued: [...sources] },
      partial: { items: [], found: [] },
    },
  ];
  while (queue.length > 0) {
    const taken = queue.shift()!;
    const course = taken.id;
    for (const id of order) net.setState(Number(id), "done");
    net.setState(course, "current");
    order.push(String(course));
    const freed: number[] = [];
    for (const edge of net.out(course)) {
      edge.state = "used";
      inDegree[edge.to]--;
      badge(edge.to);
      if (inDegree[edge.to] === 0) {
        round[edge.to] = round[course] + 1;
        queue.push({ id: edge.to, label: String(edge.to), level: round[edge.to] });
        net.setState(edge.to, "ready");
        freed.push(edge.to);
      }
    }
    const dependents = net.out(course).map((e) => e.to);
    steps.push({
      kind: "take",
      key: true,
      pointers: {},
      note: `Take course ${course}${dependents.length ? `: courses ${dependents.join(", ")} each lose one prerequisite${freed.length ? `, and ${freed.join(", ")} now need${freed.length > 1 ? "" : "s"} nothing, so ${freed.length > 1 ? "they join" : "it joins"} the queue` : ", but none reaches 0"}` : "; nothing depends on it"}.`,
      network: net.snapshot(),
      queue: { items: [...queue], dequeued: taken, ...(freed.length ? { enqueued: freed } : {}) },
      partial: { items: [...order], added: String(course), found: [] },
    });
  }
  for (const id of order) net.setState(Number(id), "done");
  const left = inDegree.flatMap((d, i) => (d > 0 ? [i] : []));
  for (const id of left) net.setState(id, "stuck");
  const possible = order.length === numCourses;
  steps.push({
    kind: possible ? "all-taken" : "stuck",
    key: true,
    pointers: {},
    note: possible
      ? `The queue is empty and all ${numCourses} courses were taken: an order exists.`
      : `The queue is empty after ${order.length} of ${numCourses} courses; ${left.join(", ")} still wait on each other (a cycle), so it's impossible.`,
    equation: {
      terms: [order.length],
      operator: "+",
      result: order.length,
      comparison: { op: possible ? "=" : "<", target: numCourses },
      tone: possible ? "positive" : "negative",
    },
    network: net.snapshot(),
    queue: { items: [] },
    partial: { items: [...order], found: [] },
  });
  return {
    problem: "advanced-graphs/course-schedule",
    row: { values: [], display: "network" },
    network: given,
    pointerNames: [],
    steps,
    answer: possible,
    answerDisplay: String(possible),
  };
}

export const courseScheduleTrace: TraceDefinition<[number, number[][]]> = {
  problem: "advanced-graphs/course-schedule",
  exampleIndex: 0,
  exampleSource: "problem-native",
  args: z
    .tuple([
      z.number().int().min(1).max(MAX_NETWORK_NODES),
      z.array(z.tuple([z.number().int().min(0), z.number().int().min(0)])).max(8),
    ])
    .refine(([n, pre]) => pre.every(([a, b]) => a < n && b < n && a !== b), "courses are 0…n-1"),
  run: courseSchedule,
};
