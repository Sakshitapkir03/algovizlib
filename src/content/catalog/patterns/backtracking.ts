import { definePattern } from "@/lib/catalog";

export const backtrackingPattern = definePattern({
  slug: "backtracking",
  categorySlug: "dsa",
  group: "advanced",
  name: "Backtracking",
  summary:
    "Build a candidate one choice at a time, undo the last choice when it leads nowhere, and try the next option.",
  whenToUse: [
    "the answer is every subset, permutation, or combination",
    "placing items under constraints, like queens or sudoku digits",
    "input is small (often n ≤ 10–20) and the output can be exponential",
    "a partial choice can already be ruled out before it is finished",
  ],
  coreIdea:
    "Every candidate answer is a path in a decision tree: at each level you pick one option for the next slot. Backtracking walks that tree depth first with a single mutable partial answer: choose an option, recurse, then undo the choice so the same buffer is ready for the next option. Because the undo restores the exact previous state, you never copy work between branches. The speed comes from pruning: as soon as a partial answer breaks a constraint (a sum overshoots, two queens attack), the whole subtree below it is skipped. The worst case is still exponential, but that is often the size of the output itself.",
  typicalComplexity: {
    time: "O(branches^depth), e.g. O(n · 2ⁿ) or O(n · n!)",
    space: "O(depth) plus the output",
  },
  order: 17,
});
