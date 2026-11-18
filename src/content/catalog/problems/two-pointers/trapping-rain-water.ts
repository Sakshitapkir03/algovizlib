import { defineProblem } from "@/lib/catalog";

export const trappingRainWater = defineProblem({
  slug: "trapping-rain-water",
  patternSlug: "two-pointers",
  title: "Trapping Rain Water",
  difficulty: "hard",
  order: 4,
  statement: `A strip of land is drawn as a row of side-by-side bars, each 1 unit wide. The array \`heights\` gives the height of each bar from left to right, so it describes the terrain's profile.

After a heavy rainstorm, water collects in the dips between taller bars; anything that would spill past the left or right edge of the strip drains away. Return the total units of water left standing on the terrain.`,
  examples: [
    {
      input: "heights = [3, 0, 1, 4, 0, 2, 1, 3]",
      output: "11",
      explanation:
        "Between the bars of height 3 and 4, positions 1 and 2 hold 3 + 2 = 5. Between the 4 and the final 3, positions 4, 5, and 6 hold 3 + 1 + 2 = 6.",
      args: [[3, 0, 1, 4, 0, 2, 1, 3]],
      expected: 11,
    },
    {
      input: "heights = [4, 1, 0, 2]",
      output: "3",
      explanation:
        "The right wall is only 2 tall, so the water level is 2: position 1 holds 1 and position 2 holds 2.",
      args: [[4, 1, 0, 2]],
      expected: 3,
    },
    {
      input: "heights = [1, 2, 3, 4]",
      output: "0",
      explanation: "The terrain only rises, so every drop runs off the left edge.",
      args: [[1, 2, 3, 4]],
      expected: 0,
    },
  ],
  constraints: ["1 ≤ heights.length ≤ 2 × 10⁴", "0 ≤ heights[i] ≤ 10⁵"],
  hints: [
    "Think about a single bar. How high can water rise above it?",
    "The water above a bar is min(tallest bar to its left, tallest bar to its right) minus its own height. Can you know the smaller of those two without computing both everywhere?",
    "Keep a pointer at each end plus the tallest height seen from each side. Whichever side has the smaller running maximum is the limiting wall, so settle that side's bar, add its water, and move that pointer inward.",
  ],
  keyIdea:
    "Water above a bar is capped by the lower of the tallest walls on its two sides. Walk inward from both ends tracking the tallest wall seen on each side: the side with the lower maximum is guaranteed to be the cap for its current bar, because the other side already has something at least as tall. Settle that bar's water and move inward, finishing in one pass.",
  complexity: { time: "O(n)", space: "O(1)" },
  tags: ["array", "simulation"],
  externalRefs: [{ label: "LeetCode 42", url: "https://leetcode.com/problems/trapping-rain-water/" }],
});
