import { defineProblem } from "@/lib/catalog";

export const validParentheses = defineProblem({
  slug: "valid-parentheses",
  patternSlug: "stack",
  title: "Valid Parentheses",
  difficulty: "easy",
  order: 0,
  statement: `You're given a string \`s\` made only of the bracket characters \`(\`, \`)\`, \`[\`, \`]\`, \`{\`, and \`}\`. Decide whether the brackets are balanced.

A string is balanced when every opening bracket is closed by a bracket of the same kind, closings happen in the reverse order of openings (inner pairs close before outer ones), and no closing bracket appears without a matching opener. Return \`true\` if \`s\` is balanced and \`false\` otherwise.`,
  examples: [
    {
      input: 's = "{[()()]}"',
      output: "true",
      explanation: "The two () pairs close inside [], which closes inside {}.",
      args: ["{[()()]}"],
      expected: true,
    },
    {
      input: 's = "[(])"',
      output: "false",
      explanation: "The ] arrives while ( is still the most recent open bracket.",
      args: ["[(])"],
      expected: false,
    },
    {
      input: 's = "]"',
      output: "false",
      explanation: "A closing bracket with nothing open before it.",
      args: ["]"],
      expected: false,
    },
  ],
  constraints: ["1 ≤ s.length ≤ 10⁴", "s contains only the characters ()[]{}"],
  hints: [
    "When you meet a closing bracket, which opening bracket must it match?",
    "The bracket that must close next is always the most recently opened one that is still open. What structure gives you that for free?",
    "Push each opener onto a stack. On a closer, the stack must be non-empty and its top must be the matching opener; pop it. At the end, the stack must be empty.",
  ],
  keyIdea:
    "Push every opening bracket onto a stack. Each closing bracket must match the opener on top, which you then pop; a mismatch or an empty stack means the string is invalid. The string is balanced only if the stack is empty once every character is processed.",
  complexity: { time: "O(n)", space: "O(n)" },
  tags: ["string", "stack"],
  externalRefs: [{ label: "LeetCode 20", url: "https://leetcode.com/problems/valid-parentheses/" }],
});
