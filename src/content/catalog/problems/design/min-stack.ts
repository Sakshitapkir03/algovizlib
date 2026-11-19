import { defineProblem } from "@/lib/catalog";

export const minStack = defineProblem({
  slug: "min-stack",
  patternSlug: "design",
  title: "Min Stack",
  difficulty: "medium",
  order: 1,
  statement: `Build a stack of integers, \`MinStack\`, that can also report its smallest element. Every method must run in O(1) time.

- \`MinStack()\` creates an empty stack.
- \`push(val: number): void\` puts \`val\` on top of the stack.
- \`pop(): void\` removes the top element.
- \`top(): number\` returns the top element.
- \`getMin(): number\` returns the smallest element currently in the stack.

\`pop\`, \`top\`, and \`getMin\` are only called when the stack is not empty.`,
  examples: [
    {
      input: "MinStack, push(6), push(2), push(8), getMin(), pop(), top(), pop(), getMin()",
      output: "null, null, null, null, 2, null, 2, null, 6",
      explanation:
        "With 6, 2, 8 on the stack the minimum is 2. Popping 8 leaves 2 on top; popping 2 as well makes 6 the minimum again.",
      args: [
        ["MinStack", "push", "push", "push", "getMin", "pop", "top", "pop", "getMin"],
        [[], [6], [2], [8], [], [], [], [], []],
      ],
      expected: [null, null, null, null, 2, null, 2, null, 6],
    },
    {
      input: "MinStack, push(3), push(3), pop(), getMin()",
      output: "null, null, null, null, 3",
      explanation: "The minimum appears twice; removing one copy must not forget the other.",
      args: [
        ["MinStack", "push", "push", "pop", "getMin"],
        [[], [3], [3], [], []],
      ],
      expected: [null, null, null, null, 3],
    },
  ],
  exampleFormat: "operations",
  constraints: [
    "-2³¹ ≤ val ≤ 2³¹ - 1",
    "At most 3 × 10⁴ calls in total",
    "pop, top, and getMin are only called on a non-empty stack",
  ],
  hints: [
    "Tracking a single minimum breaks as soon as you pop it: what was the minimum before it arrived?",
    "The minimum only depends on what is below each element, and that never changes while the element is on the stack.",
    "Store pairs `(value, minimum of everything up to and including this value)`. Push computes `min(val, previous top's minimum)`; `getMin` reads the top pair.",
  ],
  keyIdea:
    "A stack only changes at its top, so the minimum at each depth is fixed while that element is present. Store the running minimum alongside every value (or in a parallel stack); popping automatically restores the previous minimum, and every operation stays O(1).",
  complexity: { time: "O(1) per operation", space: "O(n)" },
  tags: ["design", "stack"],
  relatedPatterns: ["stack"],
  externalRefs: [{ label: "LeetCode 155", url: "https://leetcode.com/problems/min-stack/" }],
});
