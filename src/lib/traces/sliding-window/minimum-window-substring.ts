import { z } from "zod";

import { compare, type Trace, type TraceDefinition, type TraceStep } from "../types";

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, k) => from + k);

/**
 * Count what t needs. Move the right edge until the window covers all of it, then move the left edge in for as long
 * as it still covers t, recording each covering window's length. Key steps: the first covering window, the first
 * drop that breaks coverage, every shorter window after the first, and the result.
 */
export function minimumWindowSubstring(s: string, t: string): Trace {
  const chars = [...s];
  const needs = new Map<string, number>();
  for (const ch of t) needs.set(ch, (needs.get(ch) ?? 0) + 1);
  const keys = [...needs.keys()].sort();
  const have = new Map(keys.map((key) => [key, 0]));
  const covered = () => keys.every((key) => have.get(key)! >= needs.get(key)!);
  const freq = (active?: string) => ({
    entries: keys.map((key) => ({ key, count: have.get(key)!, need: needs.get(key)! })),
    ...(active !== undefined && needs.has(active) ? { active } : {}),
  });
  const missingText = () =>
    keys
      .filter((key) => have.get(key)! < needs.get(key)!)
      .map((key) => `"${key}"`)
      .join(", ");

  const steps: TraceStep[] = [];
  let left = 0;
  let best = Infinity;
  let bestFrom = 0;
  let sawBreak = false;

  chars.forEach((ch, right) => {
    if (needs.has(ch)) have.set(ch, have.get(ch)! + 1);
    const done = covered();
    steps.push({
      kind: "expand",
      key: false,
      pointers: { left, right },
      active: [right],
      window: { from: left, to: right, value: right - left + 1 },
      freq: freq(ch),
      note: needs.has(ch)
        ? `Take "${ch}", one of the letters t needs.${done ? " Now the window covers t." : ` Still missing: ${missingText()}.`}`
        : `Take "${ch}"; t doesn't need it.${done ? "" : ` Still missing: ${missingText()}.`}`,
    });

    while (covered()) {
      const length = right - left + 1;
      const first = best === Infinity;
      const op = first ? undefined : compare(length, best);
      const improved = first || op === "<";
      steps.push({
        kind: "covers",
        key: improved,
        pointers: { left, right },
        found: range(left, right),
        window: { from: left, to: right, value: length },
        freq: freq(),
        equation: {
          terms: [length],
          operator: "+",
          result: length,
          // Shorter is better here, so "<" is the good news.
          ...(op ? { comparison: { op, target: best } } : {}),
          tone: improved ? "positive" : "neutral",
        },
        note: first
          ? `"${chars.slice(left, right + 1).join("")}" covers t: the first candidate, ${length} long.`
          : `"${chars.slice(left, right + 1).join("")}" covers t and is ${length} long` +
            (improved ? `, shorter than the best (${best}).` : `, not shorter than ${best}.`),
      });
      if (improved) {
        best = length;
        bestFrom = left;
      }
      const out = chars[left];
      if (needs.has(out)) have.set(out, have.get(out)! - 1);
      left++;
      const broke = !covered();
      steps.push({
        kind: broke ? "break" : "drop",
        key: broke && !sawBreak,
        pointers: { left, right },
        rejected: [left - 1],
        window: { from: left, to: right, value: right - left + 1 },
        freq: freq(out),
        note: broke
          ? `Drop "${out}" from the left. The window no longer has enough "${out}", so stop shrinking and grow again.`
          : `Drop "${out}" from the left; the window still covers t.`,
      });
      if (broke) sawBreak = true;
    }
  });

  const found = best === Infinity ? "" : chars.slice(bestFrom, bestFrom + best).join("");
  steps.push({
    kind: "done",
    key: true,
    pointers: {
      left: best === Infinity ? left : bestFrom,
      right: best === Infinity ? chars.length - 1 : bestFrom + best - 1,
    },
    ...(found ? { found: range(bestFrom, bestFrom + best - 1) } : {}),
    ...(found ? { window: { from: bestFrom, to: bestFrom + best - 1, value: best } } : {}),
    note: found
      ? `The right edge reached the end. The shortest window covering t is "${found}" (positions ${bestFrom}–${bestFrom + best - 1}).`
      : "No window covers t, so the answer is the empty string.",
  });

  return {
    problem: "sliding-window/minimum-window-substring",
    row: { values: chars, display: "cards" },
    pointerNames: ["left", "right"],
    steps,
    answer: found,
    answerDisplay: JSON.stringify(found),
    ...(found ? { answerIndices: range(bestFrom, bestFrom + best - 1) } : {}),
  };
}

export const minimumWindowSubstringTrace: TraceDefinition<[string, string]> = {
  problem: "sliding-window/minimum-window-substring",
  exampleIndex: 0,
  exampleSource: "analogy",
  args: z.tuple([
    z.string().min(1).max(10),
    z
      .string()
      .min(1)
      .max(5)
      .refine((t) => new Set(t).size <= 4, "at most 4 distinct letters (one tally cell each)"),
  ]),
  run: minimumWindowSubstring,
};
