import { defineProblem } from "@/lib/catalog";

export const lastStoneWeight = defineProblem({
  slug: "last-stone-weight",
  patternSlug: "heap",
  title: "Last Stone Weight",
  difficulty: "easy",
  order: 0,
  statement: `You have a pile of stones, and \`stones[i]\` is the weight of stone \`i\`. Each turn, pick up the two heaviest stones in the pile and smash them together. Say their weights are \`x ≤ y\`:

- if \`x == y\`, both stones are destroyed;
- otherwise the lighter stone is destroyed and the heavier one goes back into the pile with weight \`y - x\`.

Keep going until at most one stone is left. Return the weight of that last stone, or \`0\` if no stones remain.`,
  examples: [
    {
      input: "stones = [3, 8, 5, 2, 6]",
      output: "2",
      explanation:
        "Smash 8 and 6 → 2, pile [3, 5, 2, 2]. Smash 5 and 3 → 2, pile [2, 2, 2]. Smash 2 and 2 → nothing, pile [2]. One stone of weight 2 is left.",
      args: [[3, 8, 5, 2, 6]],
      expected: 2,
    },
    {
      input: "stones = [7, 7]",
      output: "0",
      explanation: "The two stones weigh the same, so both are destroyed and nothing remains.",
      args: [[7, 7]],
      expected: 0,
    },
    {
      input: "stones = [4]",
      output: "4",
      explanation: "A single stone never gets smashed.",
      args: [[4]],
      expected: 4,
    },
  ],
  constraints: ["1 ≤ stones.length ≤ 30", "1 ≤ stones[i] ≤ 1000"],
  hints: [
    "Every turn needs the two largest values of a collection that keeps changing. Re-sorting each turn works but is wasteful.",
    "Which data structure gives you the largest item quickly and still lets you insert a new one cheaply?",
    "Put all stones in a max-heap. While it holds more than one stone, pop two; if they differ, push their difference back. Return the remaining stone or 0.",
  ],
  keyIdea:
    "A max-heap always exposes the heaviest stone at its root. Each turn is two pops and at most one push, each O(log n), and every turn removes at least one stone, so the whole simulation is O(n log n).",
  complexity: { time: "O(n log n)", space: "O(n)" },
  tags: ["array", "heap", "simulation"],
  externalRefs: [{ label: "LeetCode 1046", url: "https://leetcode.com/problems/last-stone-weight/" }],
});
