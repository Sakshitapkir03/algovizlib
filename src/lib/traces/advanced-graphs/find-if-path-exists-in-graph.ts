import { z } from "zod";

import { compare, type Trace, type TraceDefinition, type TraceStep } from "../types";
import { Forest, MAX_NETWORK_NODES } from "./shared";

/**
 * Union-find by size with path halving, edge by edge: find both ends' roots; the same root means nothing to join,
 * otherwise the smaller group's root points at the larger one's (ties: the first end's root stays on top). Then one
 * query: do source and destination share a root? Every edge and the query are key. The size comparison's sign says
 * nothing good or bad, so it's neutral.
 */
export function findIfPathExistsInGraph(
  n: number,
  edges: number[][],
  source: number,
  destination: number,
): Trace {
  const forest = new Forest(
    Array.from({ length: n }, (_, i) => String(i)),
    true,
  );
  const sizes = forest.sizes!;
  const steps: TraceStep[] = [];
  edges.forEach(([u, v], k) => {
    let a = forest.find(u);
    let b = forest.find(v);
    if (a === b) {
      forest.same(a);
      steps.push({
        kind: "same",
        key: true,
        pointers: {},
        note: `Edge ${u}-${v}: both ends already lead to root ${a}, so they're in one group; nothing to join.`,
        active: [k],
        forest: forest.snapshot(),
      });
      return;
    }
    const [ra, rb, sa, sb] = [a, b, sizes[a], sizes[b]];
    if (sizes[a] < sizes[b]) [a, b] = [b, a];
    const moved = sizes[b];
    forest.link(b, a);
    steps.push({
      kind: "union",
      key: true,
      pointers: {},
      note: `Edge ${u}-${v}: ${u} leads to root ${ra} (group of ${sa}), ${v} to root ${rb} (group of ${sb}); ${sa === sb ? "a tie, so" : "the smaller group's"} root ${b} now points at root ${a}, ${moved === 1 ? "1 element joining" : `${moved} elements joining`}: a group of ${sizes[a]}.`,
      active: [k],
      equation: {
        terms: [sa],
        operator: "+",
        result: sa,
        comparison: { op: compare(sa, sb), target: sb },
        tone: "neutral",
      },
      forest: forest.snapshot(),
    });
  });
  const rs = forest.find(source);
  const rd = forest.find(destination);
  const connected = rs === rd;
  if (connected) forest.same(rs);
  steps.push({
    kind: "query",
    key: true,
    pointers: {},
    note: `find(${source}) walks up to root ${rs} and find(${destination}) to root ${rd}: ${connected ? "the same root, so a path exists" : "different roots, so no path joins them"}.`,
    forest: forest.snapshot(),
  });
  return {
    problem: "advanced-graphs/find-if-path-exists-in-graph",
    row: { values: edges.map(([u, v]) => `${u}–${v}`), display: "cards" },
    pointerNames: [],
    steps,
    answer: connected,
    answerDisplay: String(connected),
  };
}

export const findIfPathExistsInGraphTrace: TraceDefinition<[number, number[][], number, number]> = {
  problem: "advanced-graphs/find-if-path-exists-in-graph",
  exampleIndex: 0,
  exampleSource: "analogy",
  args: z
    .tuple([
      z.number().int().min(1).max(MAX_NETWORK_NODES),
      z.array(z.tuple([z.number().int().min(0), z.number().int().min(0)])).max(6),
      z.number().int().min(0),
      z.number().int().min(0),
    ])
    .refine(
      ([n, edges, s, d]) => s < n && d < n && edges.every(([u, v]) => u < n && v < n && u !== v),
      "nodes must be below n",
    ),
  run: findIfPathExistsInGraph,
};
