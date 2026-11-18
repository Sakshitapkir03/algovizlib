import { defineProblem } from "@/lib/catalog";

export const removeNthNodeFromEnd = defineProblem({
  slug: "remove-nth-node-from-end",
  patternSlug: "linked-list",
  title: "Remove the Nth Node From the End",
  difficulty: "medium",
  order: 2,
  statement: `You're given the \`head\` of a singly linked list and a number \`n\`. Delete the node that is \`n\` positions from the end (\`n = 1\` is the last node) and return the head of the resulting list.

Lists are written as arrays from head to tail. \`n\` is always between 1 and the list's length. If the only node is removed, return \`[]\`.

Try to do it in a single pass over the list.`,
  examples: [
    {
      input: "head = [10, 20, 30, 40, 50], n = 2",
      output: "[10, 20, 30, 50]",
      explanation: "Counting from the end, 50 is 1st and 40 is 2nd, so 40 is removed.",
      args: [[10, 20, 30, 40, 50], 2],
      expected: [10, 20, 30, 50],
    },
    {
      input: "head = [8, 3, 5], n = 3",
      output: "[3, 5]",
      explanation: "The 3rd node from the end is the head itself.",
      args: [[8, 3, 5], 3],
      expected: [3, 5],
    },
    {
      input: "head = [6], n = 1",
      output: "[]",
      explanation: "Removing the only node leaves an empty list.",
      args: [[6], 1],
      expected: [],
    },
  ],
  constraints: ["1 ≤ number of nodes ≤ 30", "0 ≤ node value ≤ 100", "1 ≤ n ≤ number of nodes"],
  hints: [
    "Two passes work: count the nodes, then walk to the right spot. How could you avoid knowing the length?",
    "If two pointers are exactly `n` nodes apart, where is the back one when the front one reaches the end?",
    "Put a dummy node before the head. Move `fast` `n` steps ahead, then move `fast` and `slow` together until `fast.next` is empty. Now `slow.next` is the node to delete; skip over it.",
  ],
  keyIdea:
    "Start two pointers at a dummy node in front of the head and give the front one an `n`-node head start. Move both together until the front pointer reaches the last node; the back pointer then sits just before the target, so `slow.next = slow.next.next` removes it. The dummy makes deleting the head the same as any other case.",
  complexity: { time: "O(n)", space: "O(1)" },
  tags: ["linked-list", "two-pointers"],
  externalRefs: [
    { label: "LeetCode 19", url: "https://leetcode.com/problems/remove-nth-node-from-end-of-list/" },
  ],
});
