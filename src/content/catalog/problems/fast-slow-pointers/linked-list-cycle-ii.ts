import { defineProblem } from "@/lib/catalog";

export const linkedListCycleIi = defineProblem({
  slug: "linked-list-cycle-ii",
  patternSlug: "fast-slow-pointers",
  title: "Linked List Cycle II",
  difficulty: "medium",
  order: 2,
  statement: `You're given the head of a singly linked list whose tail may point back to an earlier node, forming a loop. Find the node where the loop begins: the first node you reach, walking from the head, that is part of the loop.

The list is described by \`values\`, the node values from the head in order, and \`pos\`, the index of the node the tail points back to (\`-1\` if the tail points nowhere). Your solution walks the nodes; it can't read \`pos\`.

Return the index (counting from 0 at the head) of the node where the loop begins, or \`-1\` if the list has no loop. Don't modify the list.`,
  examples: [
    {
      input: "values = [10, 20, 30, 40, 50, 60], pos = 2",
      output: "2",
      explanation:
        "After 60 the list returns to 30, so the loop is 30 → 40 → 50 → 60 → 30 and it begins at index 2.",
      args: [[10, 20, 30, 40, 50, 60], 2],
      expected: 2,
    },
    {
      input: "values = [1, 2], pos = 0",
      output: "0",
      explanation: "The tail points back to the head, so the whole list is the loop.",
      args: [[1, 2], 0],
      expected: 0,
    },
    {
      input: "values = [9, 8, 7], pos = -1",
      output: "-1",
      explanation: "The list ends at 7, so there's no loop.",
      args: [[9, 8, 7], -1],
      expected: -1,
    },
  ],
  constraints: [
    "0 ≤ number of nodes ≤ 10⁴",
    "-10⁵ ≤ node value ≤ 10⁵",
    "pos is -1 or a valid index into values",
  ],
  hints: [
    "First decide whether there is a loop at all, using two pointers moving at different speeds.",
    "Say the loop starts `a` steps from the head and the pointers meet `b` steps into the loop. The fast one has walked twice as far as the slow one. What does that say about the distance from the meeting point back to the loop's start?",
    "After `slow` and `fast` meet, put one pointer back at the head and leave the other at the meeting point. Move both one step at a time; the node where they meet is the start of the loop.",
  ],
  keyIdea:
    "Run slow (one step) and fast (two steps) until they meet inside the loop. If the loop starts `a` steps from the head, the meeting point is exactly `a` steps (plus whole laps) short of the loop's start. So a pointer restarted from the head and one left at the meeting point, both moving one step at a time, arrive at the loop's start together.",
  complexity: { time: "O(n)", space: "O(1)" },
  tags: ["linked-list", "floyd's cycle detection"],
  relatedPatterns: ["linked-list"],
  externalRefs: [{ label: "LeetCode 142", url: "https://leetcode.com/problems/linked-list-cycle-ii/" }],
});
