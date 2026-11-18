import { definePattern } from "@/lib/catalog";

export const twoPointersPattern = definePattern({
  slug: "two-pointers",
  categorySlug: "dsa",
  name: "Two Pointers",
  summary:
    "Walk two indexes through a sequence, usually from both ends toward the middle, so each comparison rules out a whole group of candidates instead of one.",
  whenToUse: [
    "sorted input + find a pair (or triplet) with a given sum",
    "compare a sequence with its own reverse (palindromes)",
    "pick two boundaries to maximize or minimize something",
    "an O(n²) all-pairs check where one comparison tells you which side can't help",
  ],
  coreIdea:
    "Brute force looks at every pair of positions. Two pointers works when a single comparison between the current pair proves that one of the two positions can never be part of a better answer. You drop that position by moving its pointer inward and keep the other. Every step discards at least one candidate for good, so the pointers meet after at most n moves and the whole search takes one pass with constant extra memory.",
  typicalComplexity: { time: "O(n)", space: "O(1)" },
  order: 0,
});
