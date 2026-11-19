import { definePattern } from "@/lib/catalog";

export const fastSlowPointersPattern = definePattern({
  slug: "fast-slow-pointers",
  categorySlug: "dsa",
  group: "core",
  name: "Fast & Slow Pointers",
  summary:
    "Walk two pointers through the same sequence at different speeds, so their gap reveals loops, midpoints, and where a cycle begins.",
  whenToUse: [
    "detecting whether a linked list or a sequence of jumps loops back on itself",
    "finding the middle of a list in one pass without knowing its length",
    "locating the entry point of a cycle with constant extra space",
    "an array whose values are valid indices, so it can be read as a chain of next pointers",
  ],
  coreIdea:
    "If one runner moves one step at a time and another moves two, the fast one gains exactly one step per round. On a path with no loop the fast runner simply reaches the end first, and at that moment the slow one is halfway, which gives you the middle. On a path that loops, both runners end up circling the loop, and because the gap between them shrinks by one each round, the fast runner cannot jump over the slow one: they must land on the same node. A little arithmetic on the distances they covered then shows that a pointer restarted from the beginning and a pointer left at the meeting point, both moving one step at a time, meet exactly where the loop starts. All of this uses two variables instead of a set of visited nodes.",
  typicalComplexity: { time: "O(n)", space: "O(1)" },
  order: 5,
});
