import type { TraceCell, TraceTable } from "../types";

/** A DP table the traces fill cell by cell, snapshotting it for each step. */
export class Table {
  readonly cells: (number | string | null)[][];

  constructor(rows: number, cols: number) {
    this.cells = Array.from({ length: rows }, () => new Array<number | string | null>(cols).fill(null));
  }

  get(r: number, c: number): number {
    return this.cells[r][c] as number;
  }

  set(r: number, c: number, value: number | string) {
    this.cells[r][c] = value;
  }

  /** The table now, with this step's cell, reads, and winning option. */
  snapshot(extra: Omit<TraceTable, "cells"> = {}): TraceTable {
    return { cells: this.cells.map((row) => [...row]), ...extra };
  }
}

export const cell = (r: number, c: number): TraceCell => [r, c];
