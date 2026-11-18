import { defineProblem } from "@/lib/catalog";

export const reverseLinkedList = defineProblem({
  slug: "reverse-linked-list",
  patternSlug: "linked-list",
  title: "Reverse a Linked List",
  difficulty: "easy",
  order: 0,
  statement: `You're given the \`head\` of a singly linked list. Flip the direction of every link so the last node becomes the first, and return the new head.

Lists are written as arrays from head to tail, so \`[1, 2, 3]\` means 1 → 2 → 3. An empty list is \`[]\`; reversing it gives \`[]\`.`,
  examples: [
    {
      input: "head = [3, 7, 1, 9]",
      output: "[9, 1, 7, 3]",
      explanation: "Each arrow is turned around, so 9 is now the head.",
      args: [[3, 7, 1, 9]],
      expected: [9, 1, 7, 3],
    },
    {
      input: "head = [42]",
      output: "[42]",
      explanation: "A single node is its own reverse.",
      args: [[42]],
      expected: [42],
    },
    {
      input: "head = []",
      output: "[]",
      args: [[]],
      expected: [],
    },
  ],
  constraints: ["0 ≤ number of nodes ≤ 5000", "-5000 ≤ node value ≤ 5000"],
  hints: [
    "You don't need a new list. Can you reuse the existing nodes and only change where their `next` points?",
    "When you point a node backwards, you lose the way forward. What do you need to remember before changing `current.next`?",
    "Walk with `prev` (starts empty) and `current`. Save `current.next`, point `current.next` at `prev`, then advance both. `prev` ends as the new head.",
  ],
  keyIdea:
    "Walk the list once with two pointers, `prev` and `current`. Before redirecting `current.next` to `prev`, save the next node so the rest of the list isn't lost, then step both pointers forward. When `current` falls off the end, `prev` is the new head.",
  complexity: { time: "O(n)", space: "O(1)" },
  tags: ["linked-list", "in-place"],
  externalRefs: [{ label: "LeetCode 206", url: "https://leetcode.com/problems/reverse-linked-list/" }],
});
