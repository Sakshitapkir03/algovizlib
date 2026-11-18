import { definePattern } from "@/lib/catalog";

export const slidingWindowPattern = definePattern({
  slug: "sliding-window",
  categorySlug: "dsa",
  name: "Sliding Window",
  summary:
    "Keep a contiguous range of an array or string and slide it forward, updating a running summary as one element enters and another leaves instead of recomputing from scratch.",
  whenToUse: [
    "contiguous subarray or substring",
    "fixed window size k",
    "longest/shortest range that satisfies a condition",
    "counts or sums you can update incrementally",
  ],
  coreIdea:
    "Neighbouring windows overlap almost entirely, so recomputing each one wastes work. Track a running state (a sum, a frequency map, a deque) and adjust it only for the element that enters on the right and the one that leaves on the left. For variable-size windows, grow the right edge until the window becomes valid or invalid, then shrink the left edge to restore the condition. Each index enters and leaves at most once, so the whole scan is linear.",
  typicalComplexity: { time: "O(n)", space: "O(1) or O(k) for the window state" },
  order: 1,
});
