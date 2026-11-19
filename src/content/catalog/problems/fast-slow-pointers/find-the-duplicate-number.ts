import { defineProblem } from "@/lib/catalog";

export const findTheDuplicateNumber = defineProblem({
  slug: "find-the-duplicate-number",
  patternSlug: "fast-slow-pointers",
  title: "Find the Duplicate Number",
  difficulty: "medium",
  order: 3,
  statement: `You're given an array \`nums\` of \`n + 1\` integers, each between \`1\` and \`n\` inclusive. By the pigeonhole principle at least one value appears more than once. Exactly one value is repeated, though it may appear two or more times.

Return that repeated value. Don't modify \`nums\`, and use only a constant amount of extra memory.`,
  examples: [
    {
      input: "nums = [2, 5, 1, 3, 4, 5]",
      output: "5",
      explanation: "Six numbers drawn from 1 to 5, and 5 is the one that shows up twice.",
      args: [[2, 5, 1, 3, 4, 5]],
      expected: 5,
    },
    {
      input: "nums = [3, 3, 3, 3]",
      output: "3",
      explanation: "The repeated value can appear more than twice.",
      args: [[3, 3, 3, 3]],
      expected: 3,
    },
    {
      input: "nums = [1, 1]",
      output: "1",
      explanation: "The smallest case: n = 1, so both entries must be 1.",
      args: [[1, 1]],
      expected: 1,
    },
  ],
  constraints: [
    "1 ≤ n ≤ 10⁵",
    "nums.length = n + 1",
    "1 ≤ nums[i] ≤ n",
    "exactly one value appears more than once",
  ],
  hints: [
    "Sorting or a set would work, but both break the rules. Every value is also a valid index into `nums`. What if you treat `nums[i]` as a pointer from `i` to `nums[i]`?",
    "Starting at index 0 and repeatedly jumping to `nums[current]` must eventually loop. Which value do two different indices point to?",
    "Run slow (`i = nums[i]`) and fast (`i = nums[nums[i]]`) from index 0 until they meet. Then restart one from 0 and move both one jump at a time; where they meet is the duplicate.",
  ],
  keyIdea:
    "Read the array as a linked list where index `i` points to `nums[i]`. Index 0 is never pointed to (values start at 1), so it's a clean starting point, and the duplicate value has two incoming pointers, which makes it exactly the entry of a cycle. Floyd's cycle detection finds that entry with two variables.",
  complexity: { time: "O(n)", space: "O(1)" },
  tags: ["array", "floyd's cycle detection"],
  relatedPatterns: ["binary-search"],
  externalRefs: [{ label: "LeetCode 287", url: "https://leetcode.com/problems/find-the-duplicate-number/" }],
});
