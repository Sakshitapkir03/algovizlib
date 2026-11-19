import { definePattern } from "@/lib/catalog";

export const intervalsPattern = definePattern({
  slug: "intervals",
  categorySlug: "dsa",
  group: "core",
  name: "Intervals",
  summary:
    "Sort ranges by where they start (or end), then sweep once, comparing each range only with the one before it.",
  whenToUse: [
    "input is a list of ranges like meetings, bookings, or [start, end] pairs",
    "merging, inserting, or counting overlapping ranges",
    "choosing the most ranges that don't overlap, or the fewest to remove",
    "answering many point queries against a set of ranges",
  ],
  coreIdea:
    "Two ranges can only overlap if one starts before the other ends. Once the ranges are sorted by start, any range that overlaps the current one must come right after it, so a single left-to-right sweep that remembers the end of the last kept (or merged) range sees every overlap without comparing all pairs. Sorting by end instead is the right order when you want to keep as many ranges as possible: always keeping the range that finishes first leaves the most room for the rest. Queries fit the same mold: sort them too, and move through ranges and queries together, often with a heap holding the ranges that are currently open.",
  typicalComplexity: { time: "O(n log n)", space: "O(n)" },
  order: 10,
});
