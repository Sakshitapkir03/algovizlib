import { defineProblem } from "@/lib/catalog";

export const validPalindrome = defineProblem({
  slug: "valid-palindrome",
  patternSlug: "two-pointers",
  title: "Valid Palindrome",
  difficulty: "easy",
  order: 1,
  statement: `You're given a string \`s\`. Keep only its letters and digits, treat uppercase and lowercase letters as the same, and decide whether what's left reads identically forwards and backwards.

Return \`true\` if it does and \`false\` otherwise. A string with no letters or digits counts as a palindrome.`,
  examples: [
    {
      input: 's = "Was it a car or a cat I saw?"',
      output: "true",
      explanation: 'Cleaned up, it becomes "wasitacaroracatisaw", which is the same reversed.',
      args: ["Was it a car or a cat I saw?"],
      expected: true,
    },
    {
      input: 's = "Hello, olleh 1"',
      output: "false",
      explanation: 'Cleaned up, it becomes "helloolleh1". The first character is "h" but the last is "1".',
      args: ["Hello, olleh 1"],
      expected: false,
    },
    {
      input: 's = ".,! ?"',
      output: "true",
      explanation:
        "Nothing is left after removing punctuation and spaces, and an empty string is a palindrome.",
      args: [".,! ?"],
      expected: true,
    },
    {
      input: 's = "Taco cat!"',
      output: "true",
      explanation: 'Skipping the space and the "!" leaves "tacocat", which reads the same both ways.',
      args: ["Taco cat!"],
      expected: true,
    },
  ],
  constraints: ["1 ≤ s.length ≤ 2 × 10⁵", "s contains printable ASCII characters only"],
  hints: [
    "You could build a cleaned copy and reverse it, but can you check it without making any copies?",
    "Compare the first meaningful character with the last meaningful one. What should happen to characters that aren't letters or digits?",
    "Keep an index at each end. Skip anything that isn't a letter or digit, compare the two characters case-insensitively, and move both inward until they meet.",
  ],
  keyIdea:
    "Place one pointer at the start and one at the end. Each pointer skips characters that don't count; then the two characters must match ignoring case, or the answer is false. If the pointers meet without a mismatch, the string is a palindrome.",
  complexity: { time: "O(n)", space: "O(1)" },
  tags: ["string", "palindrome"],
  externalRefs: [{ label: "LeetCode 125", url: "https://leetcode.com/problems/valid-palindrome/" }],
});
