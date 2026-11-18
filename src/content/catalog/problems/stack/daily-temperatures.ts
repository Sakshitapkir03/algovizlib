import { defineProblem } from "@/lib/catalog";

export const dailyTemperatures = defineProblem({
  slug: "daily-temperatures",
  patternSlug: "stack",
  title: "Daily Temperatures",
  difficulty: "medium",
  order: 2,
  statement: `You have a forecast of daily high temperatures, \`temps\`, where \`temps[i]\` is the high on day \`i\`. For each day, work out how many days you would have to wait to get a day that is strictly warmer.

Return an array \`waits\` of the same length, where \`waits[i]\` is the number of days from day \`i\` until the first later day with a higher temperature. If no later day is warmer, \`waits[i]\` is \`0\`.`,
  examples: [
    {
      input: "temps = [65, 70, 68, 66, 71, 64]",
      output: "[1, 3, 2, 1, 0, 0]",
      explanation:
        "Day 1 (70) waits until day 4 (71), 3 days. Days 4 and 5 never see anything warmer, so they get 0.",
      args: [[65, 70, 68, 66, 71, 64]],
      expected: [1, 3, 2, 1, 0, 0],
    },
    {
      input: "temps = [40, 45, 50]",
      output: "[1, 1, 0]",
      explanation: "Each day is beaten by the very next one, except the last.",
      args: [[40, 45, 50]],
      expected: [1, 1, 0],
    },
    {
      input: "temps = [50, 50, 50]",
      output: "[0, 0, 0]",
      explanation: "An equal temperature isn't warmer, so no day ever finds one.",
      args: [[50, 50, 50]],
      expected: [0, 0, 0],
    },
  ],
  constraints: ["1 ≤ temps.length ≤ 10⁵", "30 ≤ temps[i] ≤ 100"],
  hints: [
    "Scanning forward from every day is O(n²). Can a single warm day answer the question for several earlier days at once?",
    "Keep the days that are still waiting for a warmer day. Their temperatures, from oldest to newest, never increase. Why?",
    "Keep a stack of waiting day indices. For each new day, pop every waiting day that is colder and record the gap between the indices, then push the new day. Anything left on the stack gets 0.",
  ],
  keyIdea:
    "Maintain a stack of day indices that haven't found a warmer day yet; their temperatures are non-increasing from bottom to top. When a new day is warmer than the top, it is the answer for that day, so pop it and record the index difference, repeating until the top is not colder. Each day is pushed and popped at most once.",
  complexity: { time: "O(n)", space: "O(n)" },
  tags: ["array", "monotonic stack"],
  externalRefs: [{ label: "LeetCode 739", url: "https://leetcode.com/problems/daily-temperatures/" }],
});
