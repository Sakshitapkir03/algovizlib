import { defineProblem } from "@/lib/catalog";

export const containerWithMostWater = defineProblem({
  slug: "container-with-most-water",
  patternSlug: "two-pointers",
  title: "Container With Most Water",
  difficulty: "medium",
  order: 2,
  statement: `You're given an array \`heights\`. Picture a vertical wall of height \`heights[i]\` standing at position \`i\` on a flat floor. Choose two different walls; together with the floor they form a container whose water level can rise only as high as the shorter wall.

The amount of water such a container holds is the distance between the two walls times the height of the shorter one. Return the largest amount any pair of walls can hold.`,
  examples: [
    {
      input: "heights = [2, 5, 3, 8, 4, 7]",
      output: "20",
      explanation: "The walls at positions 1 and 5 are 4 apart, and the shorter is 5 tall: 4 × 5 = 20.",
      args: [[2, 5, 3, 8, 4, 7]],
      expected: 20,
    },
    {
      input: "heights = [6, 1, 1, 1, 6]",
      output: "24",
      explanation: "The two outer walls are 4 apart and both 6 tall: 4 × 6 = 24.",
      args: [[6, 1, 1, 1, 6]],
      expected: 24,
    },
    {
      input: "heights = [3, 3]",
      output: "3",
      explanation: "Only one pair exists: width 1, height 3.",
      args: [[3, 3]],
      expected: 3,
    },
  ],
  constraints: ["2 ≤ heights.length ≤ 10⁵", "0 ≤ heights[i] ≤ 10⁴"],
  hints: [
    "Trying every pair is O(n²). Which pair gives you the widest possible container?",
    "Start with the two outermost walls. If you move a pointer inward, the width shrinks, so the only hope of doing better is a taller shorter wall.",
    "Always move the pointer at the shorter wall. Keeping it can't help: any container using it with a closer wall is narrower and no taller. Track the best area as you go.",
  ],
  keyIdea:
    "Start with pointers at both ends, the widest container. The shorter wall caps the water level, and every remaining partner for it is closer, so it has already been used in its best container; discard it by moving that pointer inward. Repeat until the pointers meet, recording the maximum area.",
  complexity: { time: "O(n)", space: "O(1)" },
  tags: ["array", "greedy"],
  externalRefs: [{ label: "LeetCode 11", url: "https://leetcode.com/problems/container-with-most-water/" }],
});
