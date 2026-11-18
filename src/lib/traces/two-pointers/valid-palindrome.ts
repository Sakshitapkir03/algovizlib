import { z } from "zod";

import { sortedIndices, type Trace, type TraceDefinition, type TraceStep } from "../types";

const isAlphanumeric = (ch: string) => /^[a-z0-9]$/i.test(ch);

/**
 * Walk inward from both ends, skipping characters that aren't letters or digits, and compare the rest
 * case-insensitively. Key steps: the first skip, the first match, any mismatch, and the verdict.
 */
export function validPalindrome(s: string): Trace {
  const chars = [...s];
  const steps: TraceStep[] = [];
  const skipped = new Set<number>();
  let left = 0;
  let right = chars.length - 1;
  let sawSkip = false;
  let sawMatch = false;
  let verdict = true;

  const ruledOut = () => (skipped.size > 0 ? { rejected: sortedIndices(skipped) } : {});
  const show = (ch: string) => (ch === " " ? "a space" : `"${ch}"`);

  while (left < right) {
    if (!isAlphanumeric(chars[left])) {
      steps.push({
        kind: "skip-left",
        key: !sawSkip,
        pointers: { left, right },
        active: [left],
        ...ruledOut(),
        note: `s[${left}] is ${show(chars[left])}, not a letter or digit, so skip it and move left right.`,
      });
      sawSkip = true;
      skipped.add(left);
      left++;
    } else if (!isAlphanumeric(chars[right])) {
      steps.push({
        kind: "skip-right",
        key: !sawSkip,
        pointers: { left, right },
        active: [right],
        ...ruledOut(),
        note: `s[${right}] is ${show(chars[right])}, not a letter or digit, so skip it and move right left.`,
      });
      sawSkip = true;
      skipped.add(right);
      right--;
    } else if (chars[left].toLowerCase() === chars[right].toLowerCase()) {
      steps.push({
        kind: "match",
        key: !sawMatch,
        pointers: { left, right },
        active: [left, right],
        ...ruledOut(),
        note: `"${chars[left]}" and "${chars[right]}" match (ignoring case), so move both pointers inward.`,
      });
      sawMatch = true;
      left++;
      right--;
    } else {
      steps.push({
        kind: "mismatch",
        key: true,
        pointers: { left, right },
        active: [left, right],
        ...ruledOut(),
        note: `"${chars[left]}" and "${chars[right]}" differ, so the string can't be a palindrome.`,
      });
      verdict = false;
      break;
    }
  }

  steps.push({
    kind: "done",
    key: true,
    pointers: { left, right },
    ...ruledOut(),
    note: verdict
      ? "The pointers met without a mismatch, so the string reads the same both ways: true."
      : "A mismatch was found: false.",
  });

  return {
    problem: "two-pointers/valid-palindrome",
    row: { values: chars, display: "cards" },
    pointerNames: ["left", "right"],
    steps,
    answer: verdict,
    answerDisplay: String(verdict),
  };
}

export const validPalindromeTrace: TraceDefinition<[string]> = {
  problem: "two-pointers/valid-palindrome",
  // "Taco cat!": short enough to show every card, with a skip on each pass.
  exampleIndex: 3,
  exampleSource: "analogy",
  args: z.tuple([z.string().min(1).max(14)]),
  run: validPalindrome,
};
