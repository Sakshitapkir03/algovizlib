import { defineProblem } from "@/lib/catalog";

export const firstMissingPositive = defineProblem({
  slug: "first-missing-positive",
  patternSlug: "arrays-hashing",
  title: "First Missing Positive",
  difficulty: "hard",
  order: 4,
  statement: `You are given an unsorted array of integers \`nums\`, which may contain negatives, zeros, duplicates, and very large values.

Return the smallest positive integer (\`1, 2, 3, …\`) that does not appear in \`nums\`. Your solution should run in O(n) time and use only O(1) extra memory; you may rearrange or overwrite \`nums\`.`,
  examples: [
    {
      input: "nums = [4, 1, 2]",
      output: "3",
      explanation: "1 and 2 are present, 3 is the first one missing.",
      args: [[4, 1, 2]],
      expected: 3,
    },
    {
      input: "nums = [-2, 7, 0, 9, 10]",
      output: "1",
      explanation: "No 1 at all, so the answer is 1.",
      args: [[-2, 7, 0, 9, 10]],
      expected: 1,
    },
    {
      input: "nums = [2, 3, 1, 5, 4, 3]",
      output: "6",
      explanation: "Every value from 1 to 5 is present, so the first gap is just past them.",
      args: [[2, 3, 1, 5, 4, 3]],
      expected: 6,
    },
  ],
  constraints: ["1 ≤ nums.length ≤ 10⁵", "-2³¹ ≤ nums[i] ≤ 2³¹ - 1"],
  hints: [
    "With a hash set this is easy, but that uses O(n) memory. For an array of length `n`, what range must the answer fall in?",
    "The answer is between `1` and `n + 1`, so only values `1..n` matter. Could the array itself act as the set, with index `v - 1` reserved for value `v`?",
    "Swap each value `v` in `1..n` into position `v - 1` until the current slot holds the right value, a duplicate, or something out of range. Then the first index `i` where `nums[i] != i + 1` gives `i + 1`; if none, return `n + 1`.",
  ],
  keyIdea:
    "Among `n` numbers at most `n` distinct positives fit in `1..n`, so the answer is at most `n + 1`. Use the array as its own hash table: cyclic swaps put each in-range value `v` at index `v - 1`, and each swap places one value permanently, so there are at most `n` swaps. A final scan finds the first slot without its value.",
  complexity: { time: "O(n)", space: "O(1)" },
  tags: ["array", "in-place hashing", "cyclic sort"],
  relatedPatterns: ["sorting"],
  externalRefs: [{ label: "LeetCode 41", url: "https://leetcode.com/problems/first-missing-positive/" }],
});
