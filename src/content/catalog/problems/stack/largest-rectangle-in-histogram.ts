import { defineProblem } from "@/lib/catalog";

export const largestRectangleInHistogram = defineProblem({
  slug: "largest-rectangle-in-histogram",
  patternSlug: "stack",
  title: "Largest Rectangle in Histogram",
  difficulty: "hard",
  order: 4,
  statement: `A bar chart has bars of width 1 standing side by side, and \`heights[i]\` is the height of bar \`i\`. You want to draw one axis-aligned rectangle that lies entirely inside the bars: it spans a run of adjacent bars and can be no taller than the shortest bar in that run.

Return the largest possible area of such a rectangle.`,
  examples: [
    {
      input: "heights = [2, 4, 3, 3, 1]",
      output: "9",
      explanation: "Bars 1–3 are all at least 3 tall, giving 3 × 3 = 9. Bars 0–3 give only 4 × 2 = 8.",
      args: [[2, 4, 3, 3, 1]],
      expected: 9,
    },
    {
      input: "heights = [3, 1, 4, 4, 2]",
      output: "8",
      explanation: "The two bars of height 4 make a 2 × 4 rectangle.",
      args: [[3, 1, 4, 4, 2]],
      expected: 8,
    },
    {
      input: "heights = [5]",
      output: "5",
      explanation: "A single bar is its own rectangle.",
      args: [[5]],
      expected: 5,
    },
  ],
  constraints: ["1 ≤ heights.length ≤ 10⁵", "0 ≤ heights[i] ≤ 10⁴"],
  hints: [
    "The best rectangle is limited by its shortest bar. For each bar, imagine it as that shortest bar: how far can the rectangle stretch?",
    "A bar's rectangle stretches left and right until it hits a strictly shorter bar on each side. Finding the nearest shorter bar for everything is a next-smaller-element problem.",
    "Keep a stack of indices with increasing heights. When a shorter bar arrives, pop taller bars: each popped bar's width runs from just after the new top of the stack to just before the current index. Flush the stack at the end with a height-0 sentinel.",
  ],
  keyIdea:
    "Every maximal rectangle is as tall as some bar and extends until a shorter bar blocks it on each side. A stack of indices with increasing heights finds both blockers: when a shorter bar arrives, each popped bar's right limit is the current index and its left limit is the new stack top. Each bar is pushed and popped once, so the scan is linear.",
  complexity: { time: "O(n)", space: "O(n)" },
  tags: ["array", "monotonic stack"],
  externalRefs: [
    {
      label: "LeetCode 84",
      url: "https://leetcode.com/problems/largest-rectangle-in-histogram/",
    },
  ],
});
