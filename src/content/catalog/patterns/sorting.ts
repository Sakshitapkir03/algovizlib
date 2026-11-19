import { definePattern } from "@/lib/catalog";

export const sortingPattern = definePattern({
  slug: "sorting",
  categorySlug: "dsa",
  group: "foundations",
  name: "Sorting Algorithms",
  summary:
    "Put items in order by repeatedly comparing and moving them. Each classic algorithm makes a different trade between simplicity, speed, memory, and stability.",
  whenToUse: [
    "you need the items in order before a later step can work (two pointers, binary search, merging)",
    "learning how comparisons and swaps turn disorder into order",
    "counting how far an array is from sorted (inversions)",
    "values come from a small known range, so you can count instead of compare",
  ],
  coreIdea:
    "Every sorting algorithm keeps some part of the array in a known state and grows it. Bubble, selection, and insertion sort grow a sorted prefix or suffix one element at a time, which costs O(n²) comparisons in the worst case. Merge sort and quick sort split the problem instead: merge sort sorts two halves and merges them in linear time, and quick sort places a pivot so that everything smaller sits to its left, giving about log n levels of linear work, O(n log n). Heap sort gets the same bound by keeping the unsorted part as a max-heap so the largest remaining item is always one swap away. Counting sort skips comparisons entirely when values lie in a small range, which is how it beats the O(n log n) limit that applies to comparison sorts.",
  typicalComplexity: { time: "O(n log n)", space: "O(n)" },
  order: 2,
});
