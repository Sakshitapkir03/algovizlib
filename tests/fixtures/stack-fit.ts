import type { Element } from "@/lib/storyboard";
import { layoutScene } from "@/video/layout";
import { TEXT, type TextMetrics } from "@/video/text";

/**
 * Everything that can go wrong drawing a scene's stack at this player size: items wider than the column, the column
 * (with the items popped above it) running under the caption or into the bottom stack, the input row running into
 * the column, and the answers, arcs, or text strip running into the bottom stack or off the stage.
 */
export function stackProblems(elements: readonly Element[], t: TextMetrics): string[] {
  const el = elements.find((e) => e.type === "stack");
  if (el?.type !== "stack") return [];
  const { pile, rows, bottomTop } = layoutScene(elements, t);
  if (!pile) return ["stack has no layout"];
  const problems: string[] = [];
  const captionBottom = 70 + 2 * Math.ceil(t.size(TEXT.caption) * 1.25);
  for (const item of [...el.items, ...(el.popped ?? [])])
    if (!t.fits(item.label, t.size(TEXT.stackItem), pile.width - 16, "mono"))
      problems.push(`stack item ${item.label} is wider than the column`);
  const used = (el.items.length + (el.popped?.length ?? 0)) * (pile.itemHeight + pile.gap) + 8;
  if (pile.bottom - used < captionBottom)
    problems.push(`the stack (${el.items.length} + ${el.popped?.length ?? 0} out) runs under the caption`);
  if (pile.bottom > bottomTop) problems.push("the stack runs into the bottom stack");
  if (pile.left + pile.width > 1280) problems.push("the stack runs off the stage");
  const row = el.rowId ? rows[el.rowId] : undefined;
  if (row) {
    if (row.lefts.at(-1)! + row.cardWidth > pile.left - 8) problems.push("the input runs into the stack");
    const lowest =
      pile.textTop !== undefined ? pile.textTop + t.size(TEXT.stackItem) + 22 : (pile.arcsBottom ?? 0);
    if (lowest > bottomTop + 2) problems.push("the answers, arcs, or text run into the bottom stack");
    if (el.text && row.lefts[0] + t.width(el.text.value, t.size(TEXT.stackItem), "mono") + 40 > pile.left)
      problems.push(`the built text "${el.text.value}" runs into the stack`);
    for (const a of el.answers ?? [])
      if (!t.fits(a.label, t.size(TEXT.stackNote), row.cardWidth + 12, "mono"))
        problems.push(`answer ${a.label} is too wide`);
  }
  return problems;
}
