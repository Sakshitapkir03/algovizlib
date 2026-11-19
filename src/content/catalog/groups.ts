import { definePatternGroup } from "@/lib/catalog";

/** The sections of the /dsa page, in order. Each pattern names its group with `group`. */
export const patternGroups = [
  definePatternGroup({
    slug: "foundations",
    name: "Foundations",
    summary: "The building blocks every other pattern leans on: hashing, running totals, sorting, and bits.",
    order: 0,
  }),
  definePatternGroup({
    slug: "core",
    name: "Core patterns",
    summary:
      "The techniques behind most array, string, and list problems, from pointers and windows to greedy choices.",
    order: 1,
  }),
  definePatternGroup({
    slug: "trees-graphs",
    name: "Trees & Graphs",
    summary: "Walking connected structures, and the heaps and tries that make those walks fast.",
    order: 2,
  }),
  definePatternGroup({
    slug: "advanced",
    name: "Advanced",
    summary: "Exploring every choice, reusing overlapping work, and designing data structures to a spec.",
    order: 3,
  }),
];
