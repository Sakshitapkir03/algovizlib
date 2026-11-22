import { z } from "zod";

import type { Trace, TraceDefinition, TraceStep } from "../types";
import { Search } from "./shared";

/**
 * Place one queen per row, top to bottom. In each row, the squares an earlier queen attacks (same column or diagonal)
 * are cut at once, as one pruned branch ("3 attacked"); each safe square is tried in turn. A row with no safe square is
 * a dead end: undo the queen above and try its next square. A queen in the last row completes a board. The board shows
 * queens, the squares they attack, and the square being tried. Key steps: the first queen, the first pruned squares,
 * the first dead end, the undo out of it, the first board found, and the end.
 */
export function nQueens(n: number): Trace {
  const search = new Search("∅");
  const cols: number[] = [];
  const boards: string[][] = [];
  let firstPrune = true;
  let firstDead = true;
  let firstUndoAfterDead = false;
  const shown = { undo: false };
  const attacked = (row: number, col: number) =>
    cols.some((c, r) => c === col || Math.abs(c - col) === row - r);
  /** The board: queens, squares the queens attack in rows below them, free squares. */
  const board = () =>
    Array.from({ length: n }, (_, r) =>
      Array.from({ length: n }, (_, c) =>
        cols[r] === c
          ? "Q"
          : r >= cols.length && cols.some((qc, qr) => qc === c || Math.abs(qc - c) === r - qr)
            ? "x"
            : ".",
      ),
    );
  const record = (
    step: Omit<TraceStep, "pointers" | "explore" | "partial" | "cells" | "bfs">,
    tried?: number,
  ) => {
    search.record(step);
    const last = search.steps.at(-1)!;
    last.cells = board();
    last.bfs = { ...(tried !== undefined ? { current: tried } : {}), visited: [], frontier: [] };
  };

  const place = (row: number) => {
    if (row === n) {
      const rows = cols.map((c) => ".".repeat(c) + "Q" + ".".repeat(n - c - 1));
      boards.push(rows);
      search.solve(`board ${boards.length}`);
      record({
        kind: "solution",
        key: boards.length === 1,
        note: `A queen in every row and none attack each other: board ${boards.length} found.`,
      });
      return;
    }
    const blocked = Array.from({ length: n }, (_, c) => c).filter((c) => attacked(row, c));
    if (blocked.length > 0) {
      // The node already names the column: no edge label.
      search.prune("", `${blocked.length} attacked`);
      const dead = blocked.length === n;
      record({
        kind: dead ? "dead-end" : "prune",
        key: (dead && firstDead) || (!dead && firstPrune),
        note: dead
          ? `Row ${row}: every square is attacked by the queens above. Dead end.`
          : `Row ${row}: ${blocked.length === 1 ? "column" : "columns"} ${blocked.join(", ")} ${blocked.length === 1 ? "is" : "are"} attacked, so ${blocked.length === 1 ? "that square is" : "those squares are"} never tried.`,
      });
      if (dead) {
        firstUndoAfterDead = firstDead;
        firstDead = false;
      } else firstPrune = false;
    }
    for (let col = 0; col < n; col++) {
      if (blocked.includes(col)) continue;
      cols.push(col);
      search.choose(`c${col}`, "", `r${row}c${col}`);
      record(
        {
          kind: "place",
          key: row === 0 && col === 0,
          note: `Row ${row}: column ${col} is safe. Place a queen there.`,
        },
        row * n + col,
      );
      place(row + 1);
      cols.pop();
      search.undo();
      const key = firstUndoAfterDead && !shown.undo;
      if (key) shown.undo = true;
      record({
        kind: "undo",
        key,
        note: `Undo: lift the queen from row ${row}, column ${col}, and try the next square in that row.`,
      });
      firstUndoAfterDead = false;
    }
  };
  place(0);
  record({
    kind: "done",
    key: true,
    note: `Every square of the first row was tried: ${boards.length} ${boards.length === 1 ? "board" : "boards"}.`,
  });
  return {
    problem: "backtracking/n-queens",
    row: { values: Array.from({ length: n * n }, () => "."), display: "grid" },
    grid: {
      rows: n,
      cols: n,
      cells: Array.from({ length: n }, () => Array.from({ length: n }, () => ".")),
      legend: [
        { value: "Q", glyph: "♛", word: "queen", tone: "mark" },
        { value: "x", glyph: "×", word: "attacked", tone: "wall" },
        { value: ".", glyph: "", word: "free", tone: "plain" },
      ],
    },
    searchTree: { nodes: search.nodes },
    pointerNames: [],
    steps: search.steps,
    answer: boards,
    answerDisplay: `${boards.length} ${boards.length === 1 ? "board" : "boards"}`,
  };
}

export const nQueensTrace: TraceDefinition<[number]> = {
  problem: "backtracking/n-queens",
  exampleIndex: 0,
  exampleSource: "problem-native",
  args: z.tuple([z.number().int().min(1).max(4)]),
  run: nQueens,
};
