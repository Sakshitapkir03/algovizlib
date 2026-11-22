import { z } from "zod";

import type { Trace, TraceDefinition, TraceStep } from "../types";
import { RecordedMap } from "./shared";

/**
 * Count letters in one map: each letter of s adds 1, the letter of t at the same position takes 1 away. The words are
 * anagrams exactly when every count ends at 0 (and the lengths match). Key steps: the first three positions (a new
 * letter each, a letter both words share, letters cancelling across positions) and the final check.
 */
export function validAnagram(s: string, t: string): Trace {
  const counts = new RecordedMap("map", "cells");
  const values = new Map<string, number>();
  const steps: TraceStep[] = [];
  const bump = (ch: string, by: number) => {
    const had = counts.get(ch);
    const next = (values.get(ch) ?? 0) + by;
    values.set(ch, next);
    counts.set(ch, next);
    return had;
  };
  let answer = s.length === t.length;
  if (answer) {
    for (let i = 0; i < s.length; i++) {
      bump(s[i], 1);
      const up = values.get(s[i])!;
      counts.snapshot();
      bump(t[i], -1);
      const down = values.get(t[i])!;
      const zeroed = [...new Set([s[i], t[i]])].filter((ch) => values.get(ch) === 0);
      steps.push({
        kind: zeroed.length ? "cancel" : "count",
        // The first letters, the first match at one position, and letters cancelling across positions.
        key: i <= 2,
        pointers: { i },
        active: [i],
        note:
          s[i] === t[i]
            ? `Both words have "${s[i]}" here: +1 then −1, so "${s[i]}" stays at 0.`
            : `"${s[i]}" from the first word: +1 (now ${up}). "${t[i]}" from the second: −1 (now ${down}).${zeroed.length ? ` ${zeroed.map((c) => `"${c}"`).join(" and ")} ${zeroed.length === 1 ? "is" : "are"} back to 0: matched across positions.` : ""}`,
        map: counts.snapshot(),
      });
    }
    answer = [...values.values()].every((v) => v === 0);
  }
  steps.push({
    kind: "done",
    key: true,
    pointers: {},
    note:
      !answer && s.length !== t.length
        ? "The words have different lengths, so they can't be anagrams."
        : answer
          ? "Every letter's count is back to 0: the same letters, the same number of times. Anagrams."
          : `Some counts aren't 0: ${[...values]
              .filter(([, v]) => v !== 0)
              .map(([k, v]) => `"${k}" ${v > 0 ? "+" : ""}${v}`)
              .join(", ")}. Not anagrams.`,
    map: counts.snapshot(),
  });
  return {
    problem: "arrays-hashing/valid-anagram",
    row: { values: [...s], display: "cards" },
    secondRow: { values: [...t] },
    pointerNames: ["i"],
    steps,
    answer,
    answerDisplay: String(answer),
  };
}

export const validAnagramTrace: TraceDefinition<[string, string]> = {
  problem: "arrays-hashing/valid-anagram",
  exampleIndex: 0,
  exampleSource: "analogy",
  args: z.tuple([z.string().regex(/^[a-z]{0,7}$/), z.string().regex(/^[a-z]{0,7}$/)]),
  run: validAnagram,
};
