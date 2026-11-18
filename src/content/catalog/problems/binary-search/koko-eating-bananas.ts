import { defineProblem } from "@/lib/catalog";

export const kokoEatingBananas = defineProblem({
  slug: "koko-eating-bananas",
  patternSlug: "binary-search",
  title: "Koko Eating Bananas",
  difficulty: "medium",
  order: 3,
  statement: `Koko has several piles of bananas, where \`piles[i]\` is the number of bananas in pile \`i\`, and \`h\` hours before the zookeeper comes back.

She picks a fixed eating speed \`k\` (bananas per hour). Each hour she chooses one pile and eats up to \`k\` bananas from it. If the pile has fewer than \`k\` left, she finishes it and waits out the rest of that hour without starting another pile.

Return the smallest whole number \`k\` that lets her finish every pile within \`h\` hours.`,
  examples: [
    {
      input: "piles = [4, 9, 13, 6], h = 7",
      output: "6",
      explanation:
        "At speed 6 the piles take 1 + 2 + 3 + 1 = 7 hours. At speed 5 they take 1 + 2 + 3 + 2 = 8 hours, which is too slow.",
      args: [[4, 9, 13, 6], 7],
      expected: 6,
    },
    {
      input: "piles = [10, 15, 20], h = 3",
      output: "20",
      explanation: "With one hour per pile, she must clear the biggest pile in a single hour.",
      args: [[10, 15, 20], 3],
      expected: 20,
    },
    {
      input: "piles = [7], h = 10",
      output: "1",
      explanation: "Even one banana per hour finishes in 7 hours, and speed can't go below 1.",
      args: [[7], 10],
      expected: 1,
    },
  ],
  constraints: ["1 ≤ piles.length ≤ h ≤ 10⁹", "1 ≤ piles[i] ≤ 10⁹", "piles.length ≤ 10⁴"],
  hints: [
    "If speed `k` is fast enough, is every speed above `k` also fast enough?",
    "The answer lies between 1 and the largest pile. For a given speed, you can count the hours needed in one pass: each pile takes `ceil(pile / k)` hours.",
    "Binary search over speeds: if `mid` finishes within `h` hours, it might be the answer, so search `[low, mid]`; otherwise search `[mid + 1, high]`.",
  ],
  keyIdea:
    'The hours needed only go down as the speed goes up, so "finishes in time" is false for slow speeds and true from some speed onward. Binary search over speeds 1 to max(piles) to find that first true speed, checking each candidate in O(n).',
  complexity: { time: "O(n log m), m = max(piles)", space: "O(1)" },
  tags: ["array", "search-on-answer"],
  externalRefs: [{ label: "LeetCode 875", url: "https://leetcode.com/problems/koko-eating-bananas/" }],
});
