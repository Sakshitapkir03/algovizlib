import { z } from "zod";

import type { BfsCheck, Trace, TraceDefinition } from "../types";
import { Bfs, cellId, cellLabel, gridOf, step } from "./shared";

/** The eight directions, in the reference solution's order (row offset -1…1, then column offset -1…1). */
const EIGHT_DIRS: [number, number][] = [-1, 0, 1].flatMap((dr) =>
  [-1, 0, 1].filter((dc) => dr !== 0 || dc !== 0).map((dc) => [dr, dc] as [number, number]),
);

/**
 * BFS from the top-left cell, counting cells on the route (the start is 1). Each cell taken off the queue checks its
 * eight neighbors: off the grid, a wall, or already reached are skipped; an open new cell gets distance + 1 and joins
 * the queue. Because every move costs one, cells come off the queue in order of distance, so the first time the
 * bottom-right cell comes off, its distance is the shortest route. Key steps: the start, every cell that reaches new
 * cells, and the target coming off the queue.
 */
export function shortestPathInBinaryMatrix(grid: number[][]): Trace {
  const n = grid.length;
  const cols = grid[0].length;
  const bfs = new Bfs(cellLabel(cols));
  const target = cellId(cols, n - 1, cols - 1);
  let answer = -1;

  if (grid[0][0] !== 0 || grid[n - 1][cols - 1] !== 0) {
    bfs.record({
      kind: "done",
      key: true,
      note: "The start or the end is a wall, so there's no route: -1.",
    });
  } else {
    bfs.enqueue(0, 1);
    bfs.record({
      kind: "start",
      key: true,
      note: "Start in the top-left cell: a route of 1 cell so far. Queue it.",
    });
    while (bfs.queue.length > 0) {
      const item = bfs.dequeue();
      const [r, c] = [Math.floor(item.id / cols), item.id % cols];
      if (item.id === target) {
        answer = item.level;
        bfs.record(
          {
            kind: "reached",
            key: true,
            note: `The bottom-right cell comes off the queue at distance ${item.level}: no route can be shorter, because every closer cell came off first.`,
          },
          { current: item.id },
        );
        break;
      }
      const checks: BfsCheck[] = [];
      const added: string[] = [];
      for (const dir of EIGHT_DIRS) {
        const next = step(n, cols, r, c, dir);
        if (!next) {
          checks.push({ from: item.id, dir, result: "out" });
          continue;
        }
        const result = grid[next.r][next.c] !== 0 ? "blocked" : bfs.has(next.id) ? "visited" : "added";
        checks.push({ from: item.id, to: next.id, dir, result });
        if (result === "added") {
          bfs.enqueue(next.id, item.level + 1);
          added.push(`(${next.r},${next.c})`);
        }
      }
      bfs.record(
        {
          kind: added.length > 0 ? "expand" : "dead-end",
          key: added.length > 0,
          note:
            added.length > 0
              ? `Take (${r},${c}), distance ${item.level}, off the front. ${added.join(" and ")} ${added.length === 1 ? "is" : "are"} open and new: distance ${item.level + 1}.`
              : `Take (${r},${c}) off the front: every neighbor is a wall, already reached, or off the grid.`,
        },
        { current: item.id, checks },
      );
    }
    if (answer === -1)
      bfs.record({ kind: "done", key: true, note: "The queue is empty before the bottom-right cell: -1." });
  }

  return {
    problem: "graphs-bfs/shortest-path-in-binary-matrix",
    row: { values: grid.flat(), display: "grid" },
    grid: {
      rows: n,
      cols,
      cells: grid.map((row) => [...row]),
      legend: [
        { value: 0, glyph: "", word: "open", tone: "plain" },
        { value: 1, glyph: "■", word: "wall", tone: "wall" },
      ],
    },
    pointerNames: [],
    steps: bfs.steps,
    answer,
    answerDisplay: String(answer),
  };
}

export const shortestPathInBinaryMatrixTrace: TraceDefinition<[number[][]]> = {
  problem: "graphs-bfs/shortest-path-in-binary-matrix",
  exampleIndex: 0,
  exampleSource: "analogy",
  args: z.tuple([gridOf(1).refine((g) => g.length === g[0].length, "the grid is square")]),
  run: shortestPathInBinaryMatrix,
};
