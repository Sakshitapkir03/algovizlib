import { definePattern } from "@/lib/catalog";

export const stackPattern = definePattern({
  slug: "stack",
  categorySlug: "dsa",
  group: "core",
  name: "Stack",
  summary:
    "Keep unfinished work on a last-in, first-out pile so the most recent open item is always the one you resolve next.",
  whenToUse: [
    "matching pairs that nest, like brackets or tags",
    "evaluating expressions or undoing steps in reverse order",
    '"next greater / next smaller" element for every position',
    "nested structure that must be expanded from the inside out",
  ],
  coreIdea:
    "Many problems have items that stay open until something later closes them, and the thing that closes first is always the most recently opened. A stack stores exactly those open items in the order they arrived, so the top is the only one that can be resolved next. In the monotonic variant you also pop every item the new element settles (for example, every earlier day colder than today) before pushing it, which keeps the stack sorted and means each element is pushed and popped at most once.",
  typicalComplexity: { time: "O(n)", space: "O(n)" },
  order: 8,
});
