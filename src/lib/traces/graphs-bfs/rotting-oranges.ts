import { z } from "zod";

import type { BfsCheck, Trace, TraceDefinition } from "../types";
import { Bfs, cellId, cellLabel, FOUR_DIRS, gridOf, step } from "./shared";

/**
 * Multi-source BFS: every rotten orange starts in the queue at minute 0. Each minute takes exactly the oranges that
 * rotted in the previous one off the queue; each rots its fresh neighbors, which join the queue for the next minute.
 * It stops when no fresh orange is left (the answer is the minutes passed) or the queue empties first (-1). Key steps:
 * the start with every source queued, both sources in the first minute, the first orange of the next minute, the
 * moment the last fresh orange rots, and the answer. The count of fresh oranges falling is good news.
 */
export function rottingOranges(grid: number[][]): Trace {
  const rows = grid.length;
  const cols = grid[0].length;
  const cells = grid.map((row) => [...row]);
  const bfs = new Bfs(cellLabel(cols));
  let fresh = 0;
  const sources: string[] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      if (cells[r][c] === 2) {
        bfs.enqueue(cellId(cols, r, c), 0);
        sources.push(`(${r},${c})`);
      } else if (cells[r][c] === 1) fresh++;
    }
  bfs.record(
    {
      kind: "start",
      key: true,
      note:
        sources.length > 0
          ? `Every rotten orange starts in the queue at once: ${sources.join(" and ")}. ${fresh} fresh ${fresh === 1 ? "orange is" : "oranges are"} left.`
          : `There are no rotten oranges. ${fresh} fresh ${fresh === 1 ? "orange is" : "oranges are"} left.`,
      counter: { value: fresh },
    },
    { cells },
  );

  let minutes = 0;
  let zeroShown = false;
  while (fresh > 0 && bfs.queue.length > 0) {
    const size = bfs.queue.length;
    for (let k = 0; k < size; k++) {
      const item = bfs.dequeue();
      const [r, c] = [Math.floor(item.id / cols), item.id % cols];
      const checks: BfsCheck[] = [];
      const rotted: string[] = [];
      for (const dir of FOUR_DIRS) {
        const next = step(rows, cols, r, c, dir);
        if (!next) {
          checks.push({ from: item.id, dir, result: "out" });
          continue;
        }
        const value = cells[next.r][next.c];
        const result = value === 1 ? "added" : value === 2 ? "visited" : "blocked";
        checks.push({ from: item.id, to: next.id, dir, result });
        if (result === "added") {
          cells[next.r][next.c] = 2;
          fresh--;
          bfs.enqueue(next.id, minutes + 1);
          rotted.push(`(${next.r},${next.c})`);
        }
      }
      const lastFresh = fresh === 0 && !zeroShown && rotted.length > 0;
      if (lastFresh) zeroShown = true;
      bfs.record(
        {
          kind: rotted.length > 0 ? "rot" : "no-change",
          // The first minute shows every source spreading; later minutes their first orange.
          key: minutes === 0 || k === 0 || lastFresh,
          note: `Minute ${minutes + 1}: (${r},${c}) ${
            rotted.length > 0
              ? `rots ${rotted.join(" and ")}, which ${rotted.length === 1 ? "joins" : "join"} the queue for minute ${minutes + 2}.`
              : "has no fresh neighbor left to rot."
          } ${fresh} fresh left.`,
          counter: { value: fresh },
        },
        { current: item.id, checks, cells },
      );
    }
    minutes++;
  }
  const answer = fresh === 0 ? minutes : -1;
  bfs.record(
    {
      kind: "done",
      key: true,
      note:
        answer === -1
          ? `The queue is empty but ${fresh} fresh ${fresh === 1 ? "orange" : "oranges"} can never rot: -1.`
          : minutes === 0
            ? "There was nothing to rot: 0 minutes."
            : `No fresh orange is left after ${minutes} ${minutes === 1 ? "minute" : "minutes"}. The oranges still queued have nothing to rot.`,
      counter: { value: fresh },
    },
    { cells },
  );

  return {
    problem: "graphs-bfs/rotting-oranges",
    row: { values: grid.flat(), display: "grid" },
    grid: {
      rows,
      cols,
      cells: grid.map((row) => [...row]),
      legend: [
        { value: 0, glyph: "", word: "empty", tone: "plain" },
        { value: 1, glyph: "●", word: "fresh", tone: "fill" },
        { value: 2, glyph: "✱", word: "rotten", tone: "mark" },
      ],
    },
    pointerNames: [],
    steps: bfs.steps,
    answer,
    answerDisplay: String(answer),
  };
}

export const rottingOrangesTrace: TraceDefinition<[number[][]]> = {
  problem: "graphs-bfs/rotting-oranges",
  exampleIndex: 0,
  exampleSource: "problem-native",
  args: z.tuple([gridOf(2)]),
  run: rottingOranges,
};
