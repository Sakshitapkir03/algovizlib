import { z } from "zod";

import type { Trace, TraceDefinition, TraceStep } from "../types";
import { Pile } from "./shared";

/**
 * Keep bars on a stack with heights rising from bottom to top (an increasing monotonic stack). A shorter bar pops
 * every bar at least as tall: the popped bar's widest rectangle at its own height runs from just past the bar below it
 * on the stack to just before the new bar (shaded on the chart). Its area, height × width, is compared with the best
 * so far: a new best is good news, a smaller area neutral. A 0 after the last bar flushes the stack. The shaded
 * rectangle is the popped bar's answer, so no link is drawn. Key steps: a second bar rising, the first pop, every new
 * best, the first area that isn't better, and the answer.
 */
export function largestRectangle(heights: number[]): Trace {
  const pile = new Pile("increasing");
  const steps: TraceStep[] = [];
  let best = 0;
  let firstPop = true;
  let firstWorse = true;
  for (let i = 0; i <= heights.length; i++) {
    const h = i === heights.length ? 0 : heights[i];
    while (pile.size > 0 && heights[pile.top()!.ref!] >= h) {
      const bar = pile.pop().ref!;
      const height = heights[bar];
      const left = pile.size > 0 ? pile.top()!.ref! : -1;
      const width = i - left - 1;
      const area = height * width;
      const before = best;
      const better = area > best;
      best = Math.max(best, area);
      const worse = !better && firstWorse;
      if (worse) firstWorse = false;
      steps.push({
        kind: "pop",
        key: firstPop || better || worse,
        pointers: i < heights.length ? { i } : {},
        note: `${i === heights.length ? "The end (height 0)" : `Bar ${i} (${h})`} is no taller than bar ${bar} (${height}): pop bar ${bar}. Its rectangle spans bars ${left + 1}–${i - 1}: ${height} × ${width} = ${area}${better ? `, a new best${before ? ` (was ${before})` : ""}` : `, not more than ${best}`}.`,
        equation: {
          terms: [height, width],
          operator: "×",
          result: area,
          comparison: { op: area < before ? "<" : area > before ? ">" : "=", target: before },
          tone: better ? "positive" : "neutral",
        },
        fill: { from: left + 1, to: i - 1, level: height, cover: true, label: `${area}` },
        counter: { value: best, ...(better && before > 0 ? { delta: area - before } : {}) },
        pile: pile.snapshot(),
      });
      firstPop = false;
    }
    if (i === heights.length) break;
    pile.push({ label: String(h), ref: i, key: h });
    steps.push({
      kind: "push",
      key: i === 1,
      pointers: { i },
      active: [i],
      note: `Bar ${i} (${h}) is taller than everything left on the stack: push it. Heights still rise bottom to top.`,
      ...(best ? { counter: { value: best } } : {}),
      pile: pile.snapshot(),
    });
  }
  steps.push({
    kind: "done",
    key: true,
    pointers: {},
    note: `Every bar has been popped once: the largest rectangle has area ${best}.`,
    counter: { value: best },
    pile: pile.snapshot(),
  });
  return {
    problem: "stack/largest-rectangle-in-histogram",
    row: { values: heights, display: "bars" },
    pointerNames: ["i"],
    steps,
    answer: best,
    answerDisplay: String(best),
  };
}

export const largestRectangleInHistogramTrace: TraceDefinition<[number[]]> = {
  problem: "stack/largest-rectangle-in-histogram",
  exampleIndex: 0,
  exampleSource: "analogy",
  args: z.tuple([z.array(z.number().int().min(0).max(20)).min(1).max(7)]),
  run: largestRectangle,
};
