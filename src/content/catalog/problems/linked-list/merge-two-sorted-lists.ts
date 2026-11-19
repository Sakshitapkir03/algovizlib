import { defineProblem } from "@/lib/catalog";

export const mergeTwoSortedLists = defineProblem({
  slug: "merge-two-sorted-lists",
  patternSlug: "linked-list",
  title: "Merge Two Sorted Lists",
  difficulty: "easy",
  order: 1,
  statement: `You're given the heads of two singly linked lists, \`a\` and \`b\`, each already sorted from smallest to largest. Splice their nodes together into one sorted list and return its head.

Lists are written as arrays from head to tail. Either list may be empty (\`[]\`); if both are, return \`[]\`.`,
  examples: [
    {
      input: "a = [2, 5, 8], b = [1, 5, 6, 10]",
      output: "[1, 2, 5, 5, 6, 8, 10]",
      explanation: "Repeatedly take the smaller front node; equal values both appear.",
      args: [
        [2, 5, 8],
        [1, 5, 6, 10],
      ],
      expected: [1, 2, 5, 5, 6, 8, 10],
    },
    {
      input: "a = [], b = [4, 7]",
      output: "[4, 7]",
      explanation: "With one list empty, the answer is the other list.",
      args: [[], [4, 7]],
      expected: [4, 7],
    },
    {
      input: "a = [], b = []",
      output: "[]",
      args: [[], []],
      expected: [],
    },
  ],
  constraints: [
    "0 ≤ length of each list ≤ 50",
    "-100 ≤ node value ≤ 100",
    "both lists are sorted in non-decreasing order",
  ],
  hints: [
    "The smallest value overall must be at the front of one of the two lists.",
    "Compare the two front nodes, attach the smaller one to your result, and advance in that list only.",
    "Start from a dummy node with a `tail` pointer. Loop while both lists have nodes, linking the smaller front to `tail`. When one runs out, link the rest of the other in one step.",
  ],
  keyIdea:
    "Keep a dummy head and a `tail` pointer. At each step, compare the fronts of both lists, link the smaller node after `tail`, and advance that list. When one list is exhausted, the remainder of the other is already sorted, so attach it whole.",
  complexity: { time: "O(n + m)", space: "O(1)" },
  tags: ["linked-list", "merge", "sorted"],
  relatedPatterns: ["sorting"],
  externalRefs: [{ label: "LeetCode 21", url: "https://leetcode.com/problems/merge-two-sorted-lists/" }],
});
