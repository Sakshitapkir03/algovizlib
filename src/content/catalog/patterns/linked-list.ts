import { definePattern } from "@/lib/catalog";

export const linkedListPattern = definePattern({
  slug: "linked-list",
  categorySlug: "dsa",
  name: "Linked List",
  summary:
    "Solve list problems by rewiring `next` pointers in place, usually with a dummy head and one or two walking pointers instead of copying values into an array.",
  whenToUse: [
    "input is a singly linked list and you must restructure it",
    "reverse, merge, split, or reorder nodes",
    "need the kth node from the end in one pass",
    "combine several sorted sequences into one",
  ],
  coreIdea:
    'A linked list has no indexes, but every change is just a pointer swap, so you can restructure it in O(1) extra space. Keep a small set of pointers (previous, current, next, or a fast/slow pair) and update them in a fixed order so no node is ever lost. A dummy node in front of the head removes the special case of changing the first node, and a fixed gap between two pointers turns "from the end" into "from the front".',
  typicalComplexity: { time: "O(n)", space: "O(1)" },
  order: 4,
});
