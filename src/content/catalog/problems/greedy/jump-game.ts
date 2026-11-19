import { defineProblem } from "@/lib/catalog";

export const jumpGame = defineProblem({
  slug: "jump-game",
  patternSlug: "greedy",
  title: "Jump Game",
  difficulty: "medium",
  order: 1,
  statement: `You stand on index \`0\` of an array \`nums\` of non-negative integers. From index \`i\` you may jump forward to any index from \`i + 1\` up to \`i + nums[i]\` (a value of \`0\` means you can't move from there).

Return \`true\` if some sequence of jumps lands on the last index, and \`false\` otherwise. An array with one element is already at its last index, so the answer is \`true\`.`,
  examples: [
    {
      input: "nums = [3, 1, 0, 2, 4]",
      output: "true",
      explanation: "Jump from index 0 to index 3 (a jump of 3), then from index 3 jump 1 to index 4.",
      args: [[3, 1, 0, 2, 4]],
      expected: true,
    },
    {
      input: "nums = [2, 1, 1, 0, 5]",
      output: "false",
      explanation: "Every route reaches index 3 at best, and its value is 0, so index 4 is out of reach.",
      args: [[2, 1, 1, 0, 5]],
      expected: false,
    },
    {
      input: "nums = [0]",
      output: "true",
      explanation: "You already stand on the last index.",
      args: [[0]],
      expected: true,
    },
  ],
  constraints: ["1 ≤ nums.length ≤ 10⁴", "0 ≤ nums[i] ≤ 10⁵"],
  hints: [
    "You don't need to know which jumps you take, only which indices are reachable at all.",
    "If index `i` is reachable, so is every index before it. So the reachable set is always a prefix of the array.",
    "Walk left to right keeping `farthest`, the largest index reachable so far. If `i > farthest`, you're stuck; otherwise update `farthest = max(farthest, i + nums[i])`.",
  ],
  keyIdea:
    "Reachable indices always form a prefix, so one number describes them: the farthest index reachable so far. Scan left to right; if the current index lies beyond that frontier, nothing further can be reached and the answer is false. Otherwise extend the frontier with `i + nums[i]`. If the frontier ever covers the last index, the answer is true.",
  complexity: { time: "O(n)", space: "O(1)" },
  tags: ["array", "reachability"],
  relatedPatterns: ["dynamic-programming"],
  externalRefs: [{ label: "LeetCode 55", url: "https://leetcode.com/problems/jump-game/" }],
});
