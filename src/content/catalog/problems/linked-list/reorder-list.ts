import { defineProblem } from "@/lib/catalog";

export const reorderList = defineProblem({
  slug: "reorder-list",
  patternSlug: "linked-list",
  title: "Reorder List",
  difficulty: "medium",
  order: 3,
  statement: `You're given the \`head\` of a singly linked list with nodes \`L0 → L1 → … → Ln\`. Rearrange the nodes so they alternate between the front and the back: \`L0 → Ln → L1 → Ln-1 → L2 → Ln-2 → …\`, and return the head of the reordered list.

Move the nodes themselves rather than rewriting their values. Lists are written as arrays from head to tail.`,
  examples: [
    {
      input: "head = [10, 20, 30, 40, 50]",
      output: "[10, 50, 20, 40, 30]",
      explanation: "Take first, last, second, second-to-last, and finally the middle node 30.",
      args: [[10, 20, 30, 40, 50]],
      expected: [10, 50, 20, 40, 30],
    },
    {
      input: "head = [7, 8, 9, 4]",
      output: "[7, 4, 8, 9]",
      explanation: "7 (first), 4 (last), 8 (second), 9 (third).",
      args: [[7, 8, 9, 4]],
      expected: [7, 4, 8, 9],
    },
    {
      input: "head = [5]",
      output: "[5]",
      explanation: "A single node stays as it is.",
      args: [[5]],
      expected: [5],
    },
  ],
  constraints: ["1 ≤ number of nodes ≤ 5 × 10⁴", "1 ≤ node value ≤ 1000"],
  hints: [
    "The new order interleaves the first half with the second half read backwards.",
    "Break it into three smaller list tasks you may already know: find the middle, reverse a list, and merge two lists by alternating.",
    "Use slow/fast pointers to find the middle and cut the list there. Reverse the second half. Then weave: one node from the front half, one from the reversed back half, until the back half runs out.",
  ],
  keyIdea:
    "Find the middle with slow and fast pointers and split the list into two halves. Reverse the second half so its nodes come in back-to-front order, then interleave the two halves node by node. All three steps are linear and only rewire pointers.",
  complexity: { time: "O(n)", space: "O(1)" },
  tags: ["linked-list", "two-pointers", "in-place"],
  externalRefs: [{ label: "LeetCode 143", url: "https://leetcode.com/problems/reorder-list/" }],
});
