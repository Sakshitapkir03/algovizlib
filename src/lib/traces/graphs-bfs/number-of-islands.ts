import { z } from "zod";

import type { BfsCheck, Trace, TraceDefinition } from "../types";
import { Bfs, cellId, cellLabel, FOUR_DIRS, MAX_GRID_COLS, MAX_GRID_ROWS, step } from "./shared";

/**
 * Scan the map row by row. Land that hasn't been seen starts a new island: count it, then flood it breadth-first,
 * marking every connected land cell seen so the scan never counts it again. Water and cells already seen are skipped.
 * Key steps: the first island found, its first cell's neighbors, the moment its queue runs empty (the island is
 * done), the second island, and the final count.
 */
export function numberOfIslands(grid: string[]): Trace {
  const rows = grid.length;
  const cols = grid[0].length;
  const bfs = new Bfs(cellLabel(cols), false);
  let count = 0;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const start = cellId(cols, r, c);
      if (grid[r][c] !== "1" || bfs.has(start)) continue;
      count++;
      bfs.enqueue(start, 0);
      bfs.record(
        {
          kind: "found",
          key: count <= 2,
          note:
            count === 1
              ? `The scan reaches land at (${r},${c}) that hasn't been seen: island 1. Queue it and explore everything it touches.`
              : `More unseen land at (${r},${c}): island ${count}. Everything it touches will be marked too.`,
          counter: { value: count, delta: 1 },
        },
        { current: start },
      );
      let firstCell = true;
      while (bfs.queue.length > 0) {
        const item = bfs.dequeue();
        const [cr, cc] = [Math.floor(item.id / cols), item.id % cols];
        const checks: BfsCheck[] = [];
        const added: string[] = [];
        for (const dir of FOUR_DIRS) {
          const next = step(rows, cols, cr, cc, dir);
          if (!next) {
            checks.push({ from: item.id, dir, result: "out" });
            continue;
          }
          const result = grid[next.r][next.c] !== "1" ? "blocked" : bfs.has(next.id) ? "visited" : "added";
          checks.push({ from: item.id, to: next.id, dir, result });
          if (result === "added") {
            bfs.enqueue(next.id, item.level + 1);
            added.push(`(${next.r},${next.c})`);
          }
        }
        const finished = bfs.queue.length === 0;
        bfs.record(
          {
            kind: finished ? "island-done" : "explore",
            key: count === 1 && (firstCell || finished),
            note: `Take (${cr},${cc}) off the front: ${
              added.length > 0
                ? `${added.join(" and ")} ${added.length === 1 ? "is" : "are"} land, so mark and queue ${added.length === 1 ? "it" : "them"}.`
                : "its neighbors are water, already seen, or off the map."
            }${finished ? ` The queue is empty: island ${count} is fully marked.` : ""}`,
            counter: { value: count },
          },
          { current: item.id, checks },
        );
        firstCell = false;
      }
    }
  }
  bfs.record({
    kind: "done",
    key: true,
    note: `The scan reaches the end of the map: ${count} ${count === 1 ? "island" : "islands"}.`,
    counter: { value: count },
  });

  return {
    problem: "graphs-bfs/number-of-islands",
    row: { values: grid.flatMap((row) => [...row]), display: "grid" },
    grid: {
      rows,
      cols,
      cells: grid.map((row) => [...row]),
      legend: [
        { value: "1", glyph: "▲", word: "land", tone: "fill" },
        { value: "0", glyph: "≈", word: "water", tone: "plain" },
      ],
    },
    pointerNames: [],
    steps: bfs.steps,
    answer: count,
    answerDisplay: String(count),
  };
}

export const numberOfIslandsTrace: TraceDefinition<[string[]]> = {
  problem: "graphs-bfs/number-of-islands",
  exampleIndex: 0,
  exampleSource: "problem-native",
  args: z.tuple([
    z
      .array(
        z
          .string()
          .regex(/^[01]+$/)
          .max(MAX_GRID_COLS),
      )
      .min(1)
      .max(MAX_GRID_ROWS)
      .refine((g) => g.every((row) => row.length === g[0].length), "rows must have the same length"),
  ]),
  run: numberOfIslands,
};
