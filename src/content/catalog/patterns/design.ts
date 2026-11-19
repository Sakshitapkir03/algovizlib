import { definePattern } from "@/lib/catalog";

export const designPattern = definePattern({
  slug: "design",
  categorySlug: "dsa",
  group: "advanced",
  name: "Data Structure Design",
  summary:
    "Build a class whose operations all hit a target cost by combining simpler structures, such as a hash map with a linked list or a stack with a running minimum.",
  whenToUse: [
    "implement a class with several methods + required time per operation",
    "a cache with an eviction rule (least recently or least frequently used)",
    "one structure is fast at lookup, another is fast at ordering, and you need both",
    "queries over history, like the value at a given time or the minimum so far",
  ],
  coreIdea:
    "No single built-in structure is fast at everything, so you pair structures that cover each other's weak spots and keep them in sync on every update. A hash map gives O(1) lookup by key but no order; a doubly linked list gives O(1) reordering and removal at a known node but slow lookup; storing list nodes in the map gets both. The same move appears in smaller forms: a stack that also records the minimum at each depth, two stacks that together act as a queue, or a sorted list per key for time lookups. Start from the operations and their required costs, pick a structure for each, and make sure every method updates all of them together.",
  typicalComplexity: { time: "O(1) or O(log n) per operation", space: "O(n)" },
  order: 19,
});
