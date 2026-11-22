import { z } from "zod";

import { RecordedMap } from "../arrays-hashing/shared";
import type { Trace, TraceDefinition, TracePrefixGrid, TraceRect, TraceStep } from "../types";

type Signed = TracePrefixGrid["rects"][number];

/**
 * First the 2D prefix grid, by inclusion-exclusion: prefix[i][j] (the rectangle from the top-left corner to cell
 * (i − 1, j − 1)) = that cell + the rectangle above + the rectangle to the left − their overlap, counted twice. Then,
 * for each pair of rows r1…r2, the strip from column 0 to c is one subtraction, prefix[r2 + 1][c + 1] − prefix[r1][c + 1],
 * and a rectangle c1…c of that strip sums to the target exactly when an earlier strip prefix equals (this one −
 * target): the 1D prefix-sum-and-map trick, with a map per row pair seeded {0: 1}. Not found is neutral, found
 * positive. Key steps: the last prefix cell built (the full inclusion-exclusion), the first two-row strip, every
 * rectangle found, and the last strip.
 */
export function submatricesThatSumToTarget(matrix: number[][], target: number): Trace {
  const rows = matrix.length;
  const cols = matrix[0].length;
  const prefix: (number | null)[][] = Array.from({ length: rows + 1 }, (_, i) =>
    Array.from({ length: cols + 1 }, (_, j) => (i === 0 || j === 0 ? 0 : null)),
  );
  const P = (i: number, j: number) => prefix[i][j] as number;
  const rect = (r1: number, c1: number, r2: number, c2: number, sign: "+" | "−"): Signed[] =>
    r1 <= r2 && c1 <= c2 ? [{ r1, c1, r2, c2, sign }] : [];
  const steps: TraceStep[] = [];
  const grid = (g: Omit<TracePrefixGrid, "prefix">): TracePrefixGrid => ({
    prefix: prefix.map((row) => [...row]),
    ...g,
  });

  for (let i = 1; i <= rows; i++)
    for (let j = 1; j <= cols; j++) {
      const m = matrix[i - 1][j - 1];
      prefix[i][j] = m + P(i - 1, j) + P(i, j - 1) - P(i - 1, j - 1);
      const last = i === rows && j === cols;
      steps.push({
        kind: "build",
        key: last,
        pointers: {},
        note: `prefix[${i}][${j}] = ${m} + ${P(i - 1, j)} (above) + ${P(i, j - 1)} (left) − ${P(i - 1, j - 1)} (counted twice) = ${P(i, j)}.`,
        prefixGrid: grid({
          current: [i, j],
          rects: [
            ...rect(i - 1, j - 1, i - 1, j - 1, "+"),
            ...rect(0, 0, i - 2, j - 1, "+"),
            ...rect(0, 0, i - 1, j - 2, "+"),
            ...rect(0, 0, i - 2, j - 2, "−"),
          ],
          marks: [
            ...(i > 1 ? [{ at: [i - 1, j] as [number, number], sign: "+" as const }] : []),
            ...(j > 1 ? [{ at: [i, j - 1] as [number, number], sign: "+" as const }] : []),
            ...(i > 1 && j > 1 ? [{ at: [i - 1, j - 1] as [number, number], sign: "−" as const }] : []),
          ],
        }),
      });
    }

  let count = 0;
  let firstTall = true;
  for (let r1 = 0; r1 < rows; r1++)
    for (let r2 = r1; r2 < rows; r2++) {
      const seen = new RecordedMap("map", "cells");
      seen.set(0, 1);
      // Strip prefixes by column, with the empty strip (before column 0) as 0.
      const strip: number[] = [0];
      for (let c = 0; c < cols; c++) {
        const cur = P(r2 + 1, c + 1) - P(r1, c + 1);
        strip.push(cur);
        const need = cur - target;
        const hits = Number(seen.get(need) ?? 0);
        count += hits;
        let start = -1;
        for (let x = c; x >= 0; x--)
          if (strip[x] === need) {
            start = x;
            break;
          }
        seen.set(cur, Number(seen.get(cur) ?? 0) + 1);
        const map = seen.snapshot();
        map.lookup = { key: String(need), found: hits > 0 };
        const tall = r2 > r1 && firstTall;
        if (tall) firstTall = false;
        const found: TraceRect | undefined = hits > 0 ? { r1, c1: start, r2, c2: c } : undefined;
        const last = r1 === rows - 1 && c === cols - 1;
        steps.push({
          kind: hits > 0 ? "found" : "strip",
          key: hits > 0 || tall || last,
          pointers: {},
          note: `Rows ${r1}–${r2}, columns 0–${c}: prefix[${r2 + 1}][${c + 1}] − prefix[${r1}][${c + 1}] = ${P(r2 + 1, c + 1)} − ${P(r1, c + 1)} = ${cur}. ${
            hits > 0
              ? `${cur} − ${target} = ${need} was seen: ${hits} rectangle${hits === 1 ? "" : "s"} here sum to ${target} (count ${count}).`
              : `${cur} − ${target} = ${need} hasn't been seen in this strip.`
          }`,
          equation: {
            terms: [P(r2 + 1, c + 1), P(r1, c + 1)],
            operator: "-",
            result: cur,
            tone: hits > 0 ? "positive" : "neutral",
          },
          prefixGrid: grid({
            current: [r2 + 1, c + 1],
            rects: [...rect(0, 0, r2, c, "+"), ...rect(0, 0, r1 - 1, c, "−")],
            marks: [
              { at: [r2 + 1, c + 1], sign: "+" },
              ...(r1 > 0 ? [{ at: [r1, c + 1] as [number, number], sign: "−" as const }] : []),
            ],
            ...(found ? { found } : {}),
          }),
          map,
          counter: { value: count, delta: hits },
        });
      }
    }
  return {
    problem: "prefix-sum/submatrices-that-sum-to-target",
    row: { values: [], display: "cards" },
    matrix: matrix.map((row) => [...row]),
    pointerNames: [],
    steps,
    answer: count,
    answerDisplay: String(count),
  };
}

export const submatricesThatSumToTargetTrace: TraceDefinition<[number[][], number]> = {
  problem: "prefix-sum/submatrices-that-sum-to-target",
  exampleIndex: 0,
  exampleSource: "analogy",
  // Two rows of up to three cells: the matrix and its prefix grid fit side by side on a phone.
  args: z
    .tuple([
      z
        .array(z.array(z.number().int().min(-9).max(9)).min(1).max(3))
        .min(1)
        .max(2),
      z.number().int().min(-50).max(50),
    ])
    .refine(([m]) => m.every((row) => row.length === m[0].length), "every row has the same length"),
  run: submatricesThatSumToTarget,
};
