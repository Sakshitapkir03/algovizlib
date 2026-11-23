import { z } from "zod";

import type { Trace, TraceDefinition, TraceStep } from "../types";
import { binary } from "./shared";

/**
 * Breadth-first search over states (node, mask): `mask` has bit v set when node v has been visited. Every node is a
 * start (multi-source, level 0); a move to v sets its bit, mask | (1 << v). Two walks that stand on the same node with
 * the same visited set are the same state, so each is searched once. The first state whose mask is all ones ends the
 * search: its level is the answer. The trace follows the winning walk level by level (rebuilt from parent links),
 * with how many states each level holds; the nodes are cards (each showing the nodes it links to), the walker a
 * pointer, and visited nodes marked found. No comparisons, so no tones. Every level is key.
 */
export function shortestPathVisitingAllNodes(graph: number[][]): Trace {
  const n = graph.length;
  const full = (1 << n) - 1;
  const key = (v: number, m: number) => v * (1 << n) + m;
  const parent = new Map<number, number | null>();
  let frontier: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    parent.set(key(i, 1 << i), null);
    frontier.push([i, 1 << i]);
  }
  const sizes = [frontier.length];
  let end: [number, number] | undefined = n === 1 ? [0, 1] : undefined;
  while (!end && frontier.length > 0) {
    const next: [number, number][] = [];
    for (const [u, mask] of frontier) {
      for (const v of graph[u]) {
        const m = mask | (1 << v);
        if (parent.has(key(v, m))) continue;
        parent.set(key(v, m), key(u, mask));
        if (m === full) {
          end = [v, m];
          break;
        }
        next.push([v, m]);
      }
      if (end) break;
    }
    sizes.push(end ? next.length + 1 : next.length);
    frontier = next;
  }
  // The winning walk, start first.
  const walk: [number, number][] = [];
  for (
    let k: number | null | undefined = end ? key(end[0], end[1]) : undefined;
    k != null;
    k = parent.get(k)
  ) {
    walk.unshift([Math.floor(k / (1 << n)), k % (1 << n)]);
  }
  const labels = Array.from({ length: n }, (_, i) => String(n - 1 - i));
  const visited = (m: number) => Array.from({ length: n }, (_, v) => v).filter((v) => (m >> v) & 1);
  const steps: TraceStep[] = walk.map(([v, m], level): TraceStep => {
    const prev = walk[level - 1];
    const done = m === full;
    return {
      kind: level === 0 ? "start" : done ? "done" : "move",
      key: true,
      note:
        level === 0
          ? `Every node is a start at level 0 (${sizes[0]} states). Follow the walk from ${v}: mask = 1 << ${v} = ${binary(m, n)}.`
          : `Level ${level}: move ${prev[0]} → ${v}, mask | (1 << ${v}) = ${binary(m, n)}.${done ? ` All ${n} bits are set: every node visited in ${level} moves.` : ` This level holds ${sizes[level]} states.`}`,
      bits: {
        width: n,
        bitLabels: labels,
        rows:
          level === 0
            ? [{ name: "mask", value: m, changed: [v] }]
            : [
                { name: "mask", value: prev[1] },
                { name: `1 << ${v}`, value: 1 << v, op: "|" },
                { name: "mask", value: m, rule: true, changed: prev[1] === m ? [] : [v] },
              ],
      },
      pointers: { at: v },
      active: [v],
      found: visited(m),
      // The last level stops at the first full mask, so its count isn't a level's size: no counter there.
      ...(done && level > 0 ? {} : { counter: { value: sizes[level] } }),
    };
  });
  const answer = Math.max(0, walk.length - 1);
  return {
    problem: "bit-manipulation/shortest-path-visiting-all-nodes",
    // One card per node, its value the nodes it links to ("1,2,4"): the graph as adjacency lists.
    row: { values: graph.map((adj) => adj.join(",") || "–"), display: "cards" },
    pointerNames: ["at"],
    steps,
    answer,
    answerDisplay: String(answer),
  };
}

export const shortestPathVisitingAllNodesTrace: TraceDefinition<[number[][]]> = {
  problem: "bit-manipulation/shortest-path-visiting-all-nodes",
  exampleIndex: 0,
  exampleSource: "analogy",
  // Five nodes: five mask bits, and a short winning walk.
  args: z.tuple([
    z
      .array(z.array(z.number().int().min(0).max(4)).max(4))
      .min(1)
      .max(5),
  ]),
  run: shortestPathVisitingAllNodes,
};
