import { defineProblem } from "@/lib/catalog";

export const insertionSort = defineProblem({
  slug: "insertion-sort",
  patternSlug: "sorting",
  title: "Sort an Array with Insertion Sort",
  difficulty: "easy",
  order: 2,
  statement: `Given an array of integers \`nums\`, return it sorted in ascending (non-decreasing) order. Duplicates stay in the result as many times as they appear.

This problem is about learning the algorithm, so implement insertion sort yourself and don't call a built-in sort. Insertion sort works the way many people sort a hand of cards: it takes the next element and slides it left past every larger element in the already-sorted prefix until it reaches its place.`,
  examples: [
    {
      input: "nums = [6, 2, 10, 4, 8]",
      output: "[2, 4, 6, 8, 10]",
      explanation: "2 slides in front of 6, 10 stays put, 4 slides past 10 and 6, and 8 slides past 10 only.",
      args: [[6, 2, 10, 4, 8]],
      expected: [2, 4, 6, 8, 10],
    },
    {
      input: "nums = [1, 2, 3, 4]",
      output: "[1, 2, 3, 4]",
      explanation:
        "Already sorted: each element is compared once and never moves, so this takes linear time.",
      args: [[1, 2, 3, 4]],
      expected: [1, 2, 3, 4],
    },
    {
      input: "nums = [3, -3]",
      output: "[-3, 3]",
      args: [[3, -3]],
      expected: [-3, 3],
    },
  ],
  constraints: ["1 ≤ nums.length ≤ 1000", "-10⁴ ≤ nums[i] ≤ 10⁴"],
  hints: [
    "Imagine the first element alone is a sorted list. How would you add the second element to it?",
    "To insert a value into a sorted prefix, you only need to shift the elements that are larger than it one step right.",
    "For `i` from 1 to n - 1: save `key = nums[i]`, move `j` left from `i - 1` while `nums[j] > key`, copying `nums[j]` to `nums[j + 1]`, then write `key` at `j + 1`.",
  ],
  keyIdea:
    "Keep `nums[0..i-1]` sorted. To add `nums[i]`, hold it aside and shift every larger prefix element one slot right, then drop it into the gap. Work is proportional to how far elements move, so it's O(n²) in the worst case but close to O(n) on nearly sorted input, and it is stable because equal values never jump over each other.",
  complexity: { time: "O(n²)", space: "O(1)" },
  tags: ["array", "sorting", "in-place", "stable"],
  externalRefs: [
    { label: "LeetCode 912", url: "https://leetcode.com/problems/sort-an-array/" },
    { label: "Wikipedia: Insertion sort", url: "https://en.wikipedia.org/wiki/Insertion_sort" },
  ],
});
