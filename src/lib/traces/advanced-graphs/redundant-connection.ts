import { z } from "zod";

import type { Trace, TraceDefinition, TraceStep } from "../types";
import { Forest, MAX_NETWORK_NODES } from "./shared";

/**
 * Union-find with path halving (no union by size, like the reference solution: the first end's root points at the
 * second's), edge by edge in input order. The first edge whose ends already share a root closes the one cycle, and
 * every other cycle edge came before it, so it's the answer. Elements are nodes 1…n, drawn at positions 0…n-1. Every
 * processed edge is key; edges after the answer are never read. No comparisons, so no tones.
 */
export function redundantConnection(edges: number[][]): Trace {
  const n = edges.length;
  const forest = new Forest(
    Array.from({ length: n }, (_, i) => String(i + 1)),
    false,
  );
  const steps: TraceStep[] = [];
  let answer: number[] = [];
  for (let k = 0; k < edges.length; k++) {
    const [a, b] = edges[k];
    const ra = forest.find(a - 1);
    const rb = forest.find(b - 1);
    if (ra === rb) {
      forest.same(ra);
      answer = [a, b];
      steps.push({
        kind: "redundant",
        key: true,
        pointers: {},
        note: `Edge ${a}-${b}: ${a} and ${b} both lead to root ${ra + 1}, so they're already connected; this edge closes the loop and is the answer.`,
        rejected: [k],
        forest: forest.snapshot(),
      });
      break;
    }
    forest.link(ra, rb);
    steps.push({
      kind: "union",
      key: true,
      pointers: {},
      note: `Edge ${a}-${b}: roots ${ra + 1} and ${rb + 1} differ, so root ${ra + 1} now points at root ${rb + 1}: one group.`,
      active: [k],
      forest: forest.snapshot(),
    });
  }
  return {
    problem: "advanced-graphs/redundant-connection",
    row: { values: edges.map(([a, b]) => `${a}–${b}`), display: "cards" },
    pointerNames: [],
    steps,
    answer,
    answerDisplay: `[${answer.join(", ")}]`,
  };
}

export const redundantConnectionTrace: TraceDefinition<[number[][]]> = {
  problem: "advanced-graphs/redundant-connection",
  exampleIndex: 0,
  exampleSource: "analogy",
  args: z.tuple([
    z
      .array(z.tuple([z.number().int().min(1), z.number().int().min(1)]))
      .min(3)
      .max(MAX_NETWORK_NODES)
      .refine((e) => e.every(([a, b]) => a !== b && a <= e.length && b <= e.length), "nodes are 1…n"),
  ]),
  run: redundantConnection,
};
