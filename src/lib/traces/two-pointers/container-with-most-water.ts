import { z } from "zod";

import { compare, type Trace, type TraceDefinition, type TraceStep } from "../types";

/**
 * Start with the widest container; the shorter wall limits it, so moving the taller wall can only make things
 * worse. Always move the shorter wall inward. Key steps: every new best, the first non-improving step, the result.
 */
export function containerWithMostWater(heights: number[]): Trace {
  const steps: TraceStep[] = [];
  let left = 0;
  let right = heights.length - 1;
  let best = 0;
  let bestPair: [number, number] = [0, heights.length - 1];
  let sawWorse = false;

  while (left < right) {
    const width = right - left;
    const height = Math.min(heights[left], heights[right]);
    const area = width * height;
    const op = compare(area, best);
    const improved = op === ">";
    const moveLeft = heights[left] < heights[right];
    steps.push({
      kind: moveLeft ? "move-left" : "move-right",
      key: improved || !sawWorse,
      pointers: { left, right },
      equation: {
        terms: [width, height],
        operator: "×",
        result: area,
        comparison: { op, target: best },
        // Beating the best is good news even though the sign is ">"; falling short is just information.
        tone: improved ? "positive" : "neutral",
      },
      active: [left, right],
      fill: { from: left, to: right, level: height },
      note:
        `Walls ${heights[left]} and ${heights[right]}, ${width} apart: ${width} × ${height} = ${area}` +
        (improved ? `, a new best (was ${best}). ` : `, not better than ${best}. `) +
        (moveLeft
          ? `The left wall (${heights[left]}) is shorter, so move left inward.`
          : `The right wall (${heights[right]}) is not taller, so move right inward.`),
    });
    if (!improved) sawWorse = true;
    if (improved) {
      best = area;
      bestPair = [left, right];
    }
    if (moveLeft) left++;
    else right--;
  }

  steps.push({
    kind: "done",
    key: true,
    pointers: { left, right },
    found: bestPair,
    fill: { from: bestPair[0], to: bestPair[1], level: Math.min(heights[bestPair[0]], heights[bestPair[1]]) },
    note: `The pointers met. The best container used walls ${bestPair[0]} and ${bestPair[1]} and holds ${best}.`,
  });

  return {
    problem: "two-pointers/container-with-most-water",
    row: { values: heights, display: "bars" },
    pointerNames: ["left", "right"],
    steps,
    answer: best,
    answerDisplay: String(best),
  };
}

export const containerWithMostWaterTrace: TraceDefinition<[number[]]> = {
  problem: "two-pointers/container-with-most-water",
  exampleIndex: 0,
  exampleSource: "analogy",
  args: z.tuple([z.array(z.number().int().nonnegative()).min(2).max(12)]),
  run: containerWithMostWater,
};
