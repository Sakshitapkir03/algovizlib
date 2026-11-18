import { defineStoryboard, estimateDurationInFrames, type SceneInput } from "@/lib/storyboard";

/**
 * Two Pointers — pair sum on a sorted array, told as two friends spending a
 * $50 gift card on a price-sorted shelf. exampleSource: "analogy".
 *
 * Trace (src/lib/traces/two-pointers/pair-with-target-sum.ts) for values [4, 9, 14, 21, 28, 36, 45], target 50.
 * Scenes bind to these steps with `traceStep`:
 *   #0 (0,6) 4+45=49 <  → You move right
 *   #1 (1,6) 9+45=54 >  → Friend moves left
 *   #2 (1,5) 9+36=45 <  → You move right
 *   #3 (2,5) 14+36=50 = → found
 */

const TARGET = 50;
const SHELF = [
  { label: "Stickers", value: 4 },
  { label: "Notebook", value: 9 },
  { label: "Mug", value: 14 },
  { label: "Desk lamp", value: 21 },
  { label: "Backpack", value: 28 },
  { label: "Headphones", value: 36 },
  { label: "Sneakers", value: 45 },
];
const VALUES = SHELF.map((item) => item.value);

const shelf = { id: "shelf", type: "item-row", items: SHELF, unit: "$" } as const;

const you = (index: number, fromIndex?: number) =>
  ({
    id: "you",
    type: "pointer",
    rowId: "shelf",
    label: "You",
    index,
    fromIndex,
    binds: "left",
    tone: "primary",
  }) as const;
const friend = (index: number, fromIndex?: number) =>
  ({
    id: "friend",
    type: "pointer",
    rowId: "shelf",
    label: "Friend",
    index,
    fromIndex,
    binds: "right",
    tone: "secondary",
  }) as const;

/** Fill in durationInFrames from narration length (replaced by audio later). */
function scene(input: Omit<SceneInput, "durationInFrames">): SceneInput {
  return { ...input, durationInFrames: estimateDurationInFrames(input.narration) };
}

