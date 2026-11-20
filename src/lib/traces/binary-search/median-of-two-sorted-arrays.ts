import { z } from "zod";

import { compare, type Trace, type TraceDefinition, type TraceEquation, type TraceStep } from "../types";
import { sortedNums } from "./shared";

const check = (value: number, against: number, ok: boolean): TraceEquation => ({
  terms: [value],
  operator: "+",
  result: value,
  comparison: { op: compare(value, against), target: against },
  // "Fits" is good news whether the sign is < or =; a value bigger than the other side's next one is a misplaced cut.
  tone: ok ? "positive" : "negative",
});

/**
 * Cut both lists so the left sides together hold half of all the values (the extra one when the total is odd). The
 * cut is right when everything on the left is no bigger than everything on the right, and since each list is
 * sorted that's two checks: A's last-left ≤ B's first-right and B's last-left ≤ A's first-right. Binary search
 * picks A's cut (A is the shorter list); B's cut follows. A failed check says which way to move. Once both pass,
 * the median is the biggest left value (odd total) or that averaged with the smallest right value (even).
 * Key steps: every cut tried, both checks on the right cut, and the result.
 */
export function medianOfTwoSortedArrays(nums1: number[], nums2: number[]): Trace {
  const [a, b] = nums1.length <= nums2.length ? [nums1, nums2] : [nums2, nums1];
  const m = a.length;
  const total = m + b.length;
  const half = Math.floor((total + 1) / 2);
  const steps: TraceStep[] = [];
  let low = 0;
  let high = m;
  steps.push({
    kind: "start",
    key: false,
    pointers: {},
    note: `${total} values in all, so the left sides must hold ${half}. A's cut can go anywhere from 0 to ${m} values in; B's cut makes up the rest.`,
  });

  let answer = 0;
  while (low <= high) {
    const i = Math.floor((low + high) / 2);
    const j = half - i;
    const left1 = i > 0 ? a[i - 1] : undefined;
    const right1 = i < m ? a[i] : undefined;
    const left2 = j > 0 ? b[j - 1] : undefined;
    const right2 = j < b.length ? b[j] : undefined;
    const cuts = { first: i, second: j };
    const where = `A after ${i} value${i === 1 ? "" : "s"}, B after ${j}`;
    const firstOk = left1 === undefined || right2 === undefined || left1 <= right2;
    const secondOk = left2 === undefined || right1 === undefined || left2 <= right1;

    if (firstOk && secondOk) {
      steps.push({
        kind: "check-a",
        key: true,
        pointers: {},
        cuts,
        ...(left1 !== undefined && right2 !== undefined ? { equation: check(left1, right2, true) } : {}),
        note:
          left1 !== undefined && right2 !== undefined
            ? `Cut ${where}. A's left side ends with ${left1}, and B's right side starts with ${right2}: ${left1} ≤ ${right2}, so that side fits.`
            : `Cut ${where}. ${left1 === undefined ? "A has nothing on its left" : "B has nothing on its right"}, so that side fits.`,
      });
      steps.push({
        kind: "check-b",
        key: true,
        pointers: {},
        cuts,
        ...(left2 !== undefined && right1 !== undefined ? { equation: check(left2, right1, true) } : {}),
        note:
          left2 !== undefined && right1 !== undefined
            ? `B's left side ends with ${left2}, and A's right side starts with ${right1}: ${left2} ≤ ${right1}, so this side fits too. The cut is right.`
            : `${left2 === undefined ? "B has nothing on its left" : "A has nothing on its right"}, so this side fits too. The cut is right.`,
      });
      const leftMax = Math.max(...[left1, left2].filter((v): v is number => v !== undefined));
      const rightMin = Math.min(...[right1, right2].filter((v): v is number => v !== undefined));
      answer = total % 2 === 1 ? leftMax : (leftMax + rightMin) / 2;
      steps.push({
        kind: "done",
        key: true,
        pointers: {},
        cuts,
        note:
          total % 2 === 1
            ? `${total} values is odd, so the median is the biggest value on the left: ${answer}.`
            : `${total} values is even, so the median is the average of the biggest left value and the smallest right value: (${leftMax} + ${rightMin}) / 2 = ${answer}.`,
      });
      break;
    }

    if (!firstOk) {
      high = i - 1;
      steps.push({
        kind: "move-left",
        key: true,
        pointers: {},
        cuts,
        equation: check(left1!, right2!, false),
        note: `Cut ${where}. A's left side ends with ${left1}, but B's right side starts with ${right2}: ${left1} > ${right2}, so A's cut is too far right. Move it left.`,
      });
    } else {
      low = i + 1;
      steps.push({
        kind: "move-right",
        key: true,
        pointers: {},
        cuts,
        equation: check(left2!, right1!, false),
        note: `Cut ${where}. B's left side ends with ${left2}, but A's right side starts with ${right1}: ${left2} > ${right1}, so A's cut is too far left. Move it right.`,
      });
    }
  }

  return {
    problem: "binary-search/median-of-two-sorted-arrays",
    row: { values: a, display: "cards" },
    secondRow: { values: b },
    pointerNames: [],
    steps,
    answer,
    answerDisplay: String(answer),
  };
}

export const medianOfTwoSortedArraysTrace: TraceDefinition<[number[], number[]]> = {
  problem: "binary-search/median-of-two-sorted-arrays",
  exampleIndex: 0,
  exampleSource: "analogy",
  // Both lists on screen, one row each; the video needs a value on each side.
  args: z.tuple([sortedNums(6), sortedNums(6)]),
  run: medianOfTwoSortedArrays,
};
