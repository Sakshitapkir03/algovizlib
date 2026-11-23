import type { Element } from "@/lib/storyboard";
import { layoutScene } from "@/video/layout";
import { TEXT, type TextMetrics } from "@/video/text";

/**
 * Everything that can go wrong drawing a scene's stack at this player size: items wider than the column, the column
 * (with the items popped above it) running under the caption or into the bottom stack, the input row running into
 * the column, and the answers, arcs, or text strip running into the bottom stack or off the stage.
 */
export function stackProblems(elements: readonly Element[], t: TextMetrics): string[] {
  const stacks = elements.filter((e) => e.type === "stack");
  if (stacks.length === 0) return [];
  const { pile: first, piles, rows, bottomTop } = layoutScene(elements, t);
  const problems: string[] = [];
  // Two stacks (a queue made of two) each have their own column; they must not overlap.
  if (stacks.length > 1) {
    const columns = stacks.map((s) => piles?.[s.id]).filter((p) => p !== undefined);
    if (columns.length !== stacks.length) problems.push("a second stack has no column of its own");
    for (let k = 1; k < columns.length; k++)
      if (columns[k - 1].left + columns[k - 1].width + 16 > columns[k].left)
        problems.push("two stacks overlap");
  }
  for (const el of stacks) problems.push(...oneStack(el, piles?.[el.id] ?? first, rows, bottomTop, t));
  return problems;
}

function oneStack(
  el: Extract<Element, { type: "stack" }>,
  pile: ReturnType<typeof layoutScene>["pile"],
  rows: ReturnType<typeof layoutScene>["rows"],
  bottomTop: number,
  t: TextMetrics,
): string[] {
  if (!pile) return ["stack has no layout"];
  const problems: string[] = [];
  const captionBottom = 70 + 2 * Math.ceil(t.size(TEXT.caption) * 1.25);
  for (const item of [...el.items, ...(el.popped ?? [])])
    if (!t.fits(item.label, t.size(TEXT.stackItem), pile.width - 16, "mono"))
      problems.push(`stack item ${item.label} is wider than the column`);
  // A titled column (beside an op log) keeps its title on a phone: it needs room above the items, and must fit.
  const title = pile.titled ? t.size(TEXT.stackTitleSmall) + 26 : 0;
  if (pile.titled && !t.fits(el.label, t.size(TEXT.stackTitleSmall), pile.width + 40))
    problems.push(`the stack's title "${el.label}" is wider than its column`);
  const used = (el.items.length + (el.popped?.length ?? 0)) * (pile.itemHeight + pile.gap) + 8 + title;
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
