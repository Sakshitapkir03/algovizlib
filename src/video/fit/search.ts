import type { Element } from "@/lib/storyboard";
import { graphColumns, layoutScene, sizes } from "@/video/layout";
import { TEXT, type TextMetrics } from "@/video/text";

/**
 * Everything that can go wrong drawing a BFS scene at this player size: a grid's glyphs or levels wider than their
 * cells, a grid or graph under the caption or in the bottom stack or off the stage, graph nodes overlapping, and a
 * queue wider than the stage.
 */
export function searchProblems(
  elements: readonly Element[],
  t: TextMetrics,
  type: "grid" | "graph" | "queue",
): string[] {
  const problems: string[] = [];
  const { grid, graph, bottomTop } = layoutScene(elements, t);
  const captionBottom = 70 + 2 * Math.ceil(t.size(TEXT.caption) * 1.25);
  const el = elements.find((e) => e.type === type);
  if (el?.type === "grid") {
    if (!grid) return ["grid has no layout"];
    const size = t.size(TEXT.gridGlyph);
    const texts = [...el.legend.map((k) => k.glyph), ...(el.levels ?? []).map((l) => String(l.level))];
    for (const s of texts)
      if (!t.fits(s, size, grid.cell - 12, "mono"))
        problems.push(`"${s}" is wider than a cell (${Math.round(grid.cell)}px)`);
    if (grid.top < captionBottom) problems.push("the grid starts under the caption");
    if (grid.top + grid.cell * grid.rows > bottomTop + 2)
      problems.push("the grid runs into the bottom stack");
    if (grid.left < 0 || grid.left + grid.cell * grid.cols > 1280)
      problems.push("the grid runs off the stage");
  }
  if (el?.type === "graph") {
    if (!graph) return ["graph has no layout"];
    const columns = graphColumns(el);
    for (const a of el.nodes) {
      const ca = graph.center(a.id);
      if (ca.x - graph.nodeWidth / 2 < 0 || ca.x + graph.nodeWidth / 2 > 1280)
        problems.push(`node ${a.label} runs off the stage`);
      if (ca.y - graph.nodeHeight / 2 < captionBottom)
        problems.push(`node ${a.label} starts under the caption`);
      if (ca.y + graph.nodeHeight / 2 + graph.labelRoom > bottomTop + 2)
        problems.push(`node ${a.label} runs into the bottom stack`);
      for (const b of el.nodes) {
        if (b.id <= a.id) continue;
        const cb = graph.center(b.id);
        const apartX = Math.abs(ca.x - cb.x) >= graph.nodeWidth + 12;
        const apartY = Math.abs(ca.y - cb.y) >= graph.nodeHeight + graph.labelRoom;
        if (!apartX && !apartY) problems.push(`nodes ${a.label} and ${b.label} overlap`);
      }
    }
    if (new Set(columns).size > 1) {
      const xs = [...new Set(el.nodes.map((n) => graph.center(n.id).x))].sort((x, y) => x - y);
      if (xs.some((x, k) => k > 0 && x - xs[k - 1] < graph.nodeWidth + 24))
        problems.push("graph columns are too close");
    }
  }
  if (el?.type === "queue") {
    const labels = [...el.items, ...(el.dequeued ? [el.dequeued] : [])].map((i) => i.label);
    const cell = sizes.queueCell(t, labels);
    const levels = new Set(el.items.map((i) => i.level)).size;
    const width =
      t.width(el.label, t.size(TEXT.panelLabel)) +
      (labels.length || 1) * (cell + 10) +
      Math.max(0, levels - 1) * 13;
    if (width > 1280 - 32) problems.push(`the queue is wider than the stage (${Math.round(width)}px)`);
    for (const l of labels)
      if (!t.fits(l, t.size(TEXT.queueItem), cell - 12, "mono"))
        problems.push(`queue item ${l} is wider than its cell`);
  }
  return problems;
}
