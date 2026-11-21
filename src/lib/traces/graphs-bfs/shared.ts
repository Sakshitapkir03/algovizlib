import { z } from "zod";

import type { BfsCheck, TraceQueueItem, TraceStep, TraceValue } from "../types";
/** Grids that fit on screen (and stay readable on a phone). */
export const MAX_GRID_ROWS = 5;
export const MAX_GRID_COLS = 6;

/** A rectangular grid of whole numbers 0…max that fits on screen. */
export const gridOf = (max: number) =>
  z
    .array(z.array(z.number().int().min(0).max(max)).min(1).max(MAX_GRID_COLS))
    .min(1)
    .max(MAX_GRID_ROWS)
    .refine((g) => g.every((row) => row.length === g[0].length), "rows must have the same length");

type StepInput = Omit<TraceStep, "pointers" | "bfs" | "queue" | "cells">;

/**
 * A breadth-first search the traces drive exactly like the reference solutions: `enqueue` marks an item seen and
 * puts it at the back, `dequeue` takes the front. `record` snapshots the search (seen items, their levels, the
 * queue) with this step's running item, neighbor checks, and what entered or left the queue.
 */
export class Bfs {
  readonly steps: TraceStep[] = [];
  readonly queue: TraceQueueItem[] = [];
  private readonly seen = new Set<number>();
  private readonly levels = new Map<number, number>();
  private enqueuedNow: number[] = [];
  private dequeuedNow: TraceQueueItem | undefined;

  /** `label` names an item in the queue panel ("(1,2)", "cord"); `countLevels` records each item's level. */
  constructor(
    private readonly label: (id: number) => string,
    private readonly countLevels = true,
  ) {}

  has(id: number): boolean {
    return this.seen.has(id);
  }

  levelOf(id: number): number {
    return this.levels.get(id) ?? 0;
  }

  enqueue(id: number, level: number) {
    this.seen.add(id);
    this.levels.set(id, level);
    this.queue.push({ id, label: this.label(id), level });
    this.enqueuedNow.push(id);
  }

  dequeue(): TraceQueueItem {
    const item = this.queue.shift()!;
    this.dequeuedNow = item;
    return item;
  }

  /** Record a step: the running item, its neighbor checks, and the grid's contents if they changed. */
  record(step: StepInput, extra: { current?: number; checks?: BfsCheck[]; cells?: TraceValue[][] } = {}) {
    const sorted = [...this.seen].sort((a, b) => a - b);
    this.steps.push({
      ...step,
      pointers: {},
      ...(extra.cells ? { cells: extra.cells.map((row) => [...row]) } : {}),
      bfs: {
        ...(extra.current !== undefined ? { current: extra.current } : {}),
        visited: sorted,
        frontier: this.queue.map((item) => item.id),
        ...(this.countLevels ? { levels: sorted.map((id) => ({ id, level: this.levels.get(id)! })) } : {}),
        ...(extra.checks?.length ? { checks: extra.checks } : {}),
      },
      queue: {
        items: this.queue.map((item) => ({ ...item })),
        ...(this.dequeuedNow ? { dequeued: { ...this.dequeuedNow } } : {}),
        ...(this.enqueuedNow.length > 0 ? { enqueued: [...this.enqueuedNow] } : {}),
      },
    });
    this.enqueuedNow = [];
    this.dequeuedNow = undefined;
  }
}

/** A grid cell's id and its label in the queue. */
export const cellId = (cols: number, r: number, c: number) => r * cols + c;
export const cellLabel = (cols: number) => (id: number) => `(${Math.floor(id / cols)},${id % cols})`;

/** The four directions, in the reference solutions' order (down, up, right, left). */
export const FOUR_DIRS: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** The cell one step from (r, c) in `dir`, or undefined off the grid. */
export function step(
  rows: number,
  cols: number,
  r: number,
  c: number,
  [dr, dc]: [number, number],
): { r: number; c: number; id: number } | undefined {
  const nr = r + dr;
  const nc = c + dc;
  if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) return undefined;
  return { r: nr, c: nc, id: cellId(cols, nr, nc) };
}

/** A grid's cells as `trace.row.values`: every cell's value by id. */
export const flatten = (cells: readonly (readonly TraceValue[])[]) => cells.flat();
