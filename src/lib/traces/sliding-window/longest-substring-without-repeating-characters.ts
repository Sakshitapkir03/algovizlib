import { z } from "zod";

import { compare, type Trace, type TraceDefinition, type TraceStep } from "../types";

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, k) => from + k);

/**
 * Grow the window one character at a time. When the new character is already inside, move the left edge just past
 * its earlier copy, so the window never holds a repeat. Key steps: the window reaching 3, every repeat that forces a
 * shrink, every new best from then on, and the result.
 */
export function longestSubstringWithoutRepeatingCharacters(s: string): Trace {
  const chars = [...s];
  const steps: TraceStep[] = [];
  const lastSeen = new Map<string, number>();
  let left = 0;
  let best = 0;
  let bestFrom = 0;
  let shrunk = false;

  chars.forEach((ch, right) => {
    const previous = lastSeen.get(ch);
    const repeat = previous !== undefined && previous >= left;
    const dropped = repeat ? range(left, previous) : [];
    if (repeat) left = previous + 1;
    lastSeen.set(ch, right);
    const length = right - left + 1;
    const op = compare(length, best);
    const improved = op === ">";
    steps.push({
      kind: repeat ? "shrink" : "grow",
      key: repeat || (improved && (shrunk || length === 3)),
      pointers: { left, right },
      active: [right],
      ...(repeat ? { rejected: dropped } : {}),
      window: { from: left, to: right, value: length },
      equation: {
        terms: [length],
        operator: "+",
        result: length,
        comparison: { op, target: best },
        // A longer window is good news even though the sign is ">".
        tone: improved ? "positive" : "neutral",
      },
      note: repeat
        ? `"${ch}" is already in the window (at ${previous}), so move left past it to ${left}, dropping ${dropped.length === 1 ? `position ${dropped[0]}` : `positions ${dropped[0]}–${dropped.at(-1)}`}. The window is ${length} long.`
        : `"${ch}" is new to the window, so it grows to ${length}` +
          (improved ? `, the longest so far.` : `, not longer than ${best}.`),
    });
    if (repeat) shrunk = true;
    if (improved) {
      best = length;
      bestFrom = left;
    }
  });

  const last = Math.max(0, chars.length - 1);
  steps.push({
    kind: "done",
    key: true,
    pointers: { left: bestFrom, right: bestFrom + Math.max(0, best - 1) },
    ...(best > 0 ? { found: range(bestFrom, bestFrom + best - 1) } : {}),
    window: { from: bestFrom, to: bestFrom + best - 1, value: best },
    note:
      best > 0
        ? `The right edge reached the end (position ${last}). The longest window without a repeat is "${chars.slice(bestFrom, bestFrom + best).join("")}", ${best} long.`
        : "The string is empty, so the answer is 0.",
  });

  return {
    problem: "sliding-window/longest-substring-without-repeating-characters",
    row: { values: chars, display: "cards" },
    pointerNames: ["left", "right"],
    steps,
    answer: best,
    answerDisplay: String(best),
  };
}

export const longestSubstringWithoutRepeatingCharactersTrace: TraceDefinition<[string]> = {
  problem: "sliding-window/longest-substring-without-repeating-characters",
  exampleIndex: 0,
  exampleSource: "analogy",
  args: z.tuple([z.string().min(1).max(10)]),
  run: longestSubstringWithoutRepeatingCharacters,
};
