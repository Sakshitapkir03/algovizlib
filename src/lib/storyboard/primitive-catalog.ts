import type { ElementType } from "./elements";

/**
 * What each primitive is for, in the words the generator prompt uses. Typed over every element type, so a new
 * primitive can't ship without telling the model how to use it.
 */
export const primitiveCatalog: Record<ElementType, string> = {
  "item-row":
    "A row of labeled cards (item + value), e.g. products with prices or a[i] with values. With a trace, omit `items` to show the trace's values and give `labels` (one per value) to name them in the story. Place it first in every scene that shows data.",
  "bar-row":
    "Vertical bars on a shared baseline, e.g. walls, terrain heights, or values being sorted. With a trace, omit `bars` to use the trace's values (in a bound scene, the array as it stands after that step); the container fill, standing water, bar moves (a swap slides two bars past each other, a shift slides one), and empty slots come from the step automatically.",
  pointer:
    'A named marker under one card or bar (e.g. "You", "left"). Set `binds` to a trace pointer name and omit `index`; the position comes from the scene\'s trace step and it slides from where the previous bound scene left it. Only bind pointers the step actually has.',
  highlight:
    'Emphasize items as "active" (being checked), "rejected" (ruled out), or "found" (the answer). In a bound scene omit `indices` to use the step\'s items for that state.',
  callout:
    "A speech bubble with one short sentence, anchored to an item ({ rowId, index }) or floating at the top. Use for the reasoning behind a move. Never put numbers in a callout that contradict the trace.",
  equation:
    'The arithmetic of the step, e.g. 4 + 45 = 49 < 50. In a bound scene omit terms/operator/result/comparison to take them from the step; add `unit` (e.g. "$") and a 1–3 word `verdict` ("too low", "new best"). `verdictTone` ("positive" | "negative" | "neutral") colors the verdict: when the step lists a tone, omit it and write a verdict that reads that way. Only use it when the step has arithmetic.',
  "sorted-region":
    'Marks positions already in their final order with a shaded band and a "✓ sorted" label beside the row. Set `rowId`; in a bound scene omit `from`/`to` to take the step\'s sorted range. Only use it when the step lists a sorted range.',
  "held-value":
    'A value lifted out of the row (e.g. the card in your hand in insertion sort), drawn above its gap. Set `rowId` and optionally `label` (e.g. "in hand"); omit `value`/`index` to take them from the step. Only use it when the step is holding a value.',
  "count-array":
    'A panel of tally cells under the bars, one per value (e.g. 0–4 with how many of each). Omit `keys`/`counts`/`active` to take the step\'s tally; set `label` (e.g. "tally"). Only use it when the step has a tally.',
  segments:
    'Brackets under the bars showing how the array is split right now (groups drawn apart, the active group emphasized with its "level"). Set `rowId`; omit `groups`/`active`/`depth` to take the step\'s split. Only use it when the step lists groups.',
  "split-tree":
    "A compact overview of every split level at once, from the whole array down to single values, under the row. Omit `levels` to take the step's split tree. Only use it when the step lists a split tree (usually the first split scene).",
  "merge-buffer":
    'A strip of slots under the bars that fills as a merge takes values (taken values leave the bars as empty slots); the slot just written is marked. Set `rowId` and optionally `label` (e.g. "merged pile"); omit `from`/`values`/`taken`. Only use it when the step lists a merge buffer.',
  partition:
    'Quick sort\'s partition: a "◆ pivot" tag above the pivot bar, a dashed boundary with smaller values to its left, and bars outside the range being partitioned dimmed. Set `rowId`; omit `pivot`/`boundary`/`from`/`to`. Only use it when the step lists a pivot.',
  "heap-tree":
    "The same array drawn as a binary tree beside the bars (children of i at 2i + 1 and 2i + 2); nodes past the heap are faded, and the parent/child being compared are marked and swap with the bars. Omit `values`/`heapSize`/`compare`/`moves` to take them from the step (or the trace's row in an unbound scene). Use it with a bar-row in every heap scene.",
  counter:
    'A running total with a label (e.g. "inversions") and the amount this step added ("+3"). Set `label`; omit `value`/`delta` to take the step\'s count. Only use it when the step lists a count.',
  result:
    'A final-answer or stat card (title + value + optional detail). For the answer set `showsAnswer: true` and omit `value` to display the trace\'s answer exactly. Also fine for info cards (e.g. "21 checks for 7 items", tone "info").',
};
