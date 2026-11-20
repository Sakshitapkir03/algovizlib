import { z } from "zod";

import { compare, type Trace, type TraceDefinition, type TraceStep } from "../types";

/**
 * Grow the window to the right. A window works if repainting everything except its most common letter takes at most
 * k changes: length − (most common count) ≤ k. When it takes more, move the left edge in until it works again. Key
 * steps: every new best from 3 on, the first window that needs too many changes, the first shrink, and the result.
 */
export function longestRepeatingCharacterReplacement(s: string, k: number): Trace {
  const chars = [...s];
  const keys = [...new Set(chars)].sort();
  const counts = new Map(keys.map((key) => [key, 0]));
  const steps: TraceStep[] = [];
  let left = 0;
  let best = 0;
  let bestFrom = 0;
  let sawOverflow = false;
  let sawShrink = false;

  const freq = (active: string) => ({
    entries: keys.map((key) => ({ key, count: counts.get(key)! })),
    active,
  });
  const most = () => Math.max(...counts.values());
  const check = (length: number) => {
    const changes = length - most();
    const op = compare(changes, k);
    return {
      changes,
      fits: op !== ">",
      equation: {
        terms: [length, most()],
        operator: "-" as const,
        result: changes,
        comparison: { op, target: k },
        // "<" and "=" both mean it fits (good news); ">" means too many changes.
        tone: op === ">" ? ("negative" as const) : ("positive" as const),
      },
    };
  };

  chars.forEach((ch, right) => {
    counts.set(ch, counts.get(ch)! + 1);
    let length = right - left + 1;
    let state = check(length);
    const improved = state.fits && length > best;
    steps.push({
      kind: state.fits ? "grow" : "too-many",
      key: (improved && length >= 3) || (!state.fits && !sawOverflow),
      pointers: { left, right },
      active: [right],
      window: { from: left, to: right, value: length },
      freq: freq(ch),
      equation: state.equation,
      note:
        `Add "${ch}": the window is ${length} long and its most common letter appears ${most() === 1 ? "once" : `${most()} times`}, so it needs ${length} − ${most()} = ${state.changes} change${state.changes === 1 ? "" : "s"}` +
        (state.fits
          ? improved
            ? ` (≤ ${k}), and it's the longest so far.`
            : ` (≤ ${k}), but it's no longer than ${best}.`
          : `, more than ${k}. Shrink from the left.`),
    });
    if (!state.fits) sawOverflow = true;
    if (improved) {
      best = length;
      bestFrom = left;
    }
    while (!state.fits) {
      const out = chars[left];
      counts.set(out, counts.get(out)! - 1);
      left++;
      length = right - left + 1;
      state = check(length);
      steps.push({
        kind: "shrink",
        key: !sawShrink,
        pointers: { left, right },
        rejected: [left - 1],
        window: { from: left, to: right, value: length },
        freq: freq(out),
        equation: state.equation,
        note:
          `Drop "${out}" from the left. Now ${length} − ${most()} = ${state.changes} change${state.changes === 1 ? "" : "s"}` +
          (state.fits ? `, which fits again.` : `, still more than ${k}.`),
      });
      sawShrink = true;
    }
  });

  steps.push({
    kind: "done",
    key: true,
    pointers: { left: bestFrom, right: bestFrom + best - 1 },
    found: Array.from({ length: best }, (_, i) => bestFrom + i),
    window: { from: bestFrom, to: bestFrom + best - 1, value: best },
    note: `The right edge reached the end. The longest window that needs at most ${k} change${k === 1 ? "" : "s"} is "${chars.slice(bestFrom, bestFrom + best).join("")}", ${best} long.`,
  });

  return {
    problem: "sliding-window/longest-repeating-character-replacement",
    row: { values: chars, display: "cards" },
    pointerNames: ["left", "right"],
    steps,
    answer: best,
    answerDisplay: String(best),
  };
}

export const longestRepeatingCharacterReplacementTrace: TraceDefinition<[string, number]> = {
  problem: "sliding-window/longest-repeating-character-replacement",
  exampleIndex: 0,
  exampleSource: "analogy",
  args: z.tuple([
    z
      .string()
      .min(1)
      .max(10)
      .refine((s) => new Set(s).size <= 5, "at most 5 distinct letters (one tally cell each)"),
    z.number().int().nonnegative(),
  ]),
  run: longestRepeatingCharacterReplacement,
};
