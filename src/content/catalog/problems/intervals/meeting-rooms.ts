import { defineProblem } from "@/lib/catalog";

export const meetingRooms = defineProblem({
  slug: "meeting-rooms",
  patternSlug: "intervals",
  title: "Meeting Rooms",
  difficulty: "easy",
  order: 0,
  statement: `You're given a list of meetings, \`intervals\`, where \`intervals[i] = [start, end]\` means a meeting runs from time \`start\` up to time \`end\`. The list is in no particular order.

Return \`true\` if one person could attend every meeting, meaning no two meetings overlap, and \`false\` otherwise. A meeting that ends at time \`t\` and another that starts at time \`t\` don't overlap: you can walk straight from one to the next. An empty list returns \`true\`.`,
  examples: [
    {
      input: "intervals = [[9, 10], [13, 15], [10, 12]]",
      output: "true",
      explanation: "In time order: 9–10, 10–12, 13–15. The first two only touch at 10, which is allowed.",
      args: [
        [
          [9, 10],
          [13, 15],
          [10, 12],
        ],
      ],
      expected: true,
    },
    {
      input: "intervals = [[8, 11], [14, 16], [10, 12]]",
      output: "false",
      explanation: "The 10–12 meeting starts before the 8–11 meeting is over.",
      args: [
        [
          [8, 11],
          [14, 16],
          [10, 12],
        ],
      ],
      expected: false,
    },
    {
      input: "intervals = []",
      output: "true",
      explanation: "No meetings, so nothing can clash.",
      args: [[]],
      expected: true,
    },
  ],
  constraints: ["0 ≤ intervals.length ≤ 10⁴", "0 ≤ start < end ≤ 10⁶"],
  hints: [
    "Comparing every pair of meetings is O(n²). Would it help to look at the meetings in the order they happen?",
    "Once meetings are sorted by start time, which meetings could a given meeting possibly clash with?",
    "Sort by start. Walk through neighbours: if a meeting starts before the previous one ends, return `false`. If you get to the end, return `true`.",
  ],
  keyIdea:
    "Sort the meetings by start time. If any two meetings overlap, then some meeting overlaps the one immediately before it in this order, so a single pass checking `current.start < previous.end` is enough.",
  complexity: { time: "O(n log n)", space: "O(1) beyond the sort" },
  tags: ["array", "sorting"],
  externalRefs: [
    { label: "LeetCode 252", url: "https://leetcode.com/problems/meeting-rooms/", premium: true },
  ],
});
