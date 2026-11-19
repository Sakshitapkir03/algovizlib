import { definePattern } from "@/lib/catalog";

export const greedyPattern = definePattern({
  slug: "greedy",
  categorySlug: "dsa",
  group: "core",
  name: "Greedy",
  summary:
    "Make the choice that looks best right now, never revisit it, and prove that a locally best choice can't hurt the final answer.",
  whenToUse: [
    "a single pass where each step has an obviously safe move",
    "reachability or feasibility questions (can you get to the end?)",
    "minimizing or maximizing a count under simple neighbor rules",
    "an exchange argument shows any optimal answer can be rearranged to match yours",
  ],
  coreIdea:
    "A greedy algorithm commits to one choice per step instead of exploring all of them. That only works when the problem has a safe choice: some option that at least one optimal solution also takes, so committing to it never closes the door on the best answer. You justify it with an exchange argument (swap an optimal solution's choice for yours and show it gets no worse) or an invariant (the farthest index reachable so far, the earliest point a running total went negative). Once the choice is safe, the problem shrinks to a smaller copy of itself, which is why greedy solutions are usually a single pass, sometimes after a sort.",
  typicalComplexity: { time: "O(n) or O(n log n) with sorting", space: "O(1)" },
  order: 11,
});
