import { z } from "zod";

import type { Trace, TraceDefinition, TraceStep, TraceTreeNode } from "../types";
import { cell, Table } from "./shared";

/** The plain recursion's calls, top `levels` levels only: ways(k) calls ways(k - 1) and ways(k - 2) while k ≥ 2. */
function recursionTree(n: number, levels: number): TraceTreeNode[] {
  const nodes: TraceTreeNode[] = [{ id: 0, value: n, left: null, right: null }];
  const depth = [0];
  for (let head = 0; head < nodes.length; head++) {
    const node = nodes[head];
    if (node.value < 2 || depth[head] === levels - 1) continue;
    for (const [side, value] of [
      ["left", node.value - 1],
      ["right", node.value - 2],
    ] as const) {
      node[side] = nodes.length;
      nodes.push({ id: nodes.length, value, left: null, right: null });
      depth.push(depth[head] + 1);
    }
  }
  return nodes;
}

/** Calls in the order plain recursion makes them (left subtree first). */
function preorder(nodes: readonly TraceTreeNode[], id: number | null = 0): number[] {
  if (id === null || nodes.length === 0) return [];
  return [id, ...preorder(nodes, nodes[id].left), ...preorder(nodes, nodes[id].right)];
}

/**
 * ways(i) = ways(i - 1) + ways(i - 2): the last move onto step i was a 1-step hop from i - 1 or a 2-step hop from
 * i - 2. Plain recursion asks for the same smaller answers again and again (the first steps show the top of its call
 * tree with every repeat marked, then the memoized version, where each repeat is a lookup and its whole subtree is
 * skipped). The table fills left to right, each cell reading the two before it, so every answer is computed once and
 * reused twice. Key steps: the recursion tree, its memoized version, the base cases, the first cell, a cell reusing
 * answers, and the top step.
 */
export function climbingStairs(n: number): Trace {
  const nodes = recursionTree(n, 4);
  const seen = new Set<number>();
  const repeats = preorder(nodes).filter((id) =>
    seen.has(nodes[id].value) ? true : (seen.add(nodes[id].value), false),
  );
  const under = (id: number | null): number[] =>
    id === null ? [] : [nodes[id].left, nodes[id].right].flatMap((c) => (c === null ? [] : [c, ...under(c)]));
  const skipped = [...new Set(repeats.flatMap(under))].sort((a, b) => a - b);
  const lookups = repeats.filter((id) => !skipped.includes(id));

  const table = new Table(1, n + 1);
  const steps: TraceStep[] = [];
  const push = (step: Omit<TraceStep, "pointers" | "table">, extra: Parameters<Table["snapshot"]>[0] = {}) =>
    steps.push({ ...step, pointers: {}, table: table.snapshot(extra) });

  push({
    kind: "recursion",
    key: true,
    note:
      repeats.length > 0
        ? `Plain recursion asks ways(${n}) for ways(${n - 1}) and ways(${n - 2}), and each of those asks again: already in the top levels, ${[
            ...new Set(repeats.map((id) => nodes[id].value)),
          ]
            .sort((a, b) => b - a)
            .map((v) => `ways(${v})`)
            .join(", ")} are asked more than once.`
        : `With ${n} ${n === 1 ? "step" : "steps"}, the recursion is tiny.`,
    tree: {
      path: [],
      done: [],
      ...(repeats.length
        ? {
            badges: repeats.map((id) => ({ node: id, text: "again" })),
            repeats: [...repeats].sort((a, b) => a - b),
          }
        : {}),
    },
  });
  push({
    kind: "memo",
    key: true,
    note: "Remember each answer the first time: every repeat becomes a lookup, and the calls under it never happen. That's a table with one cell per step.",
    tree: {
      path: [],
      done: [],
      ...(skipped.length ? { skipped } : {}),
      ...(lookups.length
        ? {
            badges: lookups.map((id) => ({ node: id, text: "lookup" })),
            repeats: [...lookups].sort((a, b) => a - b),
          }
        : {}),
    },
  });

  table.set(0, 0, 1);
  if (n >= 1) table.set(0, 1, 1);
  push(
    {
      kind: "base",
      key: true,
      note: "One way to stand on step 0 (do nothing), and one way to reach step 1 (a single 1-step hop).",
      climb: { at: 0 },
    },
    n <= 1 ? { answer: cell(0, n) } : {},
  );

  for (let i = 2; i <= n; i++) {
    const [one, two] = [table.get(0, i - 1), table.get(0, i - 2)];
    table.set(0, i, one + two);
    push(
      {
        kind: "fill",
        key: i === 2 || i === n || (i === 4 && n >= 5),
        note:
          i === 2
            ? `Step 2: hop 1 from step 1 (${one} way) or 2 from step 0 (${two} way): ${one + two} ways.`
            : `Step ${i}: ${one} ways to reach step ${i - 1} plus ${two} ways to reach step ${i - 2}: ${one + two}. Both answers are read from the table, not recomputed.`,
        equation: { terms: [one, two], operator: "+", result: one + two },
        climb: {
          at: i,
          hops: [
            { from: i - 1, to: i },
            { from: i - 2, to: i },
          ],
        },
      },
      {
        current: cell(0, i),
        reads: [
          { at: cell(0, i - 1), label: "1 step" },
          { at: cell(0, i - 2), label: "2 steps" },
        ],
        chosen: [0, 1],
        choice: "both",
        ...(i === n ? { answer: cell(0, n) } : {}),
      },
    );
  }

  const answer = table.get(0, n);
  return {
    problem: "dynamic-programming/climbing-stairs",
    row: { values: Array.from({ length: n + 1 }, (_, i) => i), display: "stairs" },
    tree: { nodes },
    dp: {
      rows: 1,
      cols: n + 1,
      rowHeaders: ["ways"],
      colHeaders: Array.from({ length: n + 1 }, (_, i) => String(i)),
    },
    pointerNames: [],
    steps,
    answer,
    answerDisplay: String(answer),
  };
}

export const climbingStairsTrace: TraceDefinition<[number]> = {
  problem: "dynamic-programming/climbing-stairs",
  exampleIndex: 0,
  exampleSource: "problem-native",
  // Steps 0…n must fit across the stage (and the table under them).
  args: z.tuple([z.number().int().min(1).max(8)]),
  run: climbingStairs,
};
