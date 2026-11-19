import { definePattern } from "@/lib/catalog";

export const binarySearchPattern = definePattern({
  slug: "binary-search",
  categorySlug: "dsa",
  group: "core",
  name: "Binary Search",
  summary:
    "Repeatedly cut the search range in half by checking the middle and throwing away the half that can't hold the answer.",
  whenToUse: [
    "sorted input + find a value or its position",
    "a yes/no condition that flips once as a number grows (search on the answer)",
    "input sorted in pieces, like a rotated list",
    "you need better than O(n) on ordered data",
  ],
  coreIdea:
    "Binary search works whenever one comparison at the middle tells you which side the answer must be on. Order guarantees that: if the middle value is too small, everything to its left is too small as well, so that whole half can be dropped without looking at it. The same idea applies beyond arrays: if a condition is false up to some threshold and true after it, you can binary search over candidate answers to find that threshold. Halving the range each step means about log₂(n) steps instead of n.",
  typicalComplexity: { time: "O(log n)", space: "O(1)" },
  order: 7,
});
