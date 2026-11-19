import { defineProblem } from "@/lib/catalog";

export const circularArrayLoop = defineProblem({
  slug: "circular-array-loop",
  patternSlug: "fast-slow-pointers",
  title: "Circular Array Loop",
  difficulty: "hard",
  order: 4,
  statement: `Picture \`nums\` as a ring of positions, where the end wraps around to the start and the start wraps around to the end. Every value is non-zero and is a jump: from index \`i\`, move \`nums[i]\` steps forward if it's positive, or \`|nums[i]|\` steps backward if it's negative, wrapping around the ring.

A valid loop is a sequence of indices that you keep jumping through forever, where:
- following the jumps from any index in it returns to that index,
- every value in it has the same sign (all forward or all backward), and
- it contains more than one index (an index that jumps onto itself doesn't count).

Return \`true\` if \`nums\` contains at least one valid loop, and \`false\` otherwise.`,
  examples: [
    {
      input: "nums = [3, 1, -2, 2, 1]",
      output: "true",
      explanation:
        "Index 0 jumps 3 forward to index 3, which jumps 2 forward and wraps to index 0. Both jumps go forward, and the loop has two indices.",
      args: [[3, 1, -2, 2, 1]],
      expected: true,
    },
    {
      input: "nums = [2, 4, -1, 1]",
      output: "false",
      explanation:
        "Index 1 jumps 4 forward around a ring of 4 and lands on itself, which is too short. Every other path switches direction before it repeats.",
      args: [[2, 4, -1, 1]],
      expected: false,
    },
    {
      input: "nums = [2, -1, 1, -2, -2]",
      output: "false",
      explanation:
        "Following jumps from any start eventually moves from a forward jump to a backward one (or the reverse), so no loop keeps one direction.",
      args: [[2, -1, 1, -2, -2]],
      expected: false,
    },
  ],
  constraints: ["1 ≤ nums.length ≤ 5000", "-1000 ≤ nums[i] ≤ 1000", "nums[i] ≠ 0"],
  hints: [
    "From each index there's exactly one next index, so this is a set of chains that each end in a cycle. How would you detect a cycle on one chain with two pointers?",
    "Run slow and fast pointers from each start, but stop as soon as either would step onto a value with the opposite sign, or onto an index that jumps to itself. If they still meet, you've found a valid loop.",
    "To stay linear, once a start fails, walk its chain again from the start and zero out (or mark) every index with the same sign. Those indices can never be part of a valid loop, so later starts skip them immediately.",
  ],
  keyIdea:
    "Each index has one outgoing jump, so following jumps from any start leads into a cycle. Use fast and slow pointers from each unvisited start, but only allow moves that keep the starting direction and don't land on a self-loop; if the pointers meet, that cycle is valid. When a start fails, mark every index along its same-direction path as dead, so each index is processed a constant number of times overall.",
  complexity: { time: "O(n)", space: "O(1)" },
  tags: ["array", "floyd's cycle detection", "simulation"],
  externalRefs: [{ label: "LeetCode 457", url: "https://leetcode.com/problems/circular-array-loop/" }],
});
