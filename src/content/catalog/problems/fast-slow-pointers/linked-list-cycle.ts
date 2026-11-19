import { defineProblem } from "@/lib/catalog";

export const linkedListCycle = defineProblem({
  slug: "linked-list-cycle",
  patternSlug: "fast-slow-pointers",
  title: "Linked List Cycle",
  difficulty: "easy",
  order: 0,
  statement: `You're given the head of a singly linked list. Normally the last node's \`next\` is empty, but this list may be broken: the tail might point back to an earlier node, so following \`next\` would go around forever.

The list is described by \`values\`, the node values from the head in order, and \`pos\`, the index of the node the tail points back to. \`pos = -1\` means the tail points nowhere. (\`pos\` only describes the input; your solution walks the nodes and can't read it.)

Return \`true\` if following \`next\` from the head ever revisits a node, and \`false\` if it reaches the end. An empty list has no cycle.`,
  examples: [
    {
      input: "values = [4, 8, 15, 16, 23], pos = 2",
      output: "true",
      explanation: "After 23 the list jumps back to 15, so 15 → 16 → 23 → 15 repeats forever.",
      args: [[4, 8, 15, 16, 23], 2],
      expected: true,
    },
    {
      input: "values = [5, 9], pos = -1",
      output: "false",
      explanation: "9 is the last node and points nowhere.",
      args: [[5, 9], -1],
      expected: false,
    },
    {
      input: "values = [7], pos = 0",
      output: "true",
      explanation: "The only node points to itself.",
      args: [[7], 0],
      expected: true,
    },
  ],
  constraints: [
    "0 ≤ number of nodes ≤ 10⁴",
    "-10⁵ ≤ node value ≤ 10⁵",
    "pos is -1 or a valid index into values",
  ],
  hints: [
    "Remembering every node you've visited in a set works. Can you detect the loop with only a constant amount of memory?",
    "Picture two runners on a track, one twice as fast as the other. On a straight road the fast one just finishes. What happens on a circular one?",
    "Move `slow` one node and `fast` two nodes per step. If `fast` (or `fast.next`) becomes empty there is no cycle; if `slow` and `fast` ever point to the same node, there is one.",
  ],
  keyIdea:
    "Advance a slow pointer one node and a fast pointer two nodes at a time. Without a cycle, the fast pointer runs off the end. With one, both end up inside the loop, where the fast pointer closes the gap by exactly one node per step, so it must land on the slow pointer rather than skip past it.",
  complexity: { time: "O(n)", space: "O(1)" },
  tags: ["linked-list", "floyd's cycle detection"],
  relatedPatterns: ["linked-list"],
  externalRefs: [{ label: "LeetCode 141", url: "https://leetcode.com/problems/linked-list-cycle/" }],
});