export const twoPointersStoryboard = defineStoryboard({
  id: "two-pointers",
  title: "Two Pointers: Pair Sum on a Sorted Array",
  concept: "Two Pointers",
  category: "dsa",
  summary: "Spend a $50 gift card exactly by walking in from both ends of a price-sorted shelf.",
  exampleSource: "analogy",
  analogy: {
    scenario:
      "A shelf of items sorted by price. You start at the cheap end, your friend at the expensive end, and together you look for two items that use up a $50 gift card exactly.",
    mapping: [
      { real: "Shelf sorted by price", abstract: "Sorted array" },
      { real: "Item price", abstract: "Array value" },
      { real: "You (cheap end)", abstract: "left index" },
      { real: "Friend (expensive end)", abstract: "right index" },
      { real: "$50 gift card", abstract: "target sum" },
    ],
  },
  tags: ["Arrays", "Sorting", "Two Pointers"],
  takeaway: {
    pattern: "Two Pointers (opposite ends)",
    summary:
      "On sorted data, start one pointer at each end. If the sum is too small, move the left pointer right; if it is too big, move the right pointer left. Each comparison rules out one item for good.",
    timeComplexity: "O(n)",
    spaceComplexity: "O(1)",
    whenToUse: [
      "The input is sorted (or sorting it first is acceptable)",
      "You need a pair (or window) that meets a target",
      "Moving one end changes the answer in a predictable direction",
    ],
  },
  trace: { problem: "two-pointers/pair-with-target-sum", args: [VALUES, TARGET] },
  scenes: [
    scene({
      id: "problem",
      caption: "Two items. One $50 gift card. Zero change.",
      narration:
        "You and a friend have a fifty dollar gift card, and you want to spend it exactly — no change left over. The store's shelf is sorted by price, from four dollar stickers up to forty-five dollar sneakers. Which two items add up to exactly fifty?",
      elements: [
        shelf,
        { id: "goal", type: "callout", text: "Find two items that total exactly $50", enterAt: 0.35 },
      ],
    }),
    scene({
      id: "brute-force",
      caption: "Checking every pair is slow",
      narration:
        "The obvious approach is to try every pair: stickers with the notebook, stickers with the mug, and so on. With seven items that's twenty-one pairs. With a thousand items it's almost half a million. We're ignoring a big clue: the shelf is already sorted.",
      elements: [
        shelf,
        { id: "trying", type: "highlight", rowId: "shelf", indices: [0, 2], state: "active", enterAt: 0.1 },
        {
          id: "pairs",
          type: "callout",
          text: "Stickers + Mug? Stickers + Lamp? …",
          anchor: { rowId: "shelf", index: 0 },
          enterAt: 0.15,
        },
        {
          id: "cost",
          type: "result",
          title: "Every pair",
          value: "21 checks for 7 items",
          detail: "1,000 items → 499,500 checks",
          tone: "info",
          enterAt: 0.45,
        },
      ],
    }),
    scene({
      id: "idea",
      traceStep: 0,
      caption: "Start at both ends of the shelf",
      narration:
        "Here's a smarter plan. You stand at the cheap end, and your friend stands at the expensive end. Add your two prices. If the total is too low, you step toward pricier items. If it's too high, your friend steps toward cheaper ones.",
      elements: [
        shelf,
        you(0),
        friend(6),
        {
          id: "rule",
          type: "callout",
          text: "Too low → You step right. Too high → Friend steps left.",
          enterAt: 0.4,
        },
      ],
    }),
    scene({
      id: "check-1",
      traceStep: 0,
      caption: "$49 is too low — You move right",
      narration:
        "Stickers plus sneakers is forty-nine dollars, one short. Sneakers are already the most expensive item, so the stickers can't reach fifty with anything. Stickers are out — you step right.",
      elements: [
        shelf,
        you(0),
        friend(6),
        { id: "pair", type: "highlight", rowId: "shelf", indices: [0, 6], state: "active" },
        {
          id: "sum",
          type: "equation",
          terms: [4, 45],
          result: 49,
          comparison: { op: "<", target: TARGET },
          unit: "$",
          verdict: "too low",
          enterAt: 0.1,
        },
        {
          id: "why",
          type: "callout",
          text: "Even the priciest item isn't enough for me",
          speaker: "You",
          anchor: { rowId: "shelf", index: 0 },
          enterAt: 0.45,
        },
      ],
    }),
    scene({
      id: "check-2",
      traceStep: 1,
      caption: "$54 is too high — Friend moves left",
      narration:
        "Now it's the notebook plus the sneakers: fifty-four dollars, too much. The notebook is the cheapest item still in play, so the sneakers will overshoot with anything. Sneakers are out — your friend steps left.",
      elements: [
        shelf,
        you(1, 0),
        friend(6),
        { id: "out", type: "highlight", rowId: "shelf", indices: [0], state: "rejected" },
        { id: "pair", type: "highlight", rowId: "shelf", indices: [1, 6], state: "active", enterAt: 0.1 },
        {
          id: "sum",
          type: "equation",
          terms: [9, 45],
          result: 54,
          comparison: { op: ">", target: TARGET },
          unit: "$",
          verdict: "too high",
          enterAt: 0.15,
        },
        {
          id: "why",
          type: "callout",
          text: "Even the cheapest item is too much with me",
          speaker: "Friend",
          anchor: { rowId: "shelf", index: 6 },
          enterAt: 0.5,
        },
      ],
    }),
    scene({
      id: "check-3",
      traceStep: 2,
      caption: "$45 is too low — You move right again",
      narration:
        "Notebook plus headphones is forty-five dollars, too low again. Same reasoning: the notebook can't reach fifty with anything left, so you step right to the mug.",
      elements: [
        shelf,
        you(1),
        friend(5, 6),
        { id: "out", type: "highlight", rowId: "shelf", indices: [0, 6], state: "rejected" },
        { id: "pair", type: "highlight", rowId: "shelf", indices: [1, 5], state: "active", enterAt: 0.1 },
        {
          id: "sum",
          type: "equation",
          terms: [9, 36],
          result: 45,
          comparison: { op: "<", target: TARGET },
          unit: "$",
          verdict: "too low",
          enterAt: 0.15,
        },
        {
          id: "why",
          type: "callout",
          text: "Still short — my turn to move",
          speaker: "You",
          anchor: { rowId: "shelf", index: 1 },
          enterAt: 0.5,
        },
      ],
    }),
    scene({
      id: "found",
      traceStep: 3,
      caption: "$14 + $36 = $50 exactly",
      narration:
        "Mug plus headphones: fourteen plus thirty-six is exactly fifty dollars. Gift card spent, no change. You found the pair after only four checks instead of twenty-one.",
      elements: [
        shelf,
        you(2, 1),
        friend(5),
        { id: "out", type: "highlight", rowId: "shelf", indices: [0, 1, 6], state: "rejected" },
        { id: "match", type: "highlight", rowId: "shelf", indices: [2, 5], state: "found", enterAt: 0.15 },
        {
          id: "sum",
          type: "equation",
          terms: [14, 36],
          result: 50,
          comparison: { op: "=", target: TARGET },
          unit: "$",
          verdict: "exact!",
          enterAt: 0.15,
        },
        {
          id: "answer",
          type: "result",
          title: "Mug + Headphones",
          value: "4 checks instead of 21",
          indices: [2, 5],
          enterAt: 0.5,
        },
      ],
    }),
    scene({
      id: "pattern",
      traceStep: 3,
      caption: "The pattern: Two Pointers, O(n)",
      narration:
        "Now strip away the story. The shelf is a sorted array, you are the left index, your friend is the right index, and the gift card is the target. Each comparison throws out one element for good, so the pointers meet after at most n steps. That's linear time, O(n), with constant extra space.",
      elements: [
        {
          ...shelf,
          id: "array",
          items: SHELF.map((item, i) => ({ label: `a[${i}]`, value: item.value, sublabel: item.label })),
          unit: "",
        },
        {
          id: "left",
          type: "pointer",
          rowId: "array",
          label: "left",
          index: 2,
          binds: "left",
          tone: "primary",
        },
        {
          id: "right",
          type: "pointer",
          rowId: "array",
          label: "right",
          index: 5,
          binds: "right",
          tone: "secondary",
        },
        { id: "match", type: "highlight", rowId: "array", indices: [2, 5], state: "found" },
        {
          id: "rule",
          type: "callout",
          text: "sum < target → left++   ·   sum > target → right--",
          enterAt: 0.25,
        },
        {
          id: "complexity",
          type: "result",
          title: "Two Pointers",
          value: "O(n) time · O(1) space",
          detail: "vs. O(n²) for checking every pair",
          tone: "info",
          enterAt: 0.55,
        },
      ],
    }),
  ],
});
