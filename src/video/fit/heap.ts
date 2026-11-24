import type { Element } from "@/lib/storyboard";
import { layoutScene } from "@/video/layout";
import { TEXT, type TextMetrics } from "@/video/text";

/**
 * Everything that can go wrong drawing a scene's heaps at this player size: labels wider than their nodes, nodes on
 * one level overlapping, the tree or the array strip off the stage, under the caption (or the input strip), or in the
 * bottom stack, and two heaps' panels overlapping.
 */
export function heapProblems(elements: readonly Element[], t: TextMetrics): string[] {
  const el = elements.find((e) => e.type === "heap");
  if (el?.type !== "heap") return [];
  const { heapPanels, rows, bottomTop } = layoutScene(elements, t);
  if (!heapPanels) return ["heap has no layout"];
  const problems: string[] = [];
  const captionBottom = 70 + 2 * Math.ceil(t.size(TEXT.caption) * 1.25);
  const rowBottom = Math.max(captionBottom, ...Object.values(rows).map((r) => r.top + r.cardHeight));
  el.heaps.forEach((heap, h) => {
    const panel = heapPanels[h];
    const slots = el.slots?.[h] ?? heap.items.length;
    const labels = [
      ...heap.items,
      ...(heap.popped ? [heap.popped] : []),
      ...(heap.pushed ? [heap.pushed] : []),
    ];
    for (const item of labels)
      if (!t.fits(item.label, t.size(TEXT.heapItem), panel.nodeWidth - 12, "mono"))
        problems.push(`heap label ${item.label} is wider than its node`);
    for (let i = 0; i < slots; i++) {
      const c = panel.node(i);
      if (c.x - panel.nodeWidth / 2 < panel.left - 2 || c.x + panel.nodeWidth / 2 > panel.right + 2)
        problems.push(`heap ${h + 1} node ${i} runs out of its panel`);
      if (c.y - panel.nodeHeight / 2 < rowBottom)
        problems.push(`heap ${h + 1} node ${i} runs into what's above it`);
      const next =
        i + 1 < slots && Math.floor(Math.log2(i + 2)) === Math.floor(Math.log2(i + 1))
          ? panel.node(i + 1)
          : undefined;
      if (next && next.x - c.x < panel.nodeWidth + 4)
        problems.push(`heap ${h + 1} nodes ${i} and ${i + 1} overlap`);
    }
    if (panel.cellLeft(0) < panel.left - 2 || panel.cellLeft(slots - 1) + panel.nodeWidth > panel.right + 2)
      problems.push(`heap ${h + 1}'s array is wider than its panel`);
    if (panel.arrayTop + panel.nodeHeight > bottomTop + 2)
      problems.push(`heap ${h + 1}'s array runs into the bottom stack`);
    if (panel.left < 0 || panel.right > 1280) problems.push(`heap ${h + 1} runs off the stage`);
  });
  if (heapPanels.length === 2 && heapPanels[0].right > heapPanels[1].left)
    problems.push("the two heaps overlap");
  return problems;
}
