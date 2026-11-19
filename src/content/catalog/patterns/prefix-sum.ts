import { definePattern } from "@/lib/catalog";

export const prefixSumPattern = definePattern({
  slug: "prefix-sum",
  categorySlug: "dsa",
  group: "foundations",
  name: "Prefix Sum",
  summary: "Precompute running totals once so the sum of any contiguous range becomes a single subtraction.",
  whenToUse: [
    "many questions about sums of contiguous ranges",
    "counting subarrays whose sum equals some value",
    "balancing what lies to the left of a position against what lies to the right",
    "combining everything before an index with everything after it",
  ],
  coreIdea:
    "Let `prefix[i]` be the total of the first `i` elements. The sum of `nums[l..r]` is then `prefix[r + 1] - prefix[l]`, because the shared part before `l` cancels out. One O(n) pass turns every later range query into O(1) work. The same identity runs backwards for counting: a subarray ending at `r` sums to `k` exactly when some earlier prefix equals `prefix[r + 1] - k`, so a hash map of prefix counts answers it on the fly. The idea generalizes to other associative operations (products, XOR) and to two dimensions, where a rectangle's sum comes from four corner totals.",
  typicalComplexity: { time: "O(n) to build, O(1) per query", space: "O(n)" },
  order: 1,
});
