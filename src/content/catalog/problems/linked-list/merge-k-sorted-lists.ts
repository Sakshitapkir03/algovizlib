import { defineProblem } from "@/lib/catalog";

export const mergeKSortedLists = defineProblem({
  slug: "merge-k-sorted-lists",
  patternSlug: "linked-list",
  title: "Merge K Sorted Lists",
  difficulty: "hard",
  order: 4,
  statement: `You're given an array \`lists\` of \`k\` singly linked lists, each sorted from smallest to largest. Combine all of their nodes into a single sorted list and return its head.

Each list is written as an array from head to tail. Any of the lists may be empty, and \`lists\` itself may be empty; if there are no nodes at all, return \`[]\`.`,
  examples: [
    {
      input: "lists = [[1, 6, 9], [2, 3, 11], [4, 8]]",
      output: "[1, 2, 3, 4, 6, 8, 9, 11]",
      explanation: "All eight values from the three lists, in sorted order.",
      args: [
        [
          [1, 6, 9],
          [2, 3, 11],
          [4, 8],
        ],
      ],
      expected: [1, 2, 3, 4, 6, 8, 9, 11],
    },
    {
      input: "lists = [[], [5], []]",
      output: "[5]",
      explanation: "Empty lists contribute nothing.",
      args: [[[], [5], []]],
      expected: [5],
    },
    {
      input: "lists = []",
      output: "[]",
      args: [[]],
      expected: [],
    },
  ],
  constraints: [
    "0 ≤ k ≤ 10⁴",
    "0 ≤ length of each list ≤ 500",
    "-10⁴ ≤ node value ≤ 10⁴",
    "the total number of nodes is at most 10⁴",
  ],
  hints: [
    "You already know how to merge two sorted lists. What goes wrong if you fold the lists in one at a time?",
    "At every step the next output node is the smallest among the k current fronts. Which data structure hands you the minimum quickly?",
    "Either keep the k front nodes in a min-heap (pop the smallest, push its `next`), or merge lists in pairs, halving the number of lists each round, like merge sort.",
  ],
  keyIdea:
    "Merging one list at a time re-scans the growing result and costs O(N·k). Instead, merge in pairs: each round merges list 0 with 1, 2 with 3, and so on, halving the count, so every node is touched in only log k rounds. A min-heap of the k current front nodes gives the same O(N log k) bound.",
  complexity: { time: "O(N log k)", space: "O(log k) for pairwise merging, O(k) with a heap" },
  tags: ["linked-list", "heap", "divide-and-conquer", "merge"],
  relatedPatterns: ["heap"],
  externalRefs: [{ label: "LeetCode 23", url: "https://leetcode.com/problems/merge-k-sorted-lists/" }],
});
