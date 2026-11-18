import { defineProblem } from "@/lib/catalog";

export const decodeString = defineProblem({
  slug: "decode-string",
  patternSlug: "stack",
  title: "Decode String",
  difficulty: "medium",
  order: 3,
  statement: `A compressed string uses the form \`k[text]\` to mean "\`text\` written out \`k\` times", where \`k\` is a positive integer that may have several digits. These groups can be nested, so \`2[a3[b]]\` means \`abbbabbb\`. Letters outside any brackets are copied as they are.

Given a valid compressed string \`s\`, return the fully expanded string.`,
  examples: [
    {
      input: 's = "2[ab]c"',
      output: '"ababc"',
      explanation: '"ab" twice, then "c".',
      args: ["2[ab]c"],
      expected: "ababc",
    },
    {
      input: 's = "3[x2[yz]]w"',
      output: '"xyzyzxyzyzxyzyzw"',
      explanation: 'The inner group gives "yzyz", so each outer copy is "xyzyz"; three copies, then "w".',
      args: ["3[x2[yz]]w"],
      expected: "xyzyzxyzyzxyzyzw",
    },
    {
      input: 's = "k10[z]"',
      output: '"kzzzzzzzzzz"',
      explanation: "Repeat counts can have more than one digit.",
      args: ["k10[z]"],
      expected: "kzzzzzzzzzz",
    },
  ],
  constraints: [
    "1 ≤ s.length ≤ 30",
    "s contains lowercase letters, digits, and square brackets, and is always well formed",
    "Digits appear only as repeat counts, each between 1 and 300",
    "The expanded string has length ≤ 10⁵",
  ],
  hints: [
    "The innermost group has to be expanded before the group around it. What does that remind you of?",
    "When you hit `[`, you're starting a new piece of text, but you'll need to come back to what you had before and the count that goes with it.",
    "Keep a stack of (text so far, repeat count) pairs. On `[`, push the current text and count and start fresh. On `]`, pop, and set the current text to the popped text plus the current text repeated count times.",
  ],
  keyIdea:
    "Build the answer in a current buffer while reading digits into a number. An opening bracket saves the buffer and the count on a stack and starts an empty buffer; a closing bracket pops them and replaces the buffer with the saved text followed by the inner text repeated. Nesting is handled naturally because inner groups close first.",
  complexity: { time: "O(output length)", space: "O(output length)" },
  tags: ["string", "stack", "recursion"],
  externalRefs: [{ label: "LeetCode 394", url: "https://leetcode.com/problems/decode-string/" }],
});
