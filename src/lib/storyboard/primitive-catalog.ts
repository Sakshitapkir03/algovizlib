import type { ElementType } from "./elements";

/**
 * What each primitive is for, in the words the generator prompt uses. Typed over every element type, so a new
 * primitive can't ship without telling the model how to use it.
 */
export const primitiveCatalog: Record<ElementType, string> = {
  "item-row":
    'A row of labeled cards (item + value), e.g. products with prices or a[i] with values. With a trace, omit `items` to show the trace\'s values and give `labels` (one per value) to name them in the story. Place it first in every scene that shows data. When the trace lists a second list, add a second item-row with `traceRow: "second"` (and its own labels) under the first.',
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
    'Marks positions already in their final order (a range, or scattered positions such as placed pivots) with a shaded band and a "✓ sorted" label beside the row. Set `rowId`; in a bound scene omit `indices` to take the step\'s sorted range or final positions. Only use it when the step lists one.',
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
    "The same array drawn as a binary tree beside the bars (children of i at 2i + 1 and 2i + 2); nodes past the heap are faded, and the parent/child being compared are marked and swap with the bars. Omit `values`/`heapSize`/`compare`/`moves` to take them from the step (or the trace's row in an unbound scene). Use it with a bar-row in every heap scene. When the step lists a `heap` (a min-heap of list heads, Merge K Sorted Lists), it draws that heap beside the linked-list instead: omit `values` too, and leave it out once the heap is empty.",
  counter:
    'A running total with a label (e.g. "inversions") and the amount this step added ("+3"). Set `label`; omit `value`/`delta` to take the step\'s count. Only use it when the step lists a count.',
  window:
    'The sliding window: a bracket above the cards from its left edge to its right edge, labeled with its value (e.g. label "sum" shows "sum 13"; "length" shows "length 4"). Set `rowId` and `label`; omit `from`/`to`/`value` to take the step\'s window, and the edges slide from where the previous bound scene left them. Only use it when the step lists a window.',
  "freq-table":
    'A small panel of character counts in the window (e.g. B 2, A 1), or have/need for a target ("A 1/1"); the count that just changed is marked. Set `label` (e.g. "in window"); omit `entries`/`active`. Only use it when the step lists counts.',
  deque:
    "Sliding Window Maximum's deque: the candidate positions front → back (values decreasing; the front is the window's maximum), values removed this step shown crossed out with the end they left from, and the maxima recorded so far. Set `rowId` (and optionally `label`, `outputLabel`); omit `indices`/`output`/popped lists. Only use it when the step lists a deque.",
  "search-range":
    'Binary search over the row: a bracket above the cards still in play, every dropped card dimmed and dashed with ✕, the card just checked (mid) ringed, and on a rotated list the half known to be in order marked "✓ sorted". When nothing is left in play it becomes a marker in the gap where the answer goes (give it a `label` such as "insert here"). Set `rowId`; omit `from`/`to`/`mid`/`sorted`, and the bracket shrinks from where the previous bound scene left it. Only use it when the step lists a search range.',
  "number-line":
    'Binary search on the answer: every candidate answer (e.g. speeds 1–13) as a tick, those ruled out dashed with ✕, those known to work solid with ✓, the ones still possible plain, and the candidate just tested (mid) marked. Set `label` (e.g. "speed"); omit `min`/`max`/`low`/`high`/`mid`. Only use it when the step lists candidate answers.',
  cut: 'A divider through a row of cards marking how many values sit on its left, with the left side shaded (Median of Two Sorted Arrays: one cut per list). Set `rowId`; omit `at`, and it slides from where the previous bound scene left it. For the second list, give that item-row `traceRow: "second"` and its own id. Only use it when the step lists cuts.',
  "linked-list":
    'Linked lists as node boxes with an arrow from each node to its `next` (curved when it points backward or to another lane) and a "null" end; a dummy node is dashed. Several lists share one element as lanes (two input lists and the merged list; three lists and the merged one), and nodes slide between lanes and slots as the algorithm moves them. In a bound scene a rewired link visibly detaches (the old arrow ghosts away) and reattaches. Omit `nodes` (and `rewired`/`fromPlaces`) to take the step\'s list; an unbound scene shows the list as the trace starts. Optional `laneLabels` name the lanes in the story (e.g. ["queue A", "queue B", "boarding"]). Pointers and highlights on it use `rowId` = its id and node ids as indices: put pointers `placement: "above"` and bind them (a pointer the step doesn\'t list is at null; leave it out). Use exactly one per scene, first, in every scene that shows the list.',
  "binary-tree":
    'A binary tree drawn by depth with an edge to each child. Omit `nodes` and the walk (`current`, `nullVisit`, `path`, `done`, `skipped`, `returned`, `results`, `badges`) to take them from the step: the running call is ringed, the open calls from the root are an accent path, finished calls are marked ✓ with what they returned beside them, a missing child being visited (the base case) is a small "null" stub, a value handed up travels along the edge to the parent, running state carried down ("sum 9") sits beside its node, and nodes an early exit never visits are dashed. An unbound scene shows the bare tree. Highlights and anchored callouts use `rowId` = its id and node ids as indices. Use exactly one per scene, first, in every scene that shows the tree.',
  "call-stack":
    'The recursion\'s open calls as a stack of frames beside the tree, bottom (the first call) to top (the running one): each frame is the call ("depth(5)") and what it is doing ("waiting for left", "returns 3"). Frames pushed since the previous bound scene slide in. Omit `frames`/`kept` to take the step\'s stack; set `label` only to rename it. Use it in every bound scene of a recursive tree walk.',
  result:
    'A final-answer or stat card (title + value + optional detail). For the answer set `showsAnswer: true` and omit `value` to display the trace\'s answer exactly. Also fine for info cards (e.g. "21 checks for 7 items", tone "info").',
};
