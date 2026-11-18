import type { ElementType } from "./elements";

/**
 * What each primitive is for, in the words the generator prompt uses. Typed over every element type, so a new
 * primitive can't ship without telling the model how to use it.
 */
export const primitiveCatalog: Record<ElementType, string> = {
  "item-row":
    "A row of labeled cards (item + value), e.g. products with prices or a[i] with values. With a trace, omit `items` to show the trace's values and give `labels` (one per value) to name them in the story. Place it first in every scene that shows data.",
  "bar-row":
    "Vertical bars on a shared baseline, e.g. walls or terrain heights. With a trace, omit `bars` to use the trace's values; in a bound scene the container fill / standing water come from the step automatically.",
  pointer:
    'A named marker under one card or bar (e.g. "You", "left"). Set `binds` to a trace pointer name and omit `index`; the position comes from the scene\'s trace step and it slides from where the previous bound scene left it. Only bind pointers the step actually has.',
  highlight:
    'Emphasize items as "active" (being checked), "rejected" (ruled out), or "found" (the answer). In a bound scene omit `indices` to use the step\'s items for that state.',
  callout:
    "A speech bubble with one short sentence, anchored to an item ({ rowId, index }) or floating at the top. Use for the reasoning behind a move. Never put numbers in a callout that contradict the trace.",
  equation:
    'The arithmetic of the step, e.g. 4 + 45 = 49 < 50. In a bound scene omit terms/operator/result/comparison to take them from the step; add `unit` (e.g. "$") and a 1–3 word `verdict` ("too low", "new best"). Only use it when the step has arithmetic.',
  result:
    'A final-answer or stat card (title + value + optional detail). For the answer set `showsAnswer: true` and omit `value` to display the trace\'s answer exactly. Also fine for info cards (e.g. "21 checks for 7 items", tone "info").',
};
