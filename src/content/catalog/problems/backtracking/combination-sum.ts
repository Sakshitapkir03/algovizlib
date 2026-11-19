import { defineProblem } from "@/lib/catalog";

export const combinationSum = defineProblem({
  slug: "combination-sum",
  patternSlug: "backtracking",
  title: "Combination Sum",
  difficulty: "medium",
  order: 3,
  statement: `You are given an array \`candidates\` of distinct positive integers and a positive integer \`target\`. Find every combination of candidates whose sum is exactly \`target\`. The same candidate may be used any number of times.

Two combinations are the same if they use each candidate the same number of times, so \`[3, 5]\` and \`[5, 3]\` count once. Return the list of all unique combinations, in any order, with the numbers inside each combination in any order. If no combination works, return an empty list \`[]\`.`,
  examples: [
    {
      input: "candidates = [2, 5, 3], target = 8",
      output: "[[2, 2, 2, 2], [2, 3, 3], [3, 5]]",
      explanation: "2 + 2 + 2 + 2, 2 + 3 + 3, and 3 + 5 all make 8. Using 5 twice overshoots.",
      args: [[2, 5, 3], 8],
      expected: [
        [2, 2, 2, 2],
        [2, 3, 3],
        [3, 5],
      ],
    },
    {
      input: "candidates = [4, 6], target = 12",
      output: "[[4, 4, 4], [6, 6]]",
      args: [[4, 6], 12],
      expected: [
        [4, 4, 4],
        [6, 6],
      ],
    },
    {
      input: "candidates = [4], target = 3",
      output: "[]",
      explanation: "The only candidate is already larger than the target.",
      args: [[4], 3],
      expected: [],
    },
  ],
  judge: "unordered-nested",
  constraints: ["1 ≤ candidates.length ≤ 30", "2 ≤ candidates[i] ≤ 40, all distinct", "1 ≤ target ≤ 40"],
  hints: [
    "If you pick candidates in any order you'll find [3, 5] and [5, 3] separately. How can you make each combination come out in only one order?",
    "Only allow choices at index `i` or later once you've chosen `candidates[i]`. Staying at `i` lets you reuse it; moving on means you're done with it.",
    "`dfs(start, remaining)`: if `remaining == 0`, save a copy. Otherwise for each `i ≥ start` with `candidates[i] ≤ remaining`, push it, call `dfs(i, remaining - candidates[i])`, and pop. Sorting first lets you `break` as soon as a candidate is too big.",
  ],
  keyIdea:
    "Generate each combination in non-decreasing index order so it appears exactly once: after choosing `candidates[i]`, the next choice comes from index `i` onward (staying on `i` allows repeats). Track the remaining amount and prune any branch where a candidate exceeds it; with sorted candidates, the first one too big ends the loop.",
  complexity: { time: "O(n^(target / min))", space: "O(target / min) recursion depth" },
  tags: ["array", "combinations", "pruning"],
  externalRefs: [{ label: "LeetCode 39", url: "https://leetcode.com/problems/combination-sum/" }],
});
