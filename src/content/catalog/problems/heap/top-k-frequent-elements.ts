import { defineProblem } from "@/lib/catalog";

export const topKFrequentElements = defineProblem({
  slug: "top-k-frequent-elements",
  patternSlug: "heap",
  title: "Top K Frequent Elements",
  difficulty: "medium",
  order: 2,
  statement: `Given an integer array \`nums\` and an integer \`k\`, return the \`k\` distinct values that appear most often in \`nums\`.

You may return them in any order. The input is chosen so the answer is unique: there is never a tie for the last spot among the top \`k\`.`,
  examples: [
    {
      input: "nums = [4, 1, 4, 2, 1, 4, 3], k = 2",
      output: "[4, 1]",
      explanation: "4 appears three times and 1 appears twice; 2 and 3 appear once each.",
      args: [[4, 1, 4, 2, 1, 4, 3], 2],
      expected: [4, 1],
    },
    {
      input: "nums = [5, 6, 5, 6, 7, 5, 6, 8], k = 2",
      output: "[5, 6]",
      explanation:
        "5 and 6 both appear three times, so together they are the top 2. [6, 5] is also accepted.",
      args: [[5, 6, 5, 6, 7, 5, 6, 8], 2],
      expected: [5, 6],
    },
    {
      input: "nums = [9], k = 1",
      output: "[9]",
      args: [[9], 1],
      expected: [9],
    },
  ],
  judge: "unordered",
  constraints: [
    "1 ≤ nums.length ≤ 10⁵",
    "-10⁴ ≤ nums[i] ≤ 10⁴",
    "1 ≤ k ≤ number of distinct values in nums",
    "the top k values are unique (no tie at the cutoff)",
  ],
  hints: [
    "First turn the array into counts. Now the question is about the counts, not the original order.",
    "You need the k largest counts. That is the same shape of question as finding the k largest numbers.",
    "Count with a hash map, then push (count, value) pairs into a min-heap capped at k, popping the smallest count whenever it grows past k. The heap's values are the answer. (Bucketing values by count also works in O(n).)",
  ],
  keyIdea:
    "Count occurrences with a hash map, then select the k highest counts with a size-k min-heap: its root is the least frequent of the current winners, so each distinct value either replaces it or is ignored. That costs O(n log k); a bucket array indexed by count brings it to O(n).",
  complexity: { time: "O(n log k)", space: "O(n)" },
  tags: ["array", "hash map", "heap", "bucket sort"],
  relatedPatterns: ["arrays-hashing"],
  externalRefs: [{ label: "LeetCode 347", url: "https://leetcode.com/problems/top-k-frequent-elements/" }],
});
