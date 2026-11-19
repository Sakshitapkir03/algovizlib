import { defineProblem } from "@/lib/catalog";

export const findMedianFromDataStream = defineProblem({
  slug: "find-median-from-data-stream",
  patternSlug: "heap",
  title: "Find Median from Data Stream",
  difficulty: "hard",
  order: 4,
  statement: `Numbers arrive one at a time, and at any moment you may be asked for the median of everything received so far. The median is the middle value after sorting; when the count is even, it is the average of the two middle values (so it may be a fraction such as \`3.5\`).

Design a class \`MedianFinder\`:

- \`MedianFinder()\` creates an empty finder.
- \`addNum(num)\` adds the integer \`num\` to the data seen so far.
- \`findMedian()\` returns the median of all numbers added so far.

\`findMedian\` is only called after at least one number has been added. Both methods should be fast even after many calls.`,
  examples: [
    {
      input:
        "MedianFinder, addNum(6), findMedian(), addNum(2), findMedian(), addNum(9), findMedian(), addNum(1), findMedian()",
      output: "null, null, 6, null, 4, null, 6, null, 4",
      explanation:
        "After [6] the median is 6. After [2, 6] it is (2 + 6) / 2 = 4. After [2, 6, 9] it is 6. After [1, 2, 6, 9] it is (2 + 6) / 2 = 4.",
      args: [
        [
          "MedianFinder",
          "addNum",
          "findMedian",
          "addNum",
          "findMedian",
          "addNum",
          "findMedian",
          "addNum",
          "findMedian",
        ],
        [[], [6], [], [2], [], [9], [], [1], []],
      ],
      expected: [null, null, 6, null, 4, null, 6, null, 4],
    },
    {
      input: "MedianFinder, addNum(3), addNum(4), findMedian()",
      output: "null, null, null, 3.5",
      explanation: "The two middle values are 3 and 4, so the median is 3.5.",
      args: [
        ["MedianFinder", "addNum", "addNum", "findMedian"],
        [[], [3], [4], []],
      ],
      expected: [null, null, null, 3.5],
    },
    {
      input: "MedianFinder, addNum(-5), findMedian(), addNum(-5), findMedian()",
      output: "null, null, -5, null, -5",
      explanation: "Negative numbers and duplicates are handled like any others.",
      args: [
        ["MedianFinder", "addNum", "findMedian", "addNum", "findMedian"],
        [[], [-5], [], [-5], []],
      ],
      expected: [null, null, -5, null, -5],
    },
  ],
  exampleFormat: "operations",
  constraints: [
    "-10⁵ ≤ num ≤ 10⁵",
    "at most 5 × 10⁴ calls in total to addNum and findMedian",
    "findMedian is called only when at least one number has been added",
  ],
  hints: [
    "Keeping a fully sorted list makes findMedian easy but each insert costs O(n). You only ever need the one or two values in the middle.",
    "Split the numbers into a lower half and an upper half. What do you need to know about each half to read off the median?",
    "Store the lower half in a max-heap and the upper half in a min-heap, keeping their sizes equal or the lower half one larger. Insert into the right side, rebalance by moving one root across, and read the median from the root(s).",
  ],
  keyIdea:
    "Two heaps hold the halves of the data: a max-heap for the smaller half and a min-heap for the larger half, with sizes differing by at most one. The median is always at the top of one or both heaps, so addNum is O(log n) (one push plus at most one move between heaps) and findMedian is O(1).",
  complexity: { time: "O(log n) per addNum, O(1) per findMedian", space: "O(n)" },
  tags: ["design", "heap", "data stream"],
  relatedPatterns: ["design"],
  externalRefs: [
    { label: "LeetCode 295", url: "https://leetcode.com/problems/find-median-from-data-stream/" },
  ],
});
