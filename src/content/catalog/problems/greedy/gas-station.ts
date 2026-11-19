import { defineProblem } from "@/lib/catalog";

export const gasStation = defineProblem({
  slug: "gas-station",
  patternSlug: "greedy",
  title: "Gas Station",
  difficulty: "medium",
  order: 2,
  statement: `A circular road has \`n\` fuel stops numbered \`0\` to \`n - 1\`. At stop \`i\` you can take on \`gas[i]\` units of fuel, and driving from stop \`i\` to the next stop (\`(i + 1) % n\`) burns \`cost[i]\` units. Your car's tank has no capacity limit, and it starts empty at whichever stop you begin from.

Return the index of the stop where you should start so that you can drive one full lap clockwise and arrive back at that stop without the tank ever going below zero along the way (arriving at a stop with exactly \`0\` is fine). If no starting stop works, return \`-1\`. The inputs are chosen so that at most one starting stop works.`,
  examples: [
    {
      input: "gas = [3, 1, 4, 2, 5], cost = [4, 3, 1, 4, 3]",
      output: "2",
      explanation:
        "Starting at stop 2 the tank reads 3, 1, 3, 2 on arrival at stops 3, 4, 0, 1, and 0 when you get back to stop 2.",
      args: [
        [3, 1, 4, 2, 5],
        [4, 3, 1, 4, 3],
      ],
      expected: 2,
    },
    {
      input: "gas = [2, 3, 1], cost = [3, 2, 2]",
      output: "-1",
      explanation: "The lap needs 7 units of fuel but only 6 are available in total.",
      args: [
        [2, 3, 1],
        [3, 2, 2],
      ],
      expected: -1,
    },
    {
      input: "gas = [4], cost = [4]",
      output: "0",
      explanation: "One stop: fill up 4, drive the loop for 4, and arrive back with 0.",
      args: [[4], [4]],
      expected: 0,
    },
  ],
  constraints: ["1 ≤ n ≤ 10⁵", "gas.length == cost.length == n", "0 ≤ gas[i], cost[i] ≤ 10⁴"],
  hints: [
    "If the total fuel is less than the total cost, no start can work. Is the reverse also true?",
    "Suppose you start at stop `s` and run dry trying to leave stop `j`. Could any stop between `s` and `j` be a valid start?",
    "Keep a running tank from the current candidate start. Whenever it drops below zero after stop `i`, make `i + 1` the new candidate and reset the tank to 0. At the end, return the candidate if total gas ≥ total cost, else -1.",
  ],
  keyIdea:
    "If you start at `s` and the tank goes negative leaving stop `j`, every stop between `s` and `j` also fails: you reached each of them with a non-negative tank, so starting there with an empty one only makes things worse. That lets you skip straight to `j + 1` as the next candidate, so one pass finds the only possible start. The answer exists exactly when total gas is at least total cost.",
  complexity: { time: "O(n)", space: "O(1)" },
  tags: ["array", "circular", "running sum"],
  externalRefs: [{ label: "LeetCode 134", url: "https://leetcode.com/problems/gas-station/" }],
});
