import { defineProblem } from "@/lib/catalog";

export const kClosestPointsToOrigin = defineProblem({
  slug: "k-closest-points-to-origin",
  patternSlug: "heap",
  title: "K Closest Points to Origin",
  difficulty: "medium",
  order: 3,
  statement: `You are given a list of points on a plane, where \`points[i] = [x, y]\`, and an integer \`k\`. Return the \`k\` points closest to the origin \`(0, 0)\`, measured by ordinary straight-line (Euclidean) distance.

You may return the points in any order. The input is chosen so the answer is unique: no two points tie for the last spot.`,
  examples: [
    {
      input: "points = [[2, 3], [-1, 1], [4, 0], [0, -2]], k = 2",
      output: "[[-1, 1], [0, -2]]",
      explanation: "Squared distances are 13, 2, 16, and 4. The two smallest belong to [-1, 1] and [0, -2].",
      args: [
        [
          [2, 3],
          [-1, 1],
          [4, 0],
          [0, -2],
        ],
        2,
      ],
      expected: [
        [-1, 1],
        [0, -2],
      ],
    },
    {
      input: "points = [[5, -5], [1, 7], [-3, 2]], k = 1",
      output: "[[-3, 2]]",
      explanation: "Squared distances are 50, 50, and 13, so [-3, 2] is the closest.",
      args: [
        [
          [5, -5],
          [1, 7],
          [-3, 2],
        ],
        1,
      ],
      expected: [[-3, 2]],
    },
    {
      input: "points = [[1, 1], [-2, 2]], k = 2",
      output: "[[1, 1], [-2, 2]]",
      explanation: "When k equals the number of points, every point is returned.",
      args: [
        [
          [1, 1],
          [-2, 2],
        ],
        2,
      ],
      expected: [
        [1, 1],
        [-2, 2],
      ],
    },
  ],
  judge: "unordered",
  constraints: [
    "1 ≤ k ≤ points.length ≤ 10⁴",
    "-10⁴ ≤ x, y ≤ 10⁴",
    "the k closest points are unique (no tie at the cutoff)",
  ],
  hints: [
    "You never need the actual distance, only which is smaller. Comparing x² + y² avoids square roots.",
    "This is a top-k question: keep the k best candidates and be able to evict the worst of them quickly.",
    "Use a max-heap keyed by squared distance, capped at k. Push each point; when the heap exceeds k, pop the farthest. The heap's contents are the answer.",
  ],
  keyIdea:
    "Rank points by squared distance and keep the k nearest in a max-heap. The root is the farthest of the current k, so any new point closer than it takes its place. Each point costs O(log k).",
  complexity: { time: "O(n log k)", space: "O(k)" },
  tags: ["array", "geometry", "heap"],
  externalRefs: [{ label: "LeetCode 973", url: "https://leetcode.com/problems/k-closest-points-to-origin/" }],
});
