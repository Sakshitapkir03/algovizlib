import { definePattern } from "@/lib/catalog";

export const heapPattern = definePattern({
  slug: "heap",
  categorySlug: "dsa",
  group: "trees-graphs",
  name: "Heap / Priority Queue",
  summary:
    "Keep a collection where the smallest (or largest) item is always one step away, even while items keep arriving and leaving.",
  whenToUse: [
    '"k largest", "k smallest", or "k most frequent" items',
    "repeatedly take the biggest or smallest item, change it, and put it back",
    "a running median or other order statistic over a stream",
    "merging several sorted sources into one ordered output",
  ],
  coreIdea:
    "A binary heap is a complete tree stored in an array where every parent is no larger (min-heap) or no smaller (max-heap) than its children. That one local rule guarantees the extreme item sits at the root, so peeking is O(1), while inserting or removing only has to repair a single root-to-leaf path, which is O(log n) long. You get the best item on demand without paying to keep everything sorted. For top-k questions, a heap capped at k items acts as a filter: the root is the weakest of the current winners, so each new item only has to beat that one to get in, giving O(n log k) instead of O(n log n).",
  typicalComplexity: { time: "O(n log k)", space: "O(k)" },
  order: 14,
});
