import type { Element } from "@/lib/storyboard";
import { layoutScene, visibleSearchNodes } from "@/video/layout";
import { TEXT, type TextMetrics } from "@/video/text";

/**
 * Everything that can go wrong drawing a search scene at this player size: tree nodes overlapping on a level or
 * running off the stage, under the caption, or into the bottom stack; the tree running into a board beside it; and
 * the answer being built wider than the stage.
 */
export function backtrackProblems(
  elements: readonly Element[],
  t: TextMetrics,
  type: "search-tree" | "partial",
): string[] {
  const problems: string[] = [];
  const el = elements.find((e) => e.type === type);
  const { search, grid, bottomTop } = layoutScene(elements, t);
  const captionBottom = 70 + 2 * Math.ceil(t.size(TEXT.caption) * 1.25);
  if (el?.type === "search-tree") {
    if (!search) return ["search tree has no layout"];
    const ids = visibleSearchNodes(el);
    for (const id of ids) {
      const c = search.center(id);
      if (!c) continue;
      const label = el.nodes[id].pruned ? "✕" : el.nodes[id].label || "·";
      if (!t.fits(label, t.size(TEXT.searchNode), search.nodeWidth - 8, "mono"))
        problems.push(`node label "${label}" is wider than its node`);
      if (c.x - search.nodeWidth / 2 < 0 || c.x + search.nodeWidth / 2 > 1280)
        problems.push(`node ${id} runs off the stage`);
      if (c.y - search.nodeHeight / 2 < captionBottom) problems.push(`node ${id} runs under the caption`);
      if (c.y + search.nodeHeight / 2 > bottomTop + 2) problems.push(`node ${id} runs into the bottom stack`);
      if (grid && c.x - search.nodeWidth / 2 < grid.left + grid.cell * grid.cols + 8)
        problems.push(`node ${id} runs into the board`);
      for (const other of ids) {
        const d = search.center(other);
        if (other <= id || !d || Math.abs(d.y - c.y) > 1) continue;
        if (Math.abs(d.x - c.x) < search.nodeWidth + 4) problems.push(`nodes ${id} and ${other} overlap`);
      }
    }
  }
  if (el?.type === "partial") {
    const item = t.size(TEXT.partialItem);
    const width =
      t.width(el.label, t.size(TEXT.panelLabel)) +
      [...el.items, ...(el.removed ? [el.removed] : [])].reduce(
        (sum, i) => sum + Math.max(t.width(i, item, "mono") + 22, 40) + 10,
        0,
      );
    if (width > 1280 - 32)
      problems.push(`the answer being built is wider than the stage (${Math.round(width)}px)`);
  }
  return problems;
}
