import { defineProblem } from "@/lib/catalog";

export const evaluateReversePolishNotation = defineProblem({
  slug: "evaluate-reverse-polish-notation",
  patternSlug: "stack",
  title: "Evaluate Reverse Polish Notation",
  difficulty: "medium",
  order: 1,
  statement: `An arithmetic expression is written in postfix form (Reverse Polish Notation): each operator comes after its two operands. For example, \`3 4 +\` means 3 + 4, and \`2 3 4 + *\` means 2 × (3 + 4).

You're given the expression as an array of strings \`tokens\`. Each token is either an integer (possibly negative, like \`"-6"\`) or one of the operators \`"+"\`, \`"-"\`, \`"*"\`, \`"/"\`. Return the integer value of the expression.

Division between two integers keeps only the integer part, truncating toward zero (so 7 / -2 is -3, not -4). The expression is always valid, never divides by zero, and every intermediate result fits in a 32-bit signed integer.`,
  examples: [
    {
      input: 'tokens = ["2", "9", "3", "-", "*", "4", "+"]',
      output: "16",
      explanation: "9 - 3 = 6, then 2 * 6 = 12, then 12 + 4 = 16.",
      args: [["2", "9", "3", "-", "*", "4", "+"]],
      expected: 16,
    },
    {
      input: 'tokens = ["7", "-3", "/"]',
      output: "-2",
      explanation: "7 / -3 is -2.33…, which truncates toward zero to -2.",
      args: [["7", "-3", "/"]],
      expected: -2,
    },
    {
      input: 'tokens = ["42"]',
      output: "42",
      explanation: "A single number is already the whole expression.",
      args: [["42"]],
      expected: 42,
    },
  ],
  constraints: [
    "1 ≤ tokens.length ≤ 10⁴",
    'Each token is an integer in [-200, 200] or one of "+", "-", "*", "/"',
    "The expression is valid and every intermediate value fits in a 32-bit signed integer",
  ],
  hints: [
    "When you read an operator, which numbers does it apply to?",
    "An operator always uses the two most recent values that haven't been consumed yet. Keep those values somewhere you can take from the end.",
    "Push numbers onto a stack. On an operator, pop the right operand, then the left operand, apply the operator (truncating division toward zero), and push the result. The last value left is the answer.",
  ],
  keyIdea:
    "Scan the tokens left to right with a stack of values. Numbers are pushed; an operator pops the right operand and then the left one, combines them, and pushes the result back. Because postfix order already encodes precedence, the single value left at the end is the answer.",
  complexity: { time: "O(n)", space: "O(n)" },
  tags: ["array", "stack", "math"],
  externalRefs: [
    {
      label: "LeetCode 150",
      url: "https://leetcode.com/problems/evaluate-reverse-polish-notation/",
    },
  ],
});
