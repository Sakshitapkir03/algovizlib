import { defineProblem } from "@/lib/catalog";

export const courseSchedule = defineProblem({
  slug: "course-schedule",
  patternSlug: "advanced-graphs",
  title: "Course Schedule",
  difficulty: "medium",
  order: 1,
  statement: `A program offers \`numCourses\` courses labeled \`0\` to \`numCourses - 1\`. Each entry \`prerequisites[i] = [a, b]\` means course \`b\` must be finished before you can start course \`a\`.

Return \`true\` if there is some order in which you can finish every course, and \`false\` if the requirements make that impossible.`,
  examples: [
    {
      input: "numCourses = 5, prerequisites = [[1, 0], [2, 1], [3, 2], [1, 3], [4, 0]]",
      output: "false",
      explanation:
        "Courses 0 and 4 can be taken, but 1 needs 3, 3 needs 2, and 2 needs 1: those three wait on each other forever.",
      args: [
        5,
        [
          [1, 0],
          [2, 1],
          [3, 2],
          [1, 3],
          [4, 0],
        ],
      ],
      expected: false,
    },
    {
      input: "numCourses = 4, prerequisites = [[1, 0], [2, 1], [3, 1], [3, 2]]",
      output: "true",
      explanation: "Take them in the order 0, 1, 2, 3; each course comes after everything it needs.",
      args: [
        4,
        [
          [1, 0],
          [2, 1],
          [3, 1],
          [3, 2],
        ],
      ],
      expected: true,
    },
    {
      input: "numCourses = 3, prerequisites = [[0, 1], [1, 2], [2, 0]]",
      output: "false",
      explanation: "0 needs 1, 1 needs 2, and 2 needs 0: a loop where none of them can go first.",
      args: [
        3,
        [
          [0, 1],
          [1, 2],
          [2, 0],
        ],
      ],
      expected: false,
    },
    {
      input: "numCourses = 2, prerequisites = []",
      output: "true",
      explanation: "With no requirements, any order works.",
      args: [2, []],
      expected: true,
    },
  ],
  constraints: [
    "1 ≤ numCourses ≤ 2000",
    "0 ≤ prerequisites.length ≤ 5000",
    "0 ≤ a, b < numCourses, a ≠ b",
    "No pair appears twice",
  ],
  hints: [
    "Draw an arrow from each prerequisite to the course that needs it. When is it impossible to finish everything?",
    "Some course must be takeable right away: one with no incoming arrows. What happens to the others once you take it?",
    "Kahn's algorithm: count incoming arrows per course, queue every course with zero, and each time you take one, decrement its dependents and queue any that reach zero. You can finish all courses exactly when you take `numCourses` of them.",
  ],
  keyIdea:
    "The prerequisites form a directed graph, and finishing every course means finding a topological order, which exists exactly when the graph has no cycle. Kahn's algorithm repeatedly removes a node with in-degree zero; nodes on a cycle never reach zero, so the count of removed nodes falls short of `numCourses` precisely when a cycle exists.",
  complexity: { time: "O(V + E)", space: "O(V + E)" },
  tags: ["graph", "topological sort", "cycle detection"],
  relatedPatterns: ["graphs-bfs"],
  externalRefs: [{ label: "LeetCode 207", url: "https://leetcode.com/problems/course-schedule/" }],
});
