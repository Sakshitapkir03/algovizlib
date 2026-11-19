import { definePattern } from "@/lib/catalog";

export const arraysHashingPattern = definePattern({
  slug: "arrays-hashing",
  categorySlug: "dsa",
  group: "foundations",
  name: "Arrays & Hashing",
  summary:
    "Trade a little memory for speed: remember what you have already seen in a hash map or set so each new element is answered in constant time.",
  whenToUse: [
    '"have I seen this value (or its complement) before?" questions',
    "counting how often things occur, or comparing two multisets",
    "grouping items that share a computed key",
    "an O(n²) pairwise scan that only needs a fast lookup to become O(n)",
  ],
  coreIdea:
    "A brute-force search usually compares each element with every other element because it has no memory of what came before. A hash map or set gives you that memory: after one pass, any value (or a key computed from it, such as a sorted word or a character count) can be looked up in expected O(1) time. So instead of asking every earlier element whether it fits, you ask the table once. The same idea covers counting (map value to frequency), grouping (map a canonical key to a bucket), and existence checks (a set). When even the extra memory is not allowed, the array itself can sometimes serve as the table, using each index as the slot for one value.",
  typicalComplexity: { time: "O(n)", space: "O(n)" },
  order: 0,
});
