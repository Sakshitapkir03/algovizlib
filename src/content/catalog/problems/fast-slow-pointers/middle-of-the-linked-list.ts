import { defineProblem } from "@/lib/catalog";

export const middleOfTheLinkedList = defineProblem({
  slug: "middle-of-the-linked-list",
  patternSlug: "fast-slow-pointers",
  title: "Middle of the Linked List",
  difficulty: "easy",
  order: 1,
  statement: `You're given the \`head\` of a non-empty singly linked list. Find its middle node and return the list starting from that node (the middle node and everything after it).

If the list has an odd number of nodes there is one middle. If it has an even number there are two; return the second of them.

Lists are written as arrays from head to tail, so \`[1, 2, 3]\` means 1 → 2 → 3.`,
  examples: [
    {
      input: "head = [2, 4, 6, 8, 10]",
      output: "[6, 8, 10]",
      explanation: "Five nodes, so the third one (6) is the middle.",
      args: [[2, 4, 6, 8, 10]],
      expected: [6, 8, 10],
    },
    {
      input: "head = [1, 3, 5, 7, 9, 11]",
      output: "[7, 9, 11]",
      explanation: "Six nodes have two middles, 5 and 7. The second one, 7, is returned.",
      args: [[1, 3, 5, 7, 9, 11]],
      expected: [7, 9, 11],
    },
    {
      input: "head = [42]",
      output: "[42]",
      explanation: "A single node is its own middle.",
      args: [[42]],
      expected: [42],
    },
  ],
  constraints: ["1 ≤ number of nodes ≤ 100", "1 ≤ node value ≤ 100"],
  hints: [
    "Counting the nodes and then walking halfway takes two passes. Can you find the middle in one?",
    "If one pointer moves twice as fast as another, where is the slow one when the fast one reaches the end?",
    "Start `slow` and `fast` at the head. While `fast` and `fast.next` exist, move `slow` one step and `fast` two. `slow` is then the middle, and for an even length it's the second middle.",
  ],
  keyIdea:
    "Move a slow pointer one node and a fast pointer two nodes per step. The fast pointer covers twice the distance, so when it can't move any further the slow pointer has covered half the list. Stopping when `fast` or `fast.next` is empty lands `slow` on the second middle for even lengths.",
  complexity: { time: "O(n)", space: "O(1)" },
  tags: ["linked-list"],
  relatedPatterns: ["linked-list"],
  externalRefs: [{ label: "LeetCode 876", url: "https://leetcode.com/problems/middle-of-the-linked-list/" }],
});
