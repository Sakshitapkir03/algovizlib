import { defineProblem } from "@/lib/catalog";

export const implementQueueUsingStacks = defineProblem({
  slug: "implement-queue-using-stacks",
  patternSlug: "design",
  title: "Implement Queue using Stacks",
  difficulty: "easy",
  order: 0,
  statement: `Build a first-in, first-out queue of integers, \`MyQueue\`, using only stacks for storage. A stack may only push to its top, pop from its top, read its top, and report its size or whether it is empty.

- \`MyQueue()\` creates an empty queue.
- \`push(x: number): void\` adds \`x\` to the back of the queue.
- \`pop(): number\` removes the element at the front of the queue and returns it.
- \`peek(): number\` returns the element at the front without removing it.
- \`empty(): boolean\` returns \`true\` if the queue holds no elements, and \`false\` otherwise.

\`pop\` and \`peek\` are only called when the queue is not empty. Aim for amortized O(1) time per operation.`,
  examples: [
    {
      input: "MyQueue, push(4), push(7), peek(), pop(), push(9), pop(), empty(), pop(), empty()",
      output: "null, null, null, 4, 4, null, 7, false, 9, true",
      explanation:
        "4 went in first, so it is at the front for both peek and pop. 7 and 9 then leave in the order they arrived.",
      args: [
        ["MyQueue", "push", "push", "peek", "pop", "push", "pop", "empty", "pop", "empty"],
        [[], [4], [7], [], [], [9], [], [], [], []],
      ],
      expected: [null, null, null, 4, 4, null, 7, false, 9, true],
    },
    {
      input: "MyQueue, empty(), push(5), pop(), empty()",
      output: "null, true, null, 5, true",
      explanation: "A new queue is empty, and popping its only element empties it again.",
      args: [
        ["MyQueue", "empty", "push", "pop", "empty"],
        [[], [], [5], [], []],
      ],
      expected: [null, true, null, 5, true],
    },
  ],
  exampleFormat: "operations",
  constraints: [
    "1 ≤ x ≤ 9",
    "At most 100 calls in total",
    "pop and peek are only called on a non-empty queue",
  ],
  hints: [
    "Pouring one stack into another reverses its order. What does reversing a stack's order give you?",
    "Use an `in` stack for pushes and an `out` stack for pops. When should elements move from one to the other?",
    "Only when `out` is empty and you need the front, pour all of `in` into `out`; the top of `out` is then the oldest element. Each element moves at most once, so every operation is amortized O(1).",
  ],
  keyIdea:
    "Keep two stacks: `in` receives pushes, and `out` serves pops and peeks with its top as the front of the queue. When `out` runs dry, move everything from `in` to `out`, which reverses it into queue order. Each element is pushed and popped at most twice in total, so a sequence of n operations costs O(n).",
  complexity: { time: "O(1) amortized per operation", space: "O(n)" },
  tags: ["design", "stack", "queue"],
  relatedPatterns: ["stack"],
  externalRefs: [
    { label: "LeetCode 232", url: "https://leetcode.com/problems/implement-queue-using-stacks/" },
  ],
});
