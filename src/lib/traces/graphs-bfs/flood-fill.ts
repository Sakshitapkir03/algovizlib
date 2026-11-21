import { z } from "zod";

import type { BfsCheck, Trace, TraceCellKind, TraceDefinition } from "../types";
import { Bfs, cellId, cellLabel, FOUR_DIRS, gridOf, step } from "./shared";

/**
 * Paint the clicked pixel, then spread breadth-first: take a pixel off the queue and check its four neighbors. One
 * with the original color is painted and queued (painting marks it seen); anything else is skipped: already painted,
 * another color, or off the picture. The paint spreads one ring (level) at a time. Key steps: the click, the first
 * pixel's neighbors, the first pixel whose neighbors are all another color or painted, and the queue running empty.
 */
export function floodFill(image: number[][], sr: number, sc: number, color: number): Trace {
  const rows = image.length;
  const cols = image[0].length;
  const cells = image.map((row) => [...row]);
  const original = cells[sr][sc];
  const bfs = new Bfs(cellLabel(cols));
  const values = [...new Set([...image.flat(), color])].sort((a, b) => a - b);
  const legend: TraceCellKind[] = values.map((value) => ({
    value,
    glyph: String(value),
    word: `color ${value}`,
    tone: value === color ? "mark" : value === original ? "fill" : "plain",
  }));

  if (original === color) {
    bfs.record(
      {
        kind: "done",
        key: true,
        note: `The clicked pixel already has color ${color}, so the picture doesn't change.`,
      },
      { cells },
    );
  } else {
    cells[sr][sc] = color;
    bfs.enqueue(cellId(cols, sr, sc), 0);
    bfs.record(
      {
        kind: "start",
        key: true,
        note: `Paint the clicked pixel (${sr},${sc}) with ${color} and queue it. Its neighbors with color ${original} come next.`,
      },
      { cells },
    );
    let firstDead = true;
    let first = true;
    while (bfs.queue.length > 0) {
      const item = bfs.dequeue();
      const [r, c] = [Math.floor(item.id / cols), item.id % cols];
      const checks: BfsCheck[] = [];
      const added: string[] = [];
      for (const dir of FOUR_DIRS) {
        const next = step(rows, cols, r, c, dir);
        if (!next) {
          checks.push({ from: item.id, dir, result: "out" });
          continue;
        }
        const result = bfs.has(next.id)
          ? "visited"
          : cells[next.r][next.c] === original
            ? "added"
            : "blocked";
        checks.push({ from: item.id, to: next.id, dir, result });
        if (result === "added") {
          cells[next.r][next.c] = color;
          bfs.enqueue(next.id, item.level + 1);
          added.push(`(${next.r},${next.c})`);
        }
      }
      const dead = added.length === 0 && checks.some((ch) => ch.result === "blocked");
      bfs.record(
        {
          kind: added.length > 0 ? "spread" : "dead-end",
          key: first || (dead && firstDead),
          note:
            added.length > 0
              ? `Take (${r},${c}) off the front. ${added.join(" and ")} ${added.length === 1 ? "has" : "have"} color ${original}: paint and queue ${added.length === 1 ? "it" : "them"}.`
              : `Take (${r},${c}) off the front. Its neighbors are another color, already painted, or off the picture: nothing to add.`,
        },
        { current: item.id, checks, cells },
      );
      first = false;
      if (dead) firstDead = false;
    }
    bfs.record(
      {
        kind: "done",
        key: true,
        note: `The queue is empty: every pixel connected to (${sr},${sc}) with color ${original} is now ${color}.`,
      },
      { cells },
    );
  }

  return {
    problem: "graphs-bfs/flood-fill",
    row: { values: image.flat(), display: "grid" },
    grid: { rows, cols, cells: image.map((row) => [...row]), legend },
    pointerNames: [],
    steps: bfs.steps,
    answer: cells,
    answerDisplay: `[${cells.map((row) => `[${row.join(", ")}]`).join(", ")}]`,
  };
}

export const floodFillTrace: TraceDefinition<[number[][], number, number, number]> = {
  problem: "graphs-bfs/flood-fill",
  exampleIndex: 0,
  exampleSource: "problem-native",
  args: z
    .tuple([gridOf(9), z.number().int().min(0), z.number().int().min(0), z.number().int().min(0).max(9)])
    .refine(([g, r, c]) => r < g.length && c < g[0].length, "the clicked pixel is outside the picture"),
  run: floodFill,
};
