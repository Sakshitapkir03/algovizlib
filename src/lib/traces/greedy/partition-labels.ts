import { z } from "zod";

import { RecordedMap } from "../arrays-hashing/shared";
import type { Trace, TraceDefinition, TraceStep } from "../types";

/**
 * First record every letter's last position. Then scan: the open piece must reach the last position of every letter
 * in it, so each letter may stretch its end (`end = max(end, last[c])`). When the scan reaches the end, every letter
 * inside has made its last appearance and nothing ahead can pull the piece longer: cut there, as early as possible,
 * which gives the most pieces. Key steps: the first letter, every stretch, and every cut.
 */
export function partitionLabels(s: string): Trace {
  const last = new Map<string, number>();
  for (let i = 0; i < s.length; i++) last.set(s[i], i);
  const map = new RecordedMap("map", "cells");
  for (const [letter, at] of last) map.set(letter, String(at));
  // The map is built before the scan: no step shows the inserts.
  map.snapshot();
  const steps: TraceStep[] = [];
  const pieces: { from: number; to: number }[] = [];
  const sizes: number[] = [];
  let start = 0;
  let end = -1;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    const at = last.get(c)!;
    map.get(c);
    // A new piece could end right here; inside a piece, at its current end.
    const before = Math.max(end, i);
    end = Math.max(before, at);
    const stretched = end > before;
    const cut = i === end;
    if (cut) {
      pieces.push({ from: start, to: i });
      sizes.push(i - start + 1);
    }
    steps.push({
      kind: cut ? "cut" : stretched ? "stretch" : "inside",
      key: i === 0 || stretched || cut,
      pointers: { i },
      active: [i],
      ...(cut ? { found: Array.from({ length: i - start + 1 }, (_, k) => start + k) } : {}),
      note: cut
        ? `"${c}" last appears here, and so has every letter in ${start}–${i}: nothing ahead belongs in this piece. Cut after ${i} (length ${i - start + 1}).`
        : stretched
          ? `"${c}" appears again at ${at}, so this piece must reach ${at}: its end moves from ${before} to ${end}.`
          : `"${c}" last appears at ${at}, already inside the piece (it ends at ${end}): nothing changes.`,
      map: map.snapshot(),
      choice: cut
        ? { chosen: `cut after ${i}`, rejected: "keep going" }
        : stretched
          ? { chosen: `end at ${end}`, rejected: `end at ${before}` }
          : { chosen: `keep end ${end}` },
      reach: cut
        ? { from: i + 1, to: i, pieces: pieces.map((p) => ({ ...p })) }
        : {
            from: start,
            to: end,
            value: end,
            ...(at > i ? { jump: { from: i, to: at, label: `last ${c}` } } : {}),
            pieces: pieces.map((p) => ({ ...p })),
          },
    });
    if (cut) start = i + 1;
  }
  return {
    problem: "greedy/partition-labels",
    row: { values: [...s], display: "cards" },
    pointerNames: ["i"],
    steps,
    answer: sizes,
    answerDisplay: `[${sizes.join(", ")}]`,
  };
}

export const partitionLabelsTrace: TraceDefinition<[string]> = {
  problem: "greedy/partition-labels",
  exampleIndex: 0,
  exampleSource: "analogy",
  // Ten letters fit on one row; at most 8 distinct letters fit the map.
  args: z.tuple([
    z
      .string()
      .regex(/^[a-z]{1,10}$/)
      .refine((s) => new Set(s).size <= 8, "at most 8 different letters"),
  ]),
  run: partitionLabels,
};
