import { z } from "zod";

import type { Trace, TraceDefinition, TraceStep } from "../types";

/**
 * Two pointers with a running max on each side. The side with the lower wall is settled: its water is that
 * side's max minus its height, because the other side is known to be at least as tall.
 * Key steps: the first bar, the first water on each side, the first switch of sides, the total.
 */
export function trappingRainWater(heights: number[]): Trace {
  const steps: TraceStep[] = [];
  const water = heights.map(() => 0);
  let left = 0;
  let right = heights.length - 1;
  let leftMax = 0;
  let rightMax = 0;
  let total = 0;
  let previousSide: "left" | "right" | undefined;
  const firstWater = { left: true, right: true };

  while (left < right) {
    const side = heights[left] < heights[right] ? "left" : "right";
    const index = side === "left" ? left : right;
    const height = heights[index];
    let max: number;
    if (side === "left") max = leftMax = Math.max(leftMax, height);
    else max = rightMax = Math.max(rightMax, height);
    const amount = max - height;
    water[index] = amount;
    total += amount;

    const switched = previousSide !== undefined && previousSide !== side;
    const firstOnSide = amount > 0 && firstWater[side];
    if (amount > 0) firstWater[side] = false;
    steps.push({
      kind: side === "left" ? "fill-left" : "fill-right",
      key: steps.length === 0 || firstOnSide || (switched && steps.every((s) => s.kind === steps[0].kind)),
      pointers: { left, right },
      equation: { terms: [max, height], operator: "-", result: amount },
      active: [index],
      water: [...water],
      note:
        `${side === "left" ? `Left wall ${heights[left]} < right wall ${heights[right]}` : `Right wall ${heights[right]} ≤ left wall ${heights[left]}`}, ` +
        `so settle bar ${index} on the ${side}: the ${side} max is ${max}, so it holds ${max} − ${height} = ${amount}. ` +
        `Move ${side} inward.`,
    });
    previousSide = side;
    if (side === "left") left++;
    else right--;
  }

  steps.push({
    kind: "done",
    key: true,
    pointers: { left, right },
    water: [...water],
    note: `The pointers met. Total water: ${water.join(" + ")} = ${total}.`,
  });

  return {
    problem: "two-pointers/trapping-rain-water",
    row: { values: heights, display: "bars" },
    pointerNames: ["left", "right"],
    steps,
    answer: total,
    answerDisplay: String(total),
  };
}

export const trappingRainWaterTrace: TraceDefinition<[number[]]> = {
  problem: "two-pointers/trapping-rain-water",
  exampleIndex: 0,
  exampleSource: "problem-native",
  args: z.tuple([z.array(z.number().int().nonnegative()).min(1).max(12)]),
  run: trappingRainWater,
};
